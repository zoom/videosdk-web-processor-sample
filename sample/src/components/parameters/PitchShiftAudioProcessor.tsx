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
  const [dryWet, setDryWet] = useState(0.0);

  const { audioOn, handleToggleAudio, isMuted, handleMuteAudio } = useAudio();
  const processorRef = useRef<Processor>();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isSabSupportedRef = useRef(isSharedArrayBufferSupported());
  const ringBufferRef = useRef<RingBuffer | null>(null);
  const modeRef = useRef(0); // 0: non-sab, 1: sab
  const scheduleTimerRef = useRef(-1);

  // unified queue and playback time refs
  const queueRef = useRef<Float32Array[]>([]);
  const playTimeRef = useRef(0);
  const chunkFrames = 1024;

  const channels = 2;
  const sampleRate = 48000;
  const batchSize = 1024;
  const chunkSeconds = batchSize / sampleRate;
  const capacitySeconds = 5;
  const frameCapacity = sampleRate * capacitySeconds;
  const intervalMs = (chunkFrames / sampleRate) * 1000;

  useEffect(() => {
    console.log(
      `audioOn state changed observed: ${audioOn}, isMuted state change observed: ${isMuted}`
    );

    // if (processorRef.current) {
    //   processorRef.current.port.postMessage({
    //     command: "audio-state-changed",
    //     data: {
    //       audioOn: audioOn,
    //       isMuted: isMuted,
    //     },
    //   });
    // }
  }, [audioOn, isMuted]);

  useEffect(() => {
    processorRef.current = processor;
    if (!processorRef.current) return;

    // message handler: push into unified queue and schedule
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.command === "preview" && event.data.data) {
        const audioData = new Float32Array(event.data.data);
        queueRef.current.push(audioData);
        scheduleChunks();
      }
    };

    const port = processorRef.current.port;
    port.addEventListener("message", messageHandler);

    modeRef.current = isSabSupportedRef.current ? 1 : 0;
    port.postMessage({
      command: "init-processor",
      data: {
        mode: modeRef.current,
      },
    });

    return () => {
      port.removeEventListener("message", messageHandler);
    };
  }, [processor]);

  const startAudio = async () => {
    setIsInitializing(true);
    setIsRecording(true);

    if (!audioOn) {
      await handleToggleAudio();

      if (isSabSupportedRef.current) {
        if (!ringBufferRef.current) {
          // create ring buffer
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
      }
    }

    if (isMuted) {
      await handleMuteAudio();
    }

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ sampleRate });
      await audioCtxRef.current.resume();
      // initial playTime 100ms ahead
      playTimeRef.current = audioCtxRef.current.currentTime + 0.1;
    }

    setIsInitializing(false);

    // if using shared array buffer, start scheduling from ring buffer to read audio data
    if (modeRef.current === 1) {
      scheduleFromRing();
    }

    // notify processor unmuted state
    processorRef.current?.port.postMessage({
      command: "audio-state-changed",
      data: {
        audioOn: audioOn,
        isMuted: isMuted,
      },
    });
  };

  const stopAudio = async () => {
    setIsRecording(false);

    if (audioOn && !isMuted) {
      await handleMuteAudio();
    }

    queueRef.current = [];
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(console.error);
      audioCtxRef.current = null;
    }

    if (scheduleTimerRef.current !== -1) {
      clearInterval(scheduleTimerRef.current);
      scheduleTimerRef.current = -1;
    }

    // notify processor unmuted state
    processorRef.current?.port.postMessage({
      command: "audio-state-changed",
      data: {
        audioOn: audioOn,
        isMuted: isMuted,
      },
    });
  };

  const scheduleFromRing = () => {
    if (scheduleTimerRef.current == -1) {
      const timerId = setInterval(scheduleFromRing, intervalMs);
      scheduleTimerRef.current = timerId;
    }

    if (!ringBufferRef.current || !audioCtxRef.current) return;

    const data = ringBufferRef.current?.read(chunkFrames);
    if (!data || data.length === 0) return;

    const frameCount = data.length / channels;
    const buffer = audioCtxRef.current?.createBuffer(
      channels,
      frameCount,
      sampleRate
    );
    if (!buffer) return;

    for (let ch = 0; ch < channels; ch++) {
      const chArr = buffer.getChannelData(ch);
      for (let i = 0; i < frameCount; i++) {
        chArr[i] = data[i * channels + ch];
      }
    }

    const src = audioCtxRef.current?.createBufferSource();
    if (src) {
      src.buffer = buffer;
      src.connect(audioCtxRef.current?.destination);
      src.start(playTimeRef.current);
      playTimeRef.current += frameCount / sampleRate;
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
    const config = {
      pitchRatio: paramName === "pitchRatio" ? v : pitchRatio,
      formantRatio: paramName === "formantRatio" ? v : formantRatio,
      dryWet: paramName === "dryWet" ? v : dryWet,
    };
    processorRef.current?.port.postMessage({
      command: "update-pitch-shift-config",
      data: config,
    });
  };

  // unified scheduling: one function
  const scheduleChunks = () => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) return;
    // ensure context running
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(console.error);
      playTimeRef.current = audioCtx.currentTime + 0.1;
    }

    while (queueRef.current.length) {
      const buf = queueRef.current.shift()!;
      const frameCount = buf.length / channels;
      const audioBuffer = audioCtx.createBuffer(
        channels,
        frameCount,
        audioCtx.sampleRate
      );
      for (let ch = 0; ch < channels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = buf[i * channels + ch];
        }
      }
      const src = audioCtx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(audioCtx.destination);
      src.start(playTimeRef.current);
      playTimeRef.current += chunkSeconds;
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
