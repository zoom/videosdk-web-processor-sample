import React, { useState, useRef, useContext, useEffect } from "react";
import ZoomMediaContext from "../../context/media-context";
import { Mic, Loader2, Upload, Play, Download } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";
import { Processor } from "@zoom/videosdk";

type ProcessorInfo = {
  processor: Processor;
};

function PitchShiftAudioProcessor({ processor }: ProcessorInfo) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [pitchRatio, setPitchRatio] = useState<number>(1.5);
  const [formantRatio, setFormantRatio] = useState<number>(1.2);
  const [dryWet, setDryWet] = useState<number>(0.0);

  const { audioOn, handleToggleAudio } = useAudio();
  const processorRef = useRef<Processor>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferQueueRef = useRef<Float32Array[]>([]);
  const playbackTimerRef = useRef<number | null>(null);
  const playbackInterval = 150;
  const maxQueueLength = 50;

  const channels = 2;
  const sampleRate = 48000;
  const batchSize = 1024;
  const chunkSeconds = batchSize;
  let playTime = 0;
  const queue: Float32Array<any>[] = [];

  useEffect(() => {
    processorRef.current = processor;
    if (processorRef.current) {
      console.log(`processor loaded: ${processorRef.current.name}`);
      const messageHandler = (event: MessageEvent) => {
        if (event.data) {
          if (event.data.command === "preview") {
            if (event.data.data) {
              const audioData = new Float32Array(event.data.data); // received the message of recording completed and audio data
              queue.push(audioData);
              scheduleChunks();
            }
          }
        }
      };

      processorRef.current.port.addEventListener("message", messageHandler);

      return () => {
        if (processorRef.current?.port) {
          processorRef.current.port.removeEventListener(
            "message",
            messageHandler
          );
        }
      };
    }
  }, [processor]);

  const startRecording = async () => {
    try {
      setIsInitializing(true);
      setIsRecording(true);

      // Start Zoom audio
      if (!audioOn) {
        handleToggleAudio();
        startPlaybackTimer();
      }

      // Ensure AudioContext exists
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate });
        // playTime = audioContextRef.current.currentTime + 0.1;
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
    setIsRecording(false);
    if (audioOn) {
      handleToggleAudio();
      stopPlaybackTimer();
    }

    // Stop playback timer
    stopPlaybackTimer();

    // Clear buffer queue
    audioBufferQueueRef.current = [];

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current
        .close()
        .catch((err) => console.error("Failed to close AudioContext:", err));
      audioContextRef.current = null;
    }
  };

  const handleParameterChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    value: string,
    paramName: "pitchRatio" | "formantRatio" | "dryWet"
  ) => {
    const floatValue = parseFloat(value);
    if (!isNaN(floatValue)) {
      setter(floatValue);

      const newConfig = {
        pitchRatio: paramName === "pitchRatio" ? floatValue : pitchRatio,
        formantRatio: paramName === "formantRatio" ? floatValue : formantRatio,
        dryWet: paramName === "dryWet" ? floatValue : dryWet,
      };

      if (processor?.port) {
        processor.port.postMessage({
          command: "update-pitch-shift-config",
          config: newConfig,
        });
      }
    }
  };

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
      (sum, buffer) => sum + buffer.length,
      0
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
        audioContext
          .resume()
          .catch((err) => console.error("Failed to resume AudioContext:", err));
      }

      // Create mono buffer
      const audioBuffer = audioContext.createBuffer(
        1,
        audioData.length,
        sampleRate
      );
      audioBuffer.copyToChannel(audioData, 0);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error("Error playing audio data:", error);
    }
  };

  const scheduleChunks = () => {
    while (queue.length) {
      const buf = queue.shift();
      if (buf) {
        const frameCount = buf.length / channels;
        const audioBuffer = audioContextRef?.current?.createBuffer(
          channels,
          frameCount,
          sampleRate
        );
        if (audioBuffer) {
          for (let ch = 0; ch < channels; ch++) {
            const channelData = audioBuffer.getChannelData(ch);
            for (let i = 0; i < frameCount; i++) {
              channelData[i] = buf[i * channels + ch];
            }
          }

          if (audioContextRef?.current) {
            const src = audioContextRef.current.createBufferSource();
            if (src) {
              src.buffer = audioBuffer;
              src.connect(audioContextRef.current.destination);
              src.start(playTime);
              playTime += chunkSeconds;
            }
          }
        }
      }
    }
  };

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Pitch Shift Audio Processor
          </h2>
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
        <canvas
          ref={canvasRef}
          className="w-full h-48 bg-gray-900 rounded-lg"
        />
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Configuration Panel
        </h2>
        <div className="space-y-6">
          {/* Pitch Ratio Control */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">
                Pitch Ratio
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="2.0"
                  value={pitchRatio}
                  onChange={(e) =>
                    handleParameterChange(
                      setPitchRatio,
                      e.target.value,
                      "pitchRatio"
                    )
                  }
                  className="w-20 px-2 py-1 text-right rounded-md border border-gray-300 
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">0.0</span>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.1"
                value={pitchRatio}
                onChange={(e) =>
                  handleParameterChange(
                    setPitchRatio,
                    e.target.value,
                    "pitchRatio"
                  )
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                  dark:bg-gray-700 accent-blue-500 hover:accent-blue-600
                  transition-all duration-200"
              />
              <span className="text-sm text-gray-500">2.0</span>
            </div>
          </div>

          {/* Formant Ratio Control */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">
                Formant Ratio
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="2.0"
                  value={formantRatio}
                  onChange={(e) =>
                    handleParameterChange(
                      setFormantRatio,
                      e.target.value,
                      "formantRatio"
                    )
                  }
                  className="w-20 px-2 py-1 text-right rounded-md border border-gray-300 
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">0.0</span>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.1"
                value={formantRatio}
                onChange={(e) =>
                  handleParameterChange(
                    setFormantRatio,
                    e.target.value,
                    "formantRatio"
                  )
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                  dark:bg-gray-700 accent-blue-500 hover:accent-blue-600
                  transition-all duration-200"
              />
              <span className="text-sm text-gray-500">2.0</span>
            </div>
          </div>

          {/* Dry/Wet Control */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">
                Dry/Wet Mix
              </label>
              <div className="flex items-center">
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="1.0"
                  value={dryWet}
                  onChange={(e) =>
                    handleParameterChange(setDryWet, e.target.value, "dryWet")
                  }
                  className="w-20 px-2 py-1 text-right rounded-md border border-gray-300 
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">0.0</span>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.1"
                value={dryWet}
                onChange={(e) =>
                  handleParameterChange(setDryWet, e.target.value, "dryWet")
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                  dark:bg-gray-700 accent-blue-500 hover:accent-blue-600
                  transition-all duration-200"
              />
              <span className="text-sm text-gray-500">1.0</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Adjust the configuration to modify the voice pitch, formant and
            dry/wet. Higher pitch ratio values make the voice higher, lower
            values make it deeper.
          </p>
        </div>
      </div>
    </>
  );
}

export default PitchShiftAudioProcessor;
