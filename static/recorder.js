let mediaRecorder;
let audioChunks = [];
let isRecording = false; // Variable para controlar si está grabando

const recordButton = document.getElementById('record-button');

// Evento del botón de grabar
recordButton.addEventListener('click', function() {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

// Función para comenzar la grabación
function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            isRecording = true;
            recordButton.innerHTML = '<i class="fas fa-stop"></i>'; // Cambia el ícono al de detener
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            audioChunks = []; // Limpiar los chunks de audio al comenzar la grabación

            mediaRecorder.ondataavailable = function(e) {
                audioChunks.push(e.data); // Almacenar los datos del audio
            };

            mediaRecorder.onerror = function(e) {
                console.error('Error durante la grabación:', e);
                stopRecording(); // Detener la grabación en caso de error
            };
        })
        .catch(error => {
            console.error('Error al acceder al micrófono:', error);
        });
}

// Función para detener la grabación y enviar el audio al backend
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    recordButton.innerHTML = '<i class="fas fa-microphone"></i>'; // Cambia el ícono de vuelta al micrófono
    isRecording = false; // Actualizar el estado de grabación

    mediaRecorder.onstop = function() {
        let audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

        // Enviar el audio al backend
        let formData = new FormData();
        formData.append('audio', audioBlob, 'audio.wav');

        fetch('/transcribe', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        // Enviar la transcripción al chatbot
        .then(data => {
            if (data.transcription) {
                sendMessage(data.transcription, true);
        } else {
            console.error('Error en la transcripción:', data.error);
    }
})

        .catch(error => {
            console.error('Error al enviar el audio:', error);
        });

        // Limpiar los chunks de audio después de enviarlo
        audioChunks = [];
    };
}
