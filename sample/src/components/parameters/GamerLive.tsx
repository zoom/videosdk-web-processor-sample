import React, { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
import { Processor } from "@zoom/videosdk";
import { loadImageBitmap } from "../../utils/util";

type ProcessorInfo = {
  processor: Processor;
};

function GamerLive({ processor }: ProcessorInfo) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement>(null);

  const [parameters, setParameters] = useState({
    shape: "ellipse",
    scaleFactor: 1.0,
    useAngle: false,
    zoomVideo: false,
  });

  const processorRef = useRef<Processor | undefined>();
  processorRef.current = processor;

  const handleParameterChange = (
    param: keyof typeof parameters,
    value: string | number | boolean
  ) => {
    setParameters((prev) => ({ ...prev, [param]: value }));
  };

  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.port.postMessage({
        cmd: "update_options",
        data: {
          croppingShape: parameters.shape === "ellipse" ? 1 : 0,
          scaleFactor: parameters.scaleFactor,
          useAngle: parameters.useAngle,
          zoomVideo: parameters.zoomVideo,
        },
      });
    }
  }, [parameters]);

  useEffect(() => {
    const initProcessor = async () => {
      const imageBitmap = await loadImageBitmap("/moon.jpg");
      console.log("Updating mask background image:", imageBitmap);
      processor.port.postMessage({
        cmd: "update_mask_background_image",
        data: imageBitmap,
      });
    };
    if (processor) {
      initProcessor();
    }
  }, [processor]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!processorRef.current) {
      console.error("Processor is not initialized");
      return;
    }
    
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. create local URL for the video file and load to the hidden video element
    const videoUrl = URL.createObjectURL(file);
    const hiddenVideo = hiddenVideoRef.current!;
    hiddenVideo.src = videoUrl;
    await hiddenVideo.play();
  
    // 2. create a canvas element to capture frames
    const offscreen = new OffscreenCanvas(hiddenVideo.videoWidth, hiddenVideo.videoHeight);
    const ctx = offscreen.getContext('2d')!;
    if (!ctx) return;
    
    // 3. draw & transfer the frame to the processor
    const loop = () => {
      ctx.drawImage(hiddenVideo, 0, 0);
      const bitmap = offscreen.transferToImageBitmap();

      // 4. send the bitmap to the processor
      processorRef.current!.port.postMessage({
        cmd: "update_video_frame",
        data: bitmap,
      }, [bitmap]);

      requestAnimationFrame(loop);
    };

    loop();
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Parameters</h2>
        {/* <button className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
          <Settings className="w-5 h-5 text-gray-600" />
        </button> */}
      </div>
      <input
        type="file"
        accept="video/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleUpload}
      />
      <button
        onClick={() => fileInputRef.current!.click()}
        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
      >
        Upload Video
      </button>
      <video ref={hiddenVideoRef} muted className="hidden" />
    </div>
  );
}

export default GamerLive;
