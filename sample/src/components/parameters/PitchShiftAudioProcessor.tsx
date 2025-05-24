import React, { useState, useRef, useContext, useEffect } from "react";
import ZoomMediaContext from "../../context/media-context";
import { Mic, Loader2, Upload, Play, Download } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";
import { Processor } from "@zoom/videosdk";
import { set } from "immer/dist/internal";

type ProcessorInfo = {
  processor: Processor;
};

function PitchShiftAudioProcessor({ processor }: ProcessorInfo) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const stopRecording = () => {
    // setIsRecording(false);
    // isRecordingRef.current = false;

    // // Stop Zoom audio
    // if (audioOn) {
    //   if (processor && processor.port) {
    //     processor.port.postMessage({
    //       command: "stop",
    //     });
    //   }
    //   handleToggleAudio();
    // }
  };

  const startRecording = async () => {
    // setIsRecording(true);
    // isRecordingRef.current = true;
    // setRemainingTime(maxDuration);

    // // clear the previous recording data
    // setRecordedBlob(null);
    // setAudioUrl(null);

    // // Start Zoom audio
    // if (!audioOn) {
    //   if (processor && processor.port) {
    //     processor.port.postMessage({
    //       command: "start",
    //       config: {
    //         sampleRate: selectedSampleRate,
    //         numChannels: 2,
    //         audioFormat: selectedFormat,
    //         volumeThreshold: volumeThreshold,
    //       },
    //     });
    //   }
    //   handleToggleAudio();
    // }
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
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Parameters</h2>
      </div>
    </>
  );
}

export default PitchShiftAudioProcessor;
