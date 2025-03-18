import React, { useState, useRef, useEffect } from "react";
import { Processor } from "@zoom/videosdk";
import * as fabric from "fabric";

type ProcessorInfo = {
  processor: Processor;
};

function WatermarkEffect({ processor }: ProcessorInfo) {
  const [parameters, setParameters] = useState({
    watermarkText: "watermark",
  });

  const processorRef = useRef<Processor | undefined>();
  processorRef.current = processor;

  const handleParameterChange = (
    param: keyof typeof parameters,
    value: string
  ) => {
    setParameters((prev) => ({ ...prev, [param]: value }));
  };

  useEffect(() => {
    if (!processorRef.current) return;

    processorRef.current.port.postMessage({
      cmd: "update_watermark_image",
      data: null,
    });
  }, []);

  const generateWatermarkImage = async () => {
    if (!parameters.watermarkText.trim()) {
      console.warn("Watermark text is empty");
      return;
    }

    // Create a canvas element
    const canvas = new fabric.Canvas(document.createElement("canvas"), {
      width: 1280,
      height: 720,
    });

    // Create text object
    const text = new fabric.Text(parameters.watermarkText, {
      left: 10,
      top: 10,
      fontSize: 60,
      fill: "black",
    });

    canvas.add(text);
    canvas.renderAll();

    // Convert to ImageBitmap
    const dataUrl = canvas.toDataURL();
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    // Send to processor
    if (processorRef.current) {
      processorRef.current.port.postMessage({
        cmd: "update_watermark_image",
        data: imageBitmap,
      });
    }
  };

  const handleApplyChanges = () => {
    generateWatermarkImage();
  };

  useEffect(() => {
    const initProcessor = async () => {
      processor.port.postMessage({
        cmd: "update_watermark_image",
        data: null,
      });
    };
    if (processor) {
      initProcessor();
    }
  }, [processor]);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Parameters</h2>
      </div>

      <div className="space-y-6">
        {/* Watermark Text Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Watermark Text
          </label>
          <input
            type="text"
            value={parameters.watermarkText}
            onChange={(e) =>
              handleParameterChange("watermarkText", e.target.value)
            }
            className="w-full p-2 border rounded-lg bg-gray-50 focus:ring focus:ring-blue-300"
          />
        </div>
      </div>

      <div className="mt-8">
        <button
          onClick={handleApplyChanges}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-200 transition-all duration-300"
        >
          Apply Changes
        </button>
      </div>
    </div>
  );
}

export default WatermarkEffect;
