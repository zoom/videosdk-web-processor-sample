import React, { useState, useRef, useEffect } from "react";
import { Mic, Loader2, Volume2, VolumeX } from "lucide-react";
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
  const [pitchRatio, setPitchRatio] = useState(1.0); // 默认原声
  const [formantRatio, setFormantRatio] = useState(0);
  const [dryWet, setDryWet] = useState(0.0); // 默认完全干声（原声）

  const { audioOn, handleToggleAudio, isMuted, handleMuteAudio } = useAudio();

  // 播放管理器
  const pitchShiftManagerRef = useRef<PitchShiftAudioManager | null>(null);
  const processorRef = useRef<Processor>();

  // 播放状态
  const [queueStatus, setQueueStatus] = useState({ queueLength: 0, totalSamples: 0 });
  const [isPlaying, setIsPlaying] = useState(false);

  // 监听处理器消息
  useEffect(() => {
    processorRef.current = processor;
    if (processorRef.current) {
      console.log(`[PitchShift] Processor loaded: ${processorRef.current.name}`);
      
      // 如果播放管理器已初始化，立即连接
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

  // 状态监控
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

      // Initialize PitchShiftAudioManager (只负责播放)
      if (!pitchShiftManagerRef.current) {
        pitchShiftManagerRef.current = new PitchShiftAudioManager();
        await pitchShiftManagerRef.current.initialize(48000);
        console.log("[PitchShift] PitchShiftAudioManager initialized");
        
        // 连接到处理器端口（如果处理器已存在）
        if (processorRef.current && processorRef.current.port) {
          pitchShiftManagerRef.current.connectToProcessorPort(processorRef.current.port);
        }
      }

      // 启动处理器处理
      if (processorRef.current && processorRef.current.port) {
        // 发送启动命令给处理器
        processorRef.current.port.postMessage({
          command: 'start-transmission'
        });
        
        // 发送初始配置
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

      // 停止处理器
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

  const startPreview = () => {
    if (pitchShiftManagerRef.current) {
      pitchShiftManagerRef.current.startPreview();
    }
  };

  const stopPreview = () => {
    if (pitchShiftManagerRef.current) {
      pitchShiftManagerRef.current.stopPreview();
    }
  };

  // Update parameters in real-time
  useEffect(() => {
    updatePitchShiftConfig();
  }, [pitchRatio, formantRatio, dryWet]);

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
            
            {/* 预览播放按钮 */}
            <button
              className={`p-2 rounded-lg transition-colors ${
                isPlaying 
                  ? "bg-orange-500 hover:bg-orange-600" 
                  : "bg-green-500 hover:bg-green-600"
              }`}
              onClick={isPlaying ? stopPreview : startPreview}
              disabled={!isRecording}
              title={isPlaying ? "Stop Preview" : "Start Preview"}
            >
              {isPlaying ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          className="w-full h-48 bg-gray-900 rounded-lg mb-4"
        />

        {/* 状态信息 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="font-semibold text-gray-700">📊 Buffer Queue</p>
            <p className="text-gray-600">
              {queueStatus.queueLength} bufs, {queueStatus.totalSamples} samples
            </p>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>
            <strong>🔗 Signal Path:</strong> Framework Processor → PlaybackManager → Speakers
          </p>
          <p>
            <strong>⚡ Features:</strong> Framework integration, real-time processing, smooth playback, buffer management
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
                max="4.0"
                step="0.1"
                value={pitchRatio}
                onChange={(e) => setPitchRatio(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                  dark:bg-gray-700 accent-blue-500 hover:accent-blue-600
                  transition-all duration-200"
              />
              <span className="text-sm text-gray-500">4.0</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              1.0 = Original pitch, &gt;1.0 = Higher pitch, &lt;1.0 = Lower pitch
            </p>
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
                  min="0"
                  max="2.0"
                  value={formantRatio}
                  onChange={(e) => setFormantRatio(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-right rounded-md border border-gray-300 
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">0</span>
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.1"
                value={formantRatio}
                onChange={(e) => setFormantRatio(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                  dark:bg-gray-700 accent-green-500 hover:accent-green-600
                  transition-all duration-200"
              />
              <span className="text-sm text-gray-500">2.0</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Controls vocal character preservation (0 = disabled)
            </p>
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
                  onChange={(e) => setDryWet(parseFloat(e.target.value) || 0)}
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
                onChange={(e) => setDryWet(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                  dark:bg-gray-700 accent-purple-500 hover:accent-purple-600
                  transition-all duration-200"
              />
              <span className="text-sm text-gray-500">1.0</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              0.0 = Original only, 1.0 = Processed only
            </p>
          </div>
        </div>

        {/* 性能信息 */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">🚀 Performance Info</h3>
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
            <div>
              <p><strong>Processor:</strong> {processorRef.current?.name || 'Not loaded'}</p>
              <p><strong>Queue Length:</strong> {queueStatus.queueLength} buffers</p>
            </div>
            <div>
              <p><strong>Processing:</strong> {isRecording ? 'Active' : 'Inactive'}</p>
              <p><strong>Playback:</strong> {isPlaying ? 'Active' : 'Inactive'}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            🎯 <strong>Framework Integration:</strong> Uses provided processor instance for seamless audio processing.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            ✨ <strong>Benefits:</strong> Zero latency, framework optimized, real-time parameter updates, professional quality.
          </p>
        </div>
      </div>
    </>
  );
}

export default PitchShiftAudioProcessor;
