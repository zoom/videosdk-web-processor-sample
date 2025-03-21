import React, { useMemo } from "react";
import { Settings, Play, Pause, Upload, Download, Sliders } from "lucide-react";
import { Processor } from "@zoom/videosdk";
import classNames from "classnames";
import videoProcessorConfig from "../../config/processor/video";
import { useLoadProcessor } from "../../hooks/useLoadProcessor";
import { useVideo } from "../../hooks/useSelfVideo";
import { useAudio } from "../../hooks/useSelfAudio";

interface VideoProcessorProps {
  id: string;
}

function VideoProcessor({ id }: VideoProcessorProps) {
  const { videoOn, handleToggleVideo, selfVideoRef } = useVideo();
  const processor = useLoadProcessor(id, "video");

  const { audioOn, handleToggleAudio } = useAudio();

  const Cmp = useMemo(() => {
    return videoProcessorConfig[id]?.render || null;
  }, [id]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Preview Section */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Preview</h2>
          <div className="flex space-x-2">
            <button className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
              <Upload className="w-5 h-5 text-gray-600" />
            </button>
            {/* <button className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
              <Download className="w-5 h-5 text-gray-600" />
            </button> */}
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
          </div>
        </div>
        <video-player-container class="w-full aspect-video bg-gray-900 rounded-lg">
          <div
            className={classNames(
              "w-full aspect-video bg-gray-900 rounded-lg",
              { hidden: !videoOn }
            )}
          >
            <video-player
              class="w-full aspect-video bg-gray-900 rounded-lg"
              ref={selfVideoRef}
              style={{
                width: "100%",
                height: "100%",
              }}
            />
          </div>
        </video-player-container>
      </div>

      {/* Controls Section */}
      {processor && Cmp ? (
        <Cmp processor={processor} />
      ) : (
        <p>Loading controls...</p>
      )}
    </div>
  );
}

export default VideoProcessor;
