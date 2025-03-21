import React, { useState, useRef, useContext } from "react";
import { Processor } from "@zoom/videosdk";
import ZoomMediaContext from "../../context/media-context";
import { Settings, Play, Pause, Upload } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";

type ProcessorInfo = {
  processor: Processor;
};

function BypassAudio({ processor }: ProcessorInfo) {
  const { mediaStream } = useContext(ZoomMediaContext);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { audioOn, handleToggleAudio } = useAudio();

  // const m = () => {
  //   mediaStream?.removeProcessor(processor);
  // };

  // const n = () => {
  //   mediaStream?.addProcessor(processor);
  // };

  return (
    <>
      {/* Waveform Section */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Bypass Audio</h2>
          <div className="flex space-x-2">
            <button
              className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors"
              onClick={handleToggleAudio}
            >
              {audioOn ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
            {/* <div onClick={m}>m</div>
            <div onClick={n}>n</div> */}
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="w-full h-48 bg-gray-900 rounded-lg"
        />
      </div>

      {/* Parameters Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Parameters</h2>
        </div>
        <p className="text-gray-600">
          This is a basic bypass processor. Audio passes through without
          modification.
        </p>
      </div>
    </>
  );
}

export default BypassAudio;
