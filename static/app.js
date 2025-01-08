document.addEventListener("DOMContentLoaded", function () {
    const sendButton = document.getElementById("send-button");
    const recordButton = document.getElementById("record-button");
  
    if (sendButton) {
      sendButton.addEventListener("click", function () {
        const userInput = document.getElementById("user-input").value;
        sendMessage(userInput);
      });
    } else {
      console.error("Botón de enviar no encontrado.");
    }
  
    if (recordButton) {
      recordButton.addEventListener("click", function () {
        // Lógica de grabación de audio
      });
    } else {
      console.error("Botón de grabar no encontrado.");
    }
  });
  
  // Funcionalidad para el botón "Nuevo Chat"
  document.getElementById("new-chat-button").addEventListener("click", function () {
    // Detener el audio si está reproduciéndose
    detenerAudio();
  
    // Limpiar el historial de chat
    document.getElementById("chat-history").innerHTML = "";
  
    // Enviar una solicitud al backend para reiniciar el contexto y el contador
    fetch('/reset_context', {
      method: 'POST'
    })
      .then(response => {
        console.log("Contexto y contador reiniciados");
      })
      .catch(error => {
        console.error("Error al reiniciar el contexto:", error);
      });
  });
  
  // Funcionalidad para el botón "Ver Historial"
  document.getElementById("view-history-button").addEventListener("click", function () {
    // Detener el audio si está reproduciéndose
    detenerAudio();
  
    fetch('/history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(response => response.json())
      .then(data => {
        const chatHistory = document.getElementById("chat-history");
        chatHistory.innerHTML = "";  // Limpiar el historial actual
        if (data.history) {
          data.history.forEach(chat => {
            const chatItem = document.createElement("div");
            chatItem.textContent = `${chat[3]} - Pregunta: ${chat[1]} | Respuesta: ${chat[2]}`;
            chatHistory.appendChild(chatItem);
          });
        } else {
          console.error("Error:", data.error);
        }
      })
      .catch(error => {
        console.error("Error:", error);
      });
  });
  
  // Event listener para la tecla "Enter"
  document.getElementById("user-input").addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
      const userInput = document.getElementById("user-input").value;
      sendMessage(userInput, false); // El segundo argumento es 'false' porque no es un mensaje de voz
  
      // Limpiar el campo de entrada después de enviar
      document.getElementById("user-input").value = "";
    }
  });
  
  function sendMessage(userInput, isVoice = false) {
    if (userInput.trim() !== "") {
      // Mostrar el mensaje del usuario en la interfaz
      const userMessage = document.createElement("div");
      userMessage.textContent = `Tú: ${userInput}`;
      document.getElementById("chat-history").appendChild(userMessage);
  
      // Realizar la solicitud al backend
      fetch('/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question: userInput })
      })
        .then(response => response.json())
        .then(data => {
          if (data.response) {
            // Mostrar la respuesta del chatbot
            const botMessage = document.createElement("div");
            botMessage.textContent = `Utemcito: ${data.response}`;
            document.getElementById("chat-history").appendChild(botMessage);
  
            // Reproducir el audio solo si es un mensaje de voz
            if (isVoice && data.audio_url) {
              console.log("Reproduciendo audio desde la URL: ", data.audio_url);
              reproducirAudio(data.audio_url);
            }
          } else {
            console.error("Error:", data.error);
          }
        })
        .catch(error => console.error("Error:", error));
    }
  }
  
  document.getElementById("send-button").addEventListener("click", function () {
    const userInput = document.getElementById("user-input").value;
    sendMessage(userInput, false);  // El segundo argumento es 'false' porque no es un mensaje de voz
  
    // Limpiar el campo de entrada después de enviar
    document.getElementById("user-input").value = "";
  });