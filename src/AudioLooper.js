import { useState, useRef, useEffect } from "react";

export default function AudioLooper() {
    const [audioBuffer, setAudioBuffer] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isStopped, setIsStopped] = useState(false);
    const [loop, setLoop] = useState(false);
    const [reverse, setReverse] = useState(false);  // Nouveau state pour reverse
    const [speed, setSpeed] = useState(1);  // La vitesse par défaut
    const [volume, setVolume] = useState(1);  // Nouveau state pour le volume
    const audioContextRef = useRef(null);
    const sourceRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const [audioStartTime, setAudioStartTime] = useState(0);
    const [audioEndTime, setAudioEndTime] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);  // Pour garder une trace du temps de lecture

    // Fonction pour détecter les blancs au début et à la fin de l'audio
    const detectAudioBounds = (buffer) => {
        let start = 0;
        let end = buffer.length;

        // Détecte le début
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const channelData = buffer.getChannelData(i);
            for (let j = 0; j < channelData.length; j++) {
                if (Math.abs(channelData[j]) > 0.01) {  // Seuil pour détecter le son
                    start = Math.max(start, j - 1000); // Commence avant l'événement sonore
                    break;
                }
            }
        }

        // Détecte la fin
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const channelData = buffer.getChannelData(i);
            for (let j = channelData.length - 1; j >= 0; j--) {
                if (Math.abs(channelData[j]) > 0.01) {  // Seuil pour détecter le son
                    end = Math.min(end, j + 1000); // Fin après l'événement sonore
                    break;
                }
            }
        }

        setAudioStartTime(start / buffer.sampleRate); // Convertir en secondes
        setAudioEndTime(end / buffer.sampleRate);  // Convertir en secondes
    };

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        recorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(chunksRef.current, { type: "audio/wav" });
            chunksRef.current = [];

            const arrayBuffer = await audioBlob.arrayBuffer();
            const context = new AudioContext();
            const buffer = await context.decodeAudioData(arrayBuffer);
            setAudioBuffer(buffer);
            detectAudioBounds(buffer);  // Détecte les blancs dans l'audio
        };

        mediaRecorder.start();
    };

    const stopRecording = () => recorderRef.current?.stop();

    // Fonction pour démarrer l'audio avec les paramètres appropriés
    const playAudio = () => {
        if (!audioBuffer) return;

        // Fermeture de l'ancienne instance si elle existe
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }

        const context = new AudioContext();
        audioContextRef.current = context;
        const source = context.createBufferSource();
        sourceRef.current = source;

        const buffer = context.createBuffer(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            const channelData = audioBuffer.getChannelData(i);
            const newChannelData = buffer.getChannelData(i);

            if (reverse) {
                // Lecture à l'envers
                for (let j = 0; j < channelData.length; j++) {
                    newChannelData[j] = channelData[channelData.length - 1 - j];
                }
            } else {
                // Lecture normale
                newChannelData.set(channelData);
            }
        }

        source.buffer = buffer;
        source.playbackRate.value = speed;  // Applique la vitesse initiale

        // Création du GainNode pour gérer le volume
        const gainNode = context.createGain();
        gainNode.gain.value = volume;  // Définit le volume
        source.connect(gainNode);
        gainNode.connect(context.destination);

        // On démarre la lecture de l'audio
        source.start(0, audioStartTime, audioEndTime - audioStartTime);
        setIsPlaying(true);

        // Suivi du temps actuel de lecture
        source.onended = () => {


            if (loop) {
                playAudio(); // Si loop est activé, relance l'audio
            } else {
                setIsPlaying(false); // Si loop est désactivé, arrête la lecture
                return;
            }
        };
    };

    // Fonction pour arrêter l'audio
    const stopAudio = () => {
        if (sourceRef.current) {
            sourceRef.current.stop(); // Arrête la lecture
            sourceRef.current.disconnect(); // Déconnecte la source
            sourceRef.current = null; // Réinitialise la référence
        }

        if (audioContextRef.current) {
            audioContextRef.current.close(); // Ferme l'AudioContext
            audioContextRef.current = null; // Réinitialise la référence
        }

        setIsPlaying(false); // Met à jour l'état de lecture
    };

    // Mise à jour de la vitesse via la barre de défilement
    const handleSpeedChange = (event) => {
        const newSpeed = parseFloat(event.target.value);
        setSpeed(newSpeed);

        if (isPlaying) {
            stopAudio();  // Arrête l'audio en cours
            playAudio();  // Redémarre avec la nouvelle vitesse
        }
    };

    // Mise à jour du volume via le slider
    const handleVolumeChange = (event) => {
        const newVolume = parseFloat(event.target.value);
        setVolume(newVolume);

        if (isPlaying) {
            stopAudio();  // Arrête l'audio en cours
            playAudio();  // Redémarre avec le nouveau volume
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-6 space-y-6 w-full h-screen">
            <div className="flex flex-col items-center space-y-6 w-full max-w-xs">
                <button onClick={startRecording} className="p-8 bg-blue-500 text-white text-6xl rounded-lg w-full max-w-xs">🎤 Démarrer l'enregistrement</button>
            </div>
            <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
                <button onClick={stopRecording} className="p-6 bg-red-500 text-white text-6xl rounded-lg w-full max-w-xs">⏹️ Arrêter l'enregistrement</button>
            </div>
            {audioBuffer && (
                <>
                    <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
                        <button onClick={() => (isPlaying ? stopAudio() : playAudio())} className="p-6 bg-green-500 text-white text-3xl rounded-lg w-full max-w-xs">
                            {isPlaying ? "⏹️ Arrêter" : "▶️ Jouer"}
                        </button>
                    </div>
                    <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
                        <button
                            onClick={() => setReverse(!reverse)}
                            disabled={isPlaying} // Désactive quand on joue
                            className="p-6 bg-purple-500 text-white text-3xl rounded-lg w-full max-w-xs"
                        >
                            {reverse ? "🔄 Normal" : "🔄 Inverser"}
                        </button>
                    </div>
                    <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
                        <button
                            onClick={() => setLoop(!loop)}
                            disabled={isPlaying} // Désactive quand on joue
                            className={`p-6 rounded-lg text-white text-3xl w-full max-w-xs ${loop ? "bg-yellow-500" : "bg-gray-500"}`}
                        >
                            {loop ? "🔁 Lecture seule" : "🔁 Lecture boucle"}
                        </button>
                    </div>
                    <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
                        <label htmlFor="speed" className="text-white text-2xl">Vitesse</label>
                        <input
                            id="speed"
                            type="range"
                            min="0.4"
                            max="2"
                            step="0.1"
                            value={speed}
                            onChange={handleSpeedChange}
                            className="w-full"
                        />
                        <span className="text-white text-2xl">{speed}x</span>
                    </div>
                    <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
                        <label htmlFor="volume" className="text-white text-2xl">Volume</label>
                        <input
                            id="volume"
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={handleVolumeChange}
                            className="w-full"
                        />
                        <span className="text-white text-2xl">{(volume * 100).toFixed(0)}%</span>
                    </div>
                </>
            )}
        </div>
    );


}
