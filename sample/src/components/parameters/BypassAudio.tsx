import React, { useState, useRef, useContext, useEffect } from "react";
import ZoomMediaContext from "../../context/media-context";
import { Mic, Loader2 } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";
import AudioDeviceSelector from "../AudioDeviceSelector";

type ProcessorInfo = {
  processor: AudioWorkletNode;
};

function BypassAudio({ processor }: ProcessorInfo) {
  const { mediaStream } = useContext(ZoomMediaContext);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isRecordingRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { audioOn, handleToggleAudio } = useAudio();
  const sampleRate = 48000;
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Audio buffer queue
  const audioBufferQueueRef = useRef<Float32Array[]>([]);
  // Playback interval (milliseconds)
  const playbackInterval = 150; 
  // Playback timer
  const playbackTimerRef = useRef<number | null>(null);
  // Maximum queue length to prevent memory overflow
  const maxQueueLength = 50;

  useEffect(() => {
    if (isRecording) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === "processedAudio") {
          const audioData = event.data.audioData as Float32Array;
          drawAudioData(audioData);
          
          // Add audio data to queue, not immediately playing
          queueAudioData(audioData);
        }
      };

      processor.port.addEventListener("message", handleMessage);
      
      // Start playback timer
      startPlaybackTimer();
      
      return () => {
        processor.port.removeEventListener("message", handleMessage);
        stopPlaybackTimer();
      };
    }
  }, [isRecording, processor]);

  // Add audio data to queue
  const queueAudioData = (audioData: Float32Array) => {
    // Create a copy to avoid reference issues
    const audioCopy = new Float32Array(audioData);
    
    // Add data to queue
    audioBufferQueueRef.current.push(audioCopy);
    
    // Limit queue length
    if (audioBufferQueueRef.current.length > maxQueueLength) {
      audioBufferQueueRef.current.shift(); // Remove oldest data
    }
  };

  // Start playback timer
  const startPlaybackTimer = () => {
    if (playbackTimerRef.current !== null) return;
    
    playbackTimerRef.current = window.setInterval(() => {
      processAudioQueue();
    }, playbackInterval);
  };

  // Stop playback timer
  const stopPlaybackTimer = () => {
    if (playbackTimerRef.current !== null) {
      window.clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  // Process audio queue
  const processAudioQueue = () => {
    if (audioBufferQueueRef.current.length === 0) return;
    
    // Method 1: Play a single buffer from the queue
    // const audioData = audioBufferQueueRef.current.shift();
    // if (audioData) playAudioData(audioData);
    
    // Method 2: Combine multiple small buffers into one large buffer, potentially more efficient
    const combinedLength = audioBufferQueueRef.current.reduce(
      (sum, buffer) => sum + buffer.length, 0
    );
    
    if (combinedLength > 0) {
      const combinedBuffer = new Float32Array(combinedLength);
      let offset = 0;
      
      while (audioBufferQueueRef.current.length > 0) {
        const buffer = audioBufferQueueRef.current.shift();
        if (buffer) {
          combinedBuffer.set(buffer, offset);
          offset += buffer.length;
        }
      }
      
      playAudioData(combinedBuffer);
    }
  };

  // Play audio data
  const playAudioData = (audioData: Float32Array) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate });
      }

      const audioContext = audioContextRef.current;

      // Ensure AudioContext is running
      if (audioContext.state === "suspended") {
        audioContext.resume().catch((err) => console.error("Failed to resume AudioContext:", err));
      }

      // Create mono buffer
      const audioBuffer = audioContext.createBuffer(1, audioData.length, sampleRate);
      const audioDataCopy = new Float32Array(audioData);
      audioBuffer.copyToChannel(audioDataCopy, 0);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error("Error playing audio data:", error);
    }
  };

  // Draw audio waveform
  const drawAudioData = (audioData: Float32Array) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgb(0, 200, 200)";
    ctx.beginPath();

    const sliceWidth = width / audioData.length;
    let x = 0;

    for (let i = 0; i < audioData.length; i++) {
      const v = audioData[i];
      const y = (v * 0.5 + 0.5) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  const startRecording = async () => {
    try {
      setIsInitializing(true);
      isRecordingRef.current = true;
      setIsRecording(true);

      // Start Zoom audio
      if (!audioOn) {
        handleToggleAudio();
      }

      // Ensure AudioContext exists
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate });
      }
      
      // Clear buffer queue
      audioBufferQueueRef.current = [];
    } catch (err) {
      console.error("Failed to start recording:", err);
      stopRecording();
    } finally {
      setIsInitializing(false);
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (audioOn) {
      handleToggleAudio();
    }

    // Stop playback timer
    stopPlaybackTimer();
    
    // Clear buffer queue
    audioBufferQueueRef.current = [];

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch((err) => console.error("Failed to close AudioContext:", err));
      audioContextRef.current = null;
    }
  };

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Bypass Audio</h2>
          <div className="flex space-x-2">
            <button
              className={`p-2 rounded-lg transition-colors ${
                isInitializing
                  ? "bg-gray-500"
                  : isRecording
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isInitializing}
            >
              {isInitializing ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Mic
                  className={`w-5 h-5 text-white ${
                    isRecording ? "animate-pulse" : ""
                  }`}
                />
              )}
            </button>
          </div>
        </div>
        <canvas ref={canvasRef} className="w-full h-48 bg-gray-900 rounded-lg" />
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Parameters</h2>
        
        <div className="space-y-6">
          {/* Audio device selector */}
          <AudioDeviceSelector
            showMicrophoneSelector={true}
            showSpeakerSelector={true}
            disabled={isRecording}
          />
          
          {/* Processor description */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-gray-600">
              This is an audio bypass processor. Audio passes through the processor, then plays in the BypassAudio component and displays in the waveform.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default BypassAudio;