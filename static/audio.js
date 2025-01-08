// audio.js

window.audioReproduciendo = null; // Variable global para almacenar el audio en reproducción

function reproducirAudio(audioUrl) {
    if (audioUrl) {
        // Detener el audio anterior si está reproduciéndose
        if (window.audioReproduciendo) {
            window.audioReproduciendo.pause();
            window.audioReproduciendo.src = '';
            window.audioReproduciendo = null;
        }

        console.log("Intentando reproducir audio desde la URL: " + audioUrl);
        const audio = new Audio(audioUrl);

        // Asignar el nuevo audio a la variable global
        window.audioReproduciendo = audio;

        // Iniciar la reproducción directamente
        audio.play().then(() => {
            console.log("Reproducción automática iniciada correctamente.");
        }).catch(error => {
            console.error("Error reproduciendo el audio:", error);
            mostrarBotonReproduccion(audio); // Mostrar botón si hay error en la reproducción automática
        });

        audio.onerror = function() {
            console.error("Error cargando el archivo de audio desde la URL: " + audioUrl);
        };

        // Event listener para cuando el audio termina
        audio.onended = function() {
            console.log("Reproducción de audio finalizada.");
            window.audioReproduciendo = null; // Liberar el objeto de audio
        };
    } else {
        console.error("No se ha proporcionado una URL de audio.");
    }
}

function detenerAudio() {
    if (window.audioReproduciendo) {
        console.log("Deteniendo audio");
        window.audioReproduciendo.pause();
        window.audioReproduciendo.src = '';

        // Eliminar event listeners
        window.audioReproduciendo.oncanplaythrough = null;
        window.audioReproduciendo.onerror = null;
        window.audioReproduciendo.onended = null;

        window.audioReproduciendo = null;
    }
}

function mostrarBotonReproduccion(audio) {
    const playButton = document.createElement("button");
    playButton.textContent = "Reproducir audio";
    playButton.onclick = function() {
        audio.play();
    };
    document.getElementById("chat-history").appendChild(playButton);
}
