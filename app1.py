from flask import Flask, request, jsonify, render_template, session, redirect, url_for
import sqlite3
from datetime import datetime
import openai
from openai import OpenAI
import os
import whisper
from gtts import gTTS
import time
import faiss
import numpy as np

app = Flask(__name__)
app.secret_key = 'tu_clave_secreta'
from flask_cors import CORS
CORS(app)

# Inicializar OpenAI
client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")

# Listas globales para almacenar embeddings y metadatos
embeddings_list = []
ids_list = []
filenames_list = []
chunk_indices_list = []
chunks_list = []
faiss_index = None  # Cambiado de 'index' a 'faiss_index'

# Crear la base de datos si no existe
def create_db():
    conn = sqlite3.connect('chat_history1.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS history 
                 (email TEXT, message TEXT, response TEXT, timestamp DATETIME)''')
    conn.commit()
    conn.close()

def save_chat(email, message, response):
    conn = sqlite3.connect('chat_history1.db')
    c = conn.cursor()
    c.execute("INSERT INTO history (email, message, response, timestamp) VALUES (?, ?, ?, ?)",
              (email, message, response, datetime.now()))
    conn.commit()
    conn.close()

def get_chat_history(email):
    conn = sqlite3.connect('chat_history1.db')
    c = conn.cursor()
    c.execute("SELECT * FROM history WHERE email = ?", (email,))
    history = c.fetchall()
    conn.close()
    return history

# Verificar si el correo es de UTEM
def es_correo_institucional(correo):
    return correo.endswith('@utem.cl')

# Función para obtener embeddings
def get_embedding(text, model="nomic-ai/nomic-embed-text-v1.5-GGUF"):
    text = text.replace("\n", " ")
    return client.embeddings.create(input=[text], model=model).data[0].embedding

# Función para cargar y actualizar documentos en Faiss
def cargar_documentos_en_faiss():
    global faiss_index  # Cambiado de 'index' a 'faiss_index'
    directorio_txt = "prueba"
    archivos_txt = [f for f in os.listdir(directorio_txt) if f.endswith('.txt')]

    for archivo in archivos_txt:
        with open(os.path.join(directorio_txt, archivo), 'r', encoding='utf-8') as file:
            contenido = file.read()
            chunks = [contenido[i:i+300] for i in range(0, len(contenido), 300)]
            for i, chunk in enumerate(chunks):
                embedding = get_embedding(chunk)
                embeddings_list.append(embedding)
                ids_list.append(f"{archivo}_{i}")
                filenames_list.append(archivo)
                chunk_indices_list.append(i)
                chunks_list.append(chunk)

    # Después de procesar todos los archivos, crear el índice Faiss
    embeddings_array = np.array(embeddings_list, dtype='float32')
    dim = len(embeddings_list[0])
    faiss_index = faiss.IndexFlatL2(dim)  # Cambiado de 'index' a 'faiss_index'
    faiss_index.add(embeddings_array)  # Cambiado de 'index' a 'faiss_index'

# Cargar documentos al iniciar la aplicación
cargar_documentos_en_faiss()

# Generar respuesta y audio
def generar_respuesta_y_audio(pregunta_usuario, correo):
    if 'context' not in session:
        session['context'] = ""
    if 'question_count' not in session:
        session['question_count'] = 0

    session['question_count'] += 1
    session['context'] += f" {pregunta_usuario}"

    if session['question_count'] > 3:
        session['context'] = ""
        session['question_count'] = 1

    contexto = session['context']
    embedding_pregunta = get_embedding(pregunta_usuario)
    query_embedding = np.array(embedding_pregunta, dtype='float32').reshape(1, -1)

    k = 5  # Número de vecinos más cercanos
    distances, indices = faiss_index.search(query_embedding, k)  # Cambiado de 'index' a 'faiss_index'

    resultados = []
    for j, i in enumerate(indices[0]):
        if i < len(chunks_list):
            resultados.append({
                "id": ids_list[i],
                "filename": filenames_list[i],
                "chunk_index": chunk_indices_list[i],
                "content": chunks_list[i],
                "distance": distances[0][j]
            })

    if resultados:
        documentos_relevantes = [res['filename'] for res in resultados]

        # Cargar reglas y preguntas frecuentes
        def cargar_reglas():
            with open('reglas.txt', 'r', encoding='utf-8') as file:
                return file.read()

        def cargar_pref():
            with open('pref.txt', 'r', encoding='utf-8') as file:
                return file.read()

        reglas = cargar_reglas()
        preguntas = cargar_pref()

        # Construir contexto a partir de los fragmentos recuperados
        context = "\n\n".join([f"{res['content']}" for res in resultados])

        prompt = (
            f"Responde a la siguiente consulta **solo usando la información proporcionada**, puedes explayarte en tus respuestas. "
            f"Estas son las reglas: {reglas} y preguntas frecuentes: {preguntas}"
            "No inventes información y, si la respuesta no está en los fragmentos, di que no se encuentra la respuesta.\n\n"
            "Contexto:\n"
            f"{context}\n\n"
            "Pregunta:\n"
            f"{pregunta_usuario}"
        )

        completion = client.chat.completions.create(
            model="QuantFactory/Meta-Llama-3-8B-Instruct-GGUF",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=400,
        )

        respuesta = completion.choices[0].message.content
        audio_directory = "static/audio"
        os.makedirs(audio_directory, exist_ok=True)
        audio_file = f"{audio_directory}/{correo}_response.mp3"
        tts = gTTS(respuesta, lang='es')
        tts.save(audio_file)
        audio_url = url_for('static', filename=f'audio/{correo}_response.mp3', _external=True)
        return respuesta, audio_url

    return None, None

# Ruta para la página de inicio
@app.route('/')
def index():
    if 'authenticated' not in session or not session['authenticated']:
        return redirect(url_for('login'))
    return render_template('index.html')

# Ruta para la página de inicio de sesión
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        correo = request.form.get("email")
        if es_correo_institucional(correo):
            session['authenticated'] = True
            session['user'] = correo
            return redirect(url_for('index'))
        else:
            error = "Solo se permiten correos institucionales de UTEM"
            return render_template('login.html', error=error)
    return render_template('login.html')

# Ruta para preguntas
@app.route('/ask', methods=['POST'])
def ask():
    if 'user' not in session:
        return redirect(url_for('login'))

    data = request.json
    pregunta_usuario = data.get("question")
    correo = session['user']

    respuesta, audio_url = generar_respuesta_y_audio(pregunta_usuario, correo)
    if respuesta:
        save_chat(correo, pregunta_usuario, respuesta)
        return jsonify({"response": respuesta, "audio_url": audio_url})
    else:
        return jsonify({"error": "No se encontraron fragmentos relevantes."}), 404

# Ruta para transcripción de audio
model = whisper.load_model('base')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({'error': 'No se encontró archivo de audio'}), 400

    audio_file = request.files['audio']
    audio_path = 'temp_audio.wav'
    audio_file.save(audio_path)

    result = model.transcribe(audio_path, language='es')
    os.remove(audio_path)

    transcripcion = result['text']
    return jsonify({'transcription': transcripcion})

# Ruta para historial de chat
@app.route('/history', methods=['POST'])
def history():
    if 'user' not in session:
        return redirect(url_for('login'))

    correo = session['user']
    history = get_chat_history(correo)
    if history:
        return jsonify({"history": history})
    else:
        return jsonify({"error": "No hay historial"}), 404

if __name__ == '__main__':
    create_db()
    app.run(host='0.0.0.0', port=5001, debug=True)
