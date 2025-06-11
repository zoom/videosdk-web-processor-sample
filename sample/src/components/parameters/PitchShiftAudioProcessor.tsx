import React, { useState, useRef, useEffect } from "react";
import { Mic, Loader2 } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";
import { Processor } from "@zoom/videosdk";

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

  // Direct audio graph references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Audio parameters
  const sampleRate = 48000;

  // Monitor audioOn changes
  useEffect(() => {
    console.log(
      `[Main] Audio state changed: audioOn=${audioOn}, isMuted=${isMuted}`
    );
  }, [audioOn, isMuted]);

  const updateProcessorConfig = (config: {
    pitchRatio?: number;
    formantRatio?: number;
    dryWet?: number;
  }) => {
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({
        command: "update-config",
        data: config,
      });
      console.log("[Main] Config sent to processor:", config);
    }
  };

  const startAudio = async () => {
    setIsInitializing(true);

    try {
      console.log("[Main] Starting direct audio graph processing...");

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
        console.log("[Main] AudioContext created and resumed");
      }

      // Get microphone stream
      if (!mediaStreamRef.current) {
        console.log("[Main] Requesting microphone access...");
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: sampleRate,
            channelCount: 2,
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
          },
        });
        console.log("[Main] Microphone access granted");
      }

      // Load AudioWorklet processor
      console.log("[Main] Loading AudioWorklet processor...");
      await audioCtxRef.current.audioWorklet.addModule(
        "/lib/processors/audio/pitch-shift-processor.js"
      );

      // Create worklet node
      workletNodeRef.current = new AudioWorkletNode(
        audioCtxRef.current,
        "pitch-shift-processor"
      );
      console.log("[Main] AudioWorkletNode created");

      // Create microphone source
      micSourceRef.current = audioCtxRef.current.createMediaStreamSource(
        mediaStreamRef.current
      );
      console.log("[Main] MediaStreamSource created");

      // Connect the audio graph: microphone -> worklet -> speakers
      micSourceRef.current.connect(workletNodeRef.current);
      workletNodeRef.current.connect(audioCtxRef.current.destination);
      console.log(
        "[Main] Audio graph connected: Microphone → PitchShiftWorklet → Speakers"
      );

      // Send initial configuration to processor
      updateProcessorConfig({ pitchRatio, formantRatio, dryWet });

      setIsRecording(true);
      setIsInitializing(false);

      console.log("[Main] ✅ Direct audio processing started successfully");
    } catch (error) {
      console.error("[Main] ❌ Error starting audio:", error);
      setIsInitializing(false);
      setIsRecording(false);

      // Cleanup on error
      await stopAudio();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(`Failed to start audio processing: ${errorMessage}`);
    }
  };

  const stopAudio = async () => {
    console.log("[Main] Stopping direct audio processing...");

    try {
      // Disconnect audio graph
      if (micSourceRef.current) {
        micSourceRef.current.disconnect();
        micSourceRef.current = null;
        console.log("[Main] Microphone source disconnected");
      }

      if (workletNodeRef.current) {
        workletNodeRef.current.disconnect();
        workletNodeRef.current = null;
        console.log("[Main] AudioWorklet node disconnected");
      }

      // Stop media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        console.log("[Main] Media stream stopped");
      }

      // Close audio context
      if (audioCtxRef.current) {
        await audioCtxRef.current.close();
        audioCtxRef.current = null;
        console.log("[Main] AudioContext closed");
      }

      // Mute audio if not already muted
      if (audioOn && !isMuted) {
        await handleMuteAudio();
      }

      setIsRecording(false);
      console.log("[Main] ✅ Direct audio processing stopped successfully");
    } catch (error) {
      console.error("[Main] ❌ Error stopping audio:", error);
      setIsRecording(false);
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

    // Update processor configuration in real-time
    const config = { [paramName]: v };
    updateProcessorConfig(config);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopAudio();
      }
    };
  }, []);

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            🎵 Direct Audio Graph Pitch Shifter
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
            <strong>🔄 Processing Mode:</strong> Direct Audio Graph (Zero Buffer
            Transfer)
          </p>
          <p>
            <strong>📊 Status:</strong>{" "}
            {isRecording ? "🎤 Live Processing" : "⏹️ Idle"}
          </p>
          <p>
            <strong>🔗 Signal Path:</strong> Microphone → AudioWorklet →
            Speakers
          </p>
          <p>
            <strong>⚡ Latency:</strong> Ultra-low (native Web Audio timing)
          </p>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          🎛️ Real-time Controls
        </h2>
        <div className="space-y-6">
          {/* Pitch Ratio Control */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">
                🎵 Pitch Ratio
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
                🗣️ Formant Ratio
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
                🌊 Dry/Wet Mix
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
            🎯 <strong>Direct Audio Graph:</strong> All processing happens in
            the Web Audio pipeline without data transfer between threads.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            ✨ <strong>Benefits:</strong> Zero-latency processing, smooth audio
            continuity, instant parameter changes, no buffer discontinuities.
          </p>
        </div>
      </div>
    </>
  );
}

export default PitchShiftAudioProcessor;
