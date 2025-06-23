import React, { useState, useRef, useEffect } from "react";
import { Mic, Loader2 } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";
import { PitchShiftAudioManager } from "./pitch-shift-main-thread";
import { Processor } from "@zoom/videosdk";

type ProcessorInfo = {
  processor: Processor;
};

function PitchShiftAudioProcessor({ processor }: ProcessorInfo) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [pitchRatio, setPitchRatio] = useState(1.0);
  const formantRatio = 0;
  const dryWet = 0.0;

  const { audioOn, handleToggleAudio, isMuted, handleMuteAudio } = useAudio();

  // audio manager
  const pitchShiftManagerRef = useRef<PitchShiftAudioManager | null>(null);
  const processorRef = useRef<Processor>();

  // playback status
  const [queueStatus, setQueueStatus] = useState({ queueLength: 0, totalSamples: 0 });
  const [isPlaying, setIsPlaying] = useState(false);

  // listen to processor messages
  useEffect(() => {
    processorRef.current = processor;
    if (processorRef.current) {
      console.log(`[PitchShift] Processor loaded: ${processorRef.current.name}`);
      
      // if the audio manager is initialized, connect immediately
      if (pitchShiftManagerRef.current) {
        pitchShiftManagerRef.current.connectToProcessorPort(processorRef.current.port);
      }
    }
  }, [processor]);

  // Monitor audioOn changes
  useEffect(() => {
    console.log(
      `[PitchShift] Audio state changed: audioOn=${audioOn}, isMuted=${isMuted}`
    );
  }, [audioOn, isMuted]);

  // state monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      if (pitchShiftManagerRef.current) {
        const status = pitchShiftManagerRef.current.getQueueStatus();
        const playing = pitchShiftManagerRef.current.isPlaybackActive();
        setQueueStatus(status);
        setIsPlaying(playing);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const startAudio = async () => {
    setIsInitializing(true);

    try {
      console.log("[PitchShift] Starting pitch shift processing...");

      // Start audio if not already on
      if (!audioOn) {
        await handleToggleAudio();
      }

      // Unmute if muted
      if (isMuted) {
        await handleMuteAudio();
      }

      // Initialize PitchShiftAudioManager (only responsible for playback)
      if (!pitchShiftManagerRef.current) {
        pitchShiftManagerRef.current = new PitchShiftAudioManager();
        await pitchShiftManagerRef.current.initialize(48000);
        console.log("[PitchShift] PitchShiftAudioManager initialized");
        
        // connect to the processor port (if the processor exists)
        if (processorRef.current && processorRef.current.port) {
          pitchShiftManagerRef.current.connectToProcessorPort(processorRef.current.port);
        }
      }

      // start processor processing
      if (processorRef.current && processorRef.current.port) {
        // send start command to the processor
        processorRef.current.port.postMessage({
          command: 'start-transmission'
        });
        
        // send initial configuration
        processorRef.current.port.postMessage({
          command: 'update-pitch-shift-config',
          data: {
            pitchRatio: pitchRatio,
            formantRatio: formantRatio,
            dryWet: dryWet,
          }
        });
      }

      // Start pitch shift playback
      pitchShiftManagerRef.current.startPitchShift();

      setIsRecording(true);
      setIsInitializing(false);

      console.log("[PitchShift] ✅ Pitch shift processing started successfully");
    } catch (error) {
      console.error("[PitchShift] ❌ Error starting audio:", error);
      setIsInitializing(false);
      setIsRecording(false);

      // Cleanup on error
      await stopAudio();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      alert(`Failed to start pitch shift processing: ${errorMessage}`);
    }
  };

  const stopAudio = async () => {
    console.log("[PitchShift] Stopping pitch shift processing...");

    try {
      // Stop pitch shift processing
      if (pitchShiftManagerRef.current) {
        pitchShiftManagerRef.current.stopPitchShift();
      }

      // stop the processor
      if (processorRef.current && processorRef.current.port) {
        processorRef.current.port.postMessage({
          command: 'stop-transmission'
        });
      }

      // Mute audio if not already muted
      if (audioOn && !isMuted) {
        await handleMuteAudio();
      }

      setIsRecording(false);
      setIsPlaying(false);
      setQueueStatus({ queueLength: 0, totalSamples: 0 });
      console.log("[PitchShift] ✅ Pitch shift processing stopped successfully");
    } catch (error) {
      console.error("[PitchShift] ❌ Error stopping audio:", error);
      setIsRecording(false);
    }
  };

  const updatePitchShiftConfig = () => {
    if (processorRef.current && processorRef.current.port && isRecording) {
      processorRef.current.port.postMessage({
        command: 'update-pitch-shift-config',
        data: {
          pitchRatio,
          formantRatio,
          dryWet
        }
      });
      console.log(`[PitchShift] Updated config: pitch=${pitchRatio}, formant=${formantRatio}, dryWet=${dryWet}`);
    }
  };

  // Update parameters in real-time
  useEffect(() => {
    updatePitchShiftConfig();
  }, [pitchRatio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopAudio();
      }
      if (pitchShiftManagerRef.current) {
        pitchShiftManagerRef.current.cleanup();
      }
    };
  }, []);

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            🎵 Pitch Shift Audio Processor
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
          className="w-full h-48 bg-gray-900 rounded-lg mb-4"
        />

        {/* status information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="font-semibold text-gray-700">🔄 Processing Status</p>
            <p className="text-gray-600">
              {isRecording ? "🎤 Live Processing" : "⏹️ Idle"}
            </p>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="font-semibold text-gray-700">🔊 Playback Status</p>
            <p className="text-gray-600">
              {isPlaying ? "▶️ Playing" : "⏸️ Stopped"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          🎛️ Pitch Control
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
                  max="2.0"
                  value={pitchRatio}
                  onChange={(e) => setPitchRatio(parseFloat(e.target.value) || 1.0)}
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
                max="2.0"
                step="0.1"
                value={pitchRatio}
                onChange={(e) => setPitchRatio(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                  dark:bg-gray-700 accent-blue-500 hover:accent-blue-600
                  transition-all duration-200"
              />
              <span className="text-sm text-gray-500">2.0</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              1.0 = Original pitch, &gt;1.0 = Higher pitch, &lt;1.0 = Lower pitch
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            🎯 <strong>Real-time Processing:</strong> Adjust the pitch ratio to transform your voice in real-time.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            ✨ <strong>Usage:</strong> Perfect for voice effects, music production, and creative audio applications.
          </p>
        </div>
      </div>
    </>
  );
}

export default PitchShiftAudioProcessor;
