import React, { useState, useRef, useContext, useEffect } from "react";
import ZoomMediaContext from "../../context/media-context";
import { Mic, Loader2, Upload, Play, Download } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";
import { isSharedArrayBufferSupported } from "../../utils/util";
import { Processor } from "@zoom/videosdk";
import { RingBuffer } from "@zoom/web-media-lib";

type ProcessorInfo = {
  processor: Processor;
};

function PitchShiftAudioProcessor({ processor }: ProcessorInfo) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [pitchRatio, setPitchRatio] = useState(1.5);
  const [formantRatio, setFormantRatio] = useState(1.2);
  const [dryWet, setDryWet] = useState(0.7);

  const { audioOn, handleToggleAudio, isMuted, handleMuteAudio } = useAudio();
  const processorRef = useRef<Processor>();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isSabSupportedRef = useRef(isSharedArrayBufferSupported());
  const ringBufferRef = useRef<RingBuffer | null>(null);
  const modeRef = useRef(0); // 0: non-sab, 1: sab
  const isRecordingRef = useRef(false);

  // Playback management
  const playTimeRef = useRef(0);
  const queueRef = useRef<Float32Array[]>([]);
  const scheduleTimerRef = useRef<number>(-1);
  const isPlaybackActiveRef = useRef(false);

  // Audio parameters
  const channels = 2;
  const sampleRate = 48000;
  const capacitySeconds = 10;
  const frameCapacity = sampleRate * capacitySeconds;
  const initialBufferDelayMs = 200; // Small initial delay for smooth start

  // Monitor audioOn changes
  useEffect(() => {
    console.log(
      `[Main] Audio state changed: audioOn=${audioOn}, isMuted=${isMuted}`
    );
  }, [audioOn, isMuted]);

  // Initialize processor and setup message handling
  useEffect(() => {
    processorRef.current = processor;
    if (!processorRef.current) return;

    console.log("[Main] Setting up processor");

    // Setup message handler for non-SAB mode
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.command === "preview" && event.data.data) {
        const audioData = new Float32Array(event.data.data);
        queueRef.current.push(audioData);

        // Start playback if not already active
        if (!isPlaybackActiveRef.current) {
          startPlayback();
        }
      }
    };

    const port = processorRef.current.port;
    port.addEventListener("message", messageHandler);

    // Determine mode and initialize processor
    modeRef.current = isSabSupportedRef.current ? 1 : 0;
    console.log(`[Main] Initializing processor with mode: ${modeRef.current}`);

    port.postMessage({
      command: "init-processor",
      data: {
        mode: modeRef.current,
        sampleRate: sampleRate,
      },
    });

    // Send initial configuration
    port.postMessage({
      command: "update-pitch-shift-config",
      data: {
        pitchRatio,
        formantRatio,
        dryWet,
      },
    });

    return () => {
      port.removeEventListener("message", messageHandler);
    };
  }, [processor, pitchRatio, formantRatio, dryWet]);

  const startPlayback = () => {
    if (isPlaybackActiveRef.current || !audioCtxRef.current) return;

    console.log("[Main] Starting playback");
    isPlaybackActiveRef.current = true;

    // Set initial playback time
    playTimeRef.current =
      audioCtxRef.current.currentTime + initialBufferDelayMs / 1000;

    if (modeRef.current === 1) {
      // SAB mode: schedule from RingBuffer
      scheduleFromRingBuffer();
    } else {
      // Non-SAB mode: schedule from queue
      scheduleFromQueue();
    }
  };

  const stopPlayback = () => {
    console.log("[Main] Stopping playback");
    isPlaybackActiveRef.current = false;
    queueRef.current = [];

    if (scheduleTimerRef.current !== -1) {
      clearTimeout(scheduleTimerRef.current);
      scheduleTimerRef.current = -1;
    }
  };

  const scheduleFromRingBuffer = () => {
    if (
      !isPlaybackActiveRef.current ||
      !audioCtxRef.current ||
      !ringBufferRef.current
    ) {
      return;
    }

    const chunkFrames = 2048; // Larger chunks for stability
    const availableFrames = ringBufferRef.current.availableRead();

    if (availableFrames >= chunkFrames) {
      const data = ringBufferRef.current.read(chunkFrames);
      if (data && data.length > 0) {
        playAudioChunk(data);
      }
    }

    // Schedule next check
    const nextCheckMs = (chunkFrames / sampleRate) * 500; // Check twice as often as chunk duration
    scheduleTimerRef.current = window.setTimeout(
      scheduleFromRingBuffer,
      nextCheckMs
    );
  };

  const scheduleFromQueue = () => {
    if (!isPlaybackActiveRef.current || !audioCtxRef.current) {
      return;
    }

    // Process all available chunks in queue
    while (queueRef.current.length > 0 && isPlaybackActiveRef.current) {
      const chunk = queueRef.current.shift();
      if (chunk) {
        playAudioChunk(chunk);
      }
    }

    // Schedule next check
    scheduleTimerRef.current = window.setTimeout(scheduleFromQueue, 10);
  };

  const playAudioChunk = (audioData: Float32Array) => {
    if (!audioCtxRef.current || !isPlaybackActiveRef.current) return;

    const frameCount = audioData.length / channels;
    const buffer = audioCtxRef.current.createBuffer(
      channels,
      frameCount,
      sampleRate
    );

    // De-interleave data into channels
    for (let ch = 0; ch < channels; ch++) {
      const channelData = buffer.getChannelData(ch);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = audioData[i * channels + ch];
      }
    }

    const sourceNode = audioCtxRef.current.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.connect(audioCtxRef.current.destination);

    // Ensure playTime doesn't fall behind
    const currentTime = audioCtxRef.current.currentTime;
    if (playTimeRef.current < currentTime) {
      playTimeRef.current = currentTime + 0.01; // Small buffer
    }

    sourceNode.start(playTimeRef.current);
    playTimeRef.current += frameCount / sampleRate;
  };

  const startAudio = async () => {
    setIsRecording(true);
    isRecordingRef.current = true;
    setIsInitializing(true);

    try {
      // Start audio if not already on
      if (!audioOn) {
        await handleToggleAudio();
      }

      // Unmute if muted
      if (isMuted) {
        await handleMuteAudio();
      }

      // Create audio context
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext({ sampleRate });
        await audioCtxRef.current.resume();
      }

      // Setup RingBuffer for SAB mode
      if (modeRef.current === 1 && !ringBufferRef.current) {
        ringBufferRef.current = RingBuffer.create(frameCapacity, channels);

        if (processorRef.current) {
          const port = processorRef.current.port;
          port.postMessage({
            command: "attach-ring-buffer",
            data: {
              sab: ringBufferRef.current.sharedArrayBuffer,
              frameCapacity: frameCapacity,
              channelCount: channels,
            },
          });
        }
      }

      // Reset playback state
      stopPlayback();

      setIsInitializing(false);
      console.log("[Main] Audio started successfully");

      // Notify processor of audio state
      if (processorRef.current) {
        processorRef.current.port.postMessage({
          command: "audio-state-changed",
          data: {
            audioOn: true,
            isMuted: false,
          },
        });
      }

      // For SAB mode, start playback immediately
      if (modeRef.current === 1) {
        setTimeout(() => {
          if (isRecordingRef.current) {
            startPlayback();
          }
        }, 300);
      }
    } catch (error) {
      console.error("[Main] Error starting audio:", error);
      setIsInitializing(false);
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const stopAudio = async () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    stopPlayback();

    try {
      // Notify processor to stop processing
      if (processorRef.current) {
        processorRef.current.port.postMessage({
          command: "audio-state-changed",
          data: {
            audioOn: false,
            isMuted: true,
          },
        });
      }

      // Mute audio if not already muted
      if (audioOn && !isMuted) {
        await handleMuteAudio();
      }

      // Close audio context
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(console.error);
        audioCtxRef.current = null;
      }

      console.log("[Main] Audio stopped successfully");
    } catch (error) {
      console.error("[Main] Error stopping audio:", error);
    }
  };

  const handleParameterChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    value: string,
    paramName: "pitchRatio" | "formantRatio" | "dryWet"
  ) => {
    const v = parseFloat(value);
    if (isNaN(v)) return;

    setter(v);

    // Update processor configuration
    if (processorRef.current) {
      const config = {
        pitchRatio: paramName === "pitchRatio" ? v : pitchRatio,
        formantRatio: paramName === "formantRatio" ? v : formantRatio,
        dryWet: paramName === "dryWet" ? v : dryWet,
      };

      processorRef.current.port.postMessage({
        command: "update-pitch-shift-config",
        data: config,
      });
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
              onClick={isRecording ? stopAudio : startAudio}
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
        <div className="mt-4 text-sm text-gray-600">
          <p>
            <strong>Mode:</strong>{" "}
            {modeRef.current === 1
              ? "SharedArrayBuffer (Low Latency)"
              : "PostMessage (Compatible)"}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            {isRecording
              ? isPlaybackActiveRef.current
                ? "Recording & Playing"
                : "Recording"
              : "Idle"}
          </p>
          {modeRef.current === 1 && ringBufferRef.current && (
            <p>
              <strong>Buffer:</strong> {ringBufferRef.current.availableRead()}{" "}
              frames available
            </p>
          )}
        </div>
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
                  min="0.25"
                  max="4.0"
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
              <span className="text-sm text-gray-500">0.25</span>
              <input
                type="range"
                min="0.25"
                max="4.0"
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
              <span className="text-sm text-gray-500">4.0</span>
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
                  min="0.25"
                  max="4.0"
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
              <span className="text-sm text-gray-500">0.25</span>
              <input
                type="range"
                min="0.25"
                max="4.0"
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
              <span className="text-sm text-gray-500">4.0</span>
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
            dry/wet mix. Higher pitch ratio values make the voice higher, lower
            values make it deeper.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            <strong>Enhanced Version:</strong> Improved audio quality with
            advanced pitch shifting algorithm and intelligent buffering.
          </p>
        </div>
      </div>
    </>
  );
}

export default PitchShiftAudioProcessor;
