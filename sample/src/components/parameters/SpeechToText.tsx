import React, { useState, useRef, useEffect } from "react";
import { Processor } from "@zoom/videosdk";
import { Mic, Loader2 } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";
import AudioDeviceSelector from "../AudioDeviceSelector";

type ProcessorInfo = {
  processor: Processor;
};

function TextToSpeech({ processor }: ProcessorInfo) {
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [settings, setSettings] = useState({
    language: "en-US",
    quality: "high",
    engine: "assemblyai",
    apiKey: "",
  });

  const { audioOn, handleToggleAudio } = useAudio();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processorRef = useRef<Processor>();
  const workerRef = useRef<Worker | null>(null);
  const animationFrameRef = useRef<number>();
  const isRecordingRef = useRef(false);
  const animationStartTimeRef = useRef<number>(0);

  useEffect(() => {
    processorRef.current = processor;
  }, [processor]);

  const startWorker = (apiKey: string) => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    // Create a new WebWorker
    workerRef.current = new Worker(
      new URL("../../../src/utils/transcription-worker.ts", import.meta.url),
      { type: "module" }
    );

    // Listen for messages from the WebWorker
    workerRef.current.onmessage = (event) => {
      const { cmd, text, error } = event.data;

      switch (cmd) {
        case "worker_ready":
          console.log("WebWorker is ready");
          // Initialize the worker with the API key
          workerRef.current?.postMessage({
            cmd: "init",
            data: { apiKey },
          });
          break;

        case "initialized":
          // Signal to the AudioWorkletProcessor that the worker is ready
          if (processorRef.current) {
            processorRef.current.port.postMessage({ cmd: "worker_started" });
          }
          break;

        case "transcription_result":
          setTranscription(text);
          break;

        case "error":
          console.error("Worker error:", error);
          break;
      }
    };
  };

  const stopWorker = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ cmd: "stop" });
      workerRef.current.terminate();
      workerRef.current = null;
    }
  };

  const drawRecordingEffect = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    const animate = (timestamp: number) => {
      if (!isRecordingRef.current) return;
      
      if (!animationStartTimeRef.current) {
        animationStartTimeRef.current = timestamp;
      }
      
      const elapsed = timestamp - animationStartTimeRef.current;
      ctx.fillStyle = 'rgb(25, 25, 25)';
      ctx.fillRect(0, 0, width, height);
      
      ctx.strokeStyle = 'rgb(220, 53, 69)';
      ctx.lineWidth = 3;
      
      const numWaves = 3;
      const waveHeights = [20, 15, 10]; 
      const waveFreqs = [0.01, 0.02, 0.015];
      const waveOffsets = [0, 120, 240];
      
      for (let w = 0; w < numWaves; w++) {
        ctx.beginPath();
        
        for (let x = 0; x < width; x += 5) {
          const waveHeight = waveHeights[w] * 
            (0.8 + Math.sin(elapsed / 1000) * 0.2);
          
          const y = height / 2 + 
            Math.sin((x * waveFreqs[w]) + (elapsed + waveOffsets[w]) / 200) * waveHeight;
          
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.stroke();
      }
      
      const pulsate = Math.sin(elapsed / 200) * 0.2 + 0.8;
      const dotRadius = 8 * pulsate;
      
      ctx.fillStyle = 'rgb(220, 53, 69)';
      ctx.beginPath();
      ctx.arc(width - 30, 30, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationStartTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(animate);
  };



  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "rgb(25, 25, 25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const startRecording = async () => {
    try {
      setIsInitializing(true);

      if (!settings.apiKey) {
        throw new Error("API Key is required");
      }

      if (processorRef.current) {
        // Start the WebWorker
        startWorker(settings.apiKey);

        processorRef.current.port.postMessage({
          cmd: "start_transcription",
          data: {
            apiKey: settings.apiKey,
          },
        });
      }

      isRecordingRef.current = true;
      setIsRecording(true);
      setTranscription("");
      drawRecordingEffect();
      handleToggleAudio();
    } catch (err) {
      console.error("Error starting recording:", err);
      stopRecording();
    } finally {
      setIsInitializing(false);
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (processorRef.current) {
      processorRef.current.port.postMessage({
        cmd: "stop_transcription",
      });
    }

    // Stop the WebWorker
    stopWorker();
    setTranscription("");
    clearCanvas();
    handleToggleAudio();
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSettingChange = (key: keyof typeof settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));

    if (key === "apiKey" && isRecording && processorRef.current) {
      // If API key changes while recording, restart the WebWorker
      startWorker(value);

      processorRef.current.port.postMessage({
        cmd: "update_settings",
        data: { [key]: value },
      });
    }
  };

  // Setup message handler for processor communication
  useEffect(() => {
    if (!processorRef.current) return;
    
    const processedTimestamps = new Set();
    const handleMessage = (event: MessageEvent) => {
      const { cmd, data, text, error, timestamp } = event.data;

      switch (cmd) {
        case "init_worker":
          startWorker(data.apiKey);
          break;

        case "worker_process_audio":
          if (workerRef.current) {
            if (timestamp && processedTimestamps.has(timestamp)) {
              console.log('Skipping duplicate audio chunk');
              return;
            }
            
            if (timestamp) {
              processedTimestamps.add(timestamp);
              if (processedTimestamps.size > 1000) {
                const iterator = processedTimestamps.values();
                processedTimestamps.delete(iterator.next().value);
              }
            }
            
            const audioBuffer = data.buffer || data;
            const clonedBuffer = new ArrayBuffer(audioBuffer.byteLength);
            new Uint8Array(clonedBuffer).set(new Uint8Array(audioBuffer));
            
            workerRef.current.postMessage(
              {
                cmd: "process_audio",
                data: clonedBuffer,
                timestamp
              },
              [clonedBuffer]
            );
          }
          break;

        case "stop_worker":
          stopWorker();
          break;

        case "restart_worker":
          stopWorker();
          startWorker(data.apiKey);
          break;

        case "transcription_result":
          setTranscription(text);
          break;

        case "error":
          console.error("Processor error:", error);
          break;
      }
    };

    processorRef.current.port.addEventListener("message", handleMessage);
    return () => {
      processorRef.current?.port.removeEventListener("message", handleMessage);
    };
  }, [processor]);

  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
      stopWorker();
    };
  }, []);

  useEffect(() => {
    if (isRecording && settings.engine === "webspeech") {
      stopRecording();
      startRecording();
    }
  }, [settings.language]);

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Text to Speech</h2>
          <div className="flex space-x-2">
            <button
              className={`p-2 rounded-lg transition-colors ${
                isInitializing
                  ? "bg-gray-500"
                  : isRecording
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
              onClick={handleToggleRecording}
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

        {/* Visualization Area */}
        <div className="space-y-4">
          <canvas
            ref={canvasRef}
            className="w-full h-32 bg-gray-900 rounded-lg"
            width={1024}
            height={256}
          />
          <div className="bg-gray-100 p-4 rounded-lg h-48 overflow-y-auto">
            <p className="text-gray-800 whitespace-pre-wrap">
              {transcription || "Start speaking to see transcription..."}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        </div>
        <div className="space-y-6">
          {/* Audio device selector */}
          <AudioDeviceSelector
            showMicrophoneSelector={true}
            showSpeakerSelector={true}
            disabled={isRecording}
          />
          
          {/* Divider */}
          <div className="border-t border-gray-200"></div>

          {/* Speech Recognition Engine */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Recognition Engine
            </label>
            <select
              className="w-full p-2 border rounded-lg bg-gray-50"
              value={settings.engine}
              onChange={(e) => handleSettingChange("engine", e.target.value)}
            >
              <option value="assemblyai">AssemblyAI</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {settings.engine === "assemblyai" &&
                "Real-time transcription with high accuracy"}
              {settings.engine === "azure" && "Cloud-based with high accuracy"}
              {settings.engine === "deepspeech" &&
                "Open-source, privacy focused"}
            </p>
          </div>

          {/* API Key Input - 只在选择 AssemblyAI 时显示 */}
          {settings.engine === "assemblyai" && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                AssemblyAI API Key
              </label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => handleSettingChange("apiKey", e.target.value)}
                placeholder="Enter your AssemblyAI API key"
                className="w-full p-2 border rounded-lg bg-gray-50"
              />
            </div>
          )}

          {/* Language Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Language
            </label>
            <select
              className="w-full p-2 border rounded-lg bg-gray-50"
              value={settings.language}
              onChange={(e) => handleSettingChange("language", e.target.value)}
            >
              <option value="en-US">English (US)</option>
            </select>
          </div>

          {/* Model Quality */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Model Quality
            </label>
            <select
              className="w-full p-2 border rounded-lg bg-gray-50"
              value={settings.quality}
              onChange={(e) => handleSettingChange("quality", e.target.value)}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

export default TextToSpeech;
