import React, { useState, useRef, useEffect } from "react";
import { Processor } from "@zoom/videosdk";
import { Play, Pause, Loader2 } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";
import AudioDeviceSelector from "../AudioDeviceSelector";
import * as audio from "@mediapipe/tasks-audio";

type ProcessorInfo = {
  processor: Processor;
};

function AudioClassification({ processor }: ProcessorInfo) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [classification, setClassification] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processorRef = useRef<Processor | undefined>();
  const audioClassifierRef = useRef<audio.AudioClassifier | null>(null);
  const classificationTimeoutRef = useRef<number | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const bufferSizeRef = useRef(0);
  const { audioOn, handleToggleAudio } = useAudio();
  processorRef.current = processor;

  // Initialize MediaPipe audio classifier
  useEffect(() => {
    const initializeClassifier = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const audioFileset = await audio.FilesetResolver.forAudioTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0/wasm"
        );

        audioClassifierRef.current =
          await audio.AudioClassifier.createFromOptions(audioFileset, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite",
            },
          });
      } catch (error) {
        console.error("Failed to initialize audio classifier:", error);
        setError("Failed to initialize audio classifier. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    initializeClassifier();
  }, []);

  useEffect(() => {
    if (!processorRef.current) return;

    const handleMessage = async (event: MessageEvent) => {
      if (event.data.cmd === "audio_data" && audioClassifierRef.current) {
        try {
          const audioData = event.data.audioData;

          // Calculate volume
          const rms = Math.sqrt(
            audioData.reduce((acc: number, val: number) => acc + val * val, 0) /
              audioData.length
          );
          setVolume(rms);

          // Draw waveform
          drawAudioData(audioData);

          // Buffer audio data
          audioBufferRef.current.push(audioData);
          bufferSizeRef.current += audioData.length;

          // Process when buffer is large enough (about 1 second of audio)
          if (bufferSizeRef.current >= 48000) {
            // Combine buffers
            const combinedBuffer = new Float32Array(bufferSizeRef.current);
            let offset = 0;
            for (const buffer of audioBufferRef.current) {
              combinedBuffer.set(buffer, offset);
              offset += buffer.length;
            }

            // Perform classification
            const result = audioClassifierRef.current.classify(
              combinedBuffer,
              48000 // Sample rate
            );

            if (result && result[0] && result[0].classifications[0]) {
              const categories = result[0].classifications[0].categories;

              // Debounce classification updates
              if (classificationTimeoutRef.current) {
                window.clearTimeout(classificationTimeoutRef.current);
              }

              classificationTimeoutRef.current = window.setTimeout(() => {
                setClassification(categories[0].categoryName);
                setConfidence(categories[0].score);
              }, 500); // 500ms debounce
            }

            // Clear buffer
            audioBufferRef.current = [];
            bufferSizeRef.current = 0;
          }
        } catch (error) {
          console.error("Classification error:", error);
          setError("Classification error occurred. Please try again.");
        }
      }
    };

    processorRef.current.port.addEventListener("message", handleMessage);
    return () => {
      processorRef.current?.port.removeEventListener("message", handleMessage);
      if (classificationTimeoutRef.current) {
        window.clearTimeout(classificationTimeoutRef.current);
      }
    };
  }, [processor]);

  const handleToggleClassification = async () => {
    if (isLoading) return;

    setIsPlaying(!isPlaying);

    if (!isPlaying) {
      // Start classification
      if (!audioOn) {
        handleToggleAudio();
      }
      processorRef.current?.port.postMessage({
        cmd: "start_classification",
      });
    } else {
      // Stop classification
      processorRef.current?.port.postMessage({
        cmd: "stop_classification",
      });
    }
  };

  // Draw audio waveform
  const drawAudioData = (audioData: Float32Array) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = "rgb(17, 24, 39)";
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
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

    // Draw volume bar
    const barWidth = width * volume;
    ctx.fillStyle = "rgba(0, 200, 200, 0.3)";
    ctx.fillRect(0, height - 4, barWidth, 4);
  };

  return (
    <>
      {/* Visualizer Section */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Audio Classification
          </h2>
          <div className="flex space-x-2">
            <button
              className={`p-2 rounded-lg transition-colors ${
                isLoading
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
              onClick={handleToggleClassification}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="w-full h-48 bg-gray-900 rounded-lg mb-4"
        />
        <div className="bg-gray-100 p-4 rounded-lg">
          {error ? (
            <p className="text-red-600">{error}</p>
          ) : (
            <>
              <p className="text-lg font-semibold text-gray-800">
                Classification:{" "}
                <span className="text-blue-600">
                  {classification || "Not detected"}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                Confidence: {(confidence * 100).toFixed(2)}%
              </p>
              <div className="mt-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Volume</span>
                  <span>{(volume * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1 bg-gray-200 rounded-full mt-1">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-100"
                    style={{ width: `${volume * 100}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Parameters Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Parameters</h2>
        </div>
        <div className="space-y-6">
          {/* Audio device selector */}
          <AudioDeviceSelector
            showMicrophoneSelector={true}
            showSpeakerSelector={true}
            disabled={isLoading || isPlaying}
          />
          
          {/* Feature description */}
          <div className="pt-4 border-t border-gray-200">
            <p className="text-gray-600 mb-4">
              Real-time audio classification using MediaPipe's YAMNet model to
              detect:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>Speech</li>
              <li>Music</li>
              <li>Background noise</li>
              <li>Silence</li>
              <li>And many more audio categories</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export default AudioClassification;
