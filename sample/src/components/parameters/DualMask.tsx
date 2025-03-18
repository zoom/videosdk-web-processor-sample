import React, { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
import { Processor } from "@zoom/videosdk";
import { loadImageBitmap } from "../../utils/util";

type ProcessorInfo = {
  processor: Processor;
};

function DualMask({ processor }: ProcessorInfo) {
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

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Parameters</h2>
        {/* <button className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
          <Settings className="w-5 h-5 text-gray-600" />
        </button> */}
      </div>

      <div className="space-y-6">
        {/* Shape Dropdown */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Shape</label>
          <select
            value={parameters.shape}
            onChange={(e) => handleParameterChange("shape", e.target.value)}
            className="w-full p-2 border rounded-lg bg-gray-50 focus:ring focus:ring-blue-300"
          >
            <option value="circle">Circle</option>
            <option value="ellipse">Ellipse</option>
          </select>
        </div>

        {/* Scale Factor Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Scale Factor
          </label>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={parameters.scaleFactor}
            onChange={(e) =>
              handleParameterChange("scaleFactor", parseFloat(e.target.value))
            }
            className="w-full p-2 border rounded-lg bg-gray-50 focus:ring focus:ring-blue-300"
          />
        </div>

        {/* Use Angle Checkbox */}
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={parameters.useAngle}
            onChange={(e) =>
              handleParameterChange("useAngle", e.target.checked)
            }
            className="w-5 h-5 text-blue-500"
          />
          <label className="text-sm font-medium text-gray-700">
            Enable Angle
          </label>
        </div>

        {/* Zoom Video Checkbox */}
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={parameters.zoomVideo}
            onChange={(e) =>
              handleParameterChange("zoomVideo", e.target.checked)
            }
            className="w-5 h-5 text-blue-500"
          />
          <label className="text-sm font-medium text-gray-700">
            Zoom-In Video
          </label>
        </div>
      </div>

      <div className="mt-8" hidden>
        <button className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-200 transition-all duration-300">
          Apply Changes
        </button>
      </div>
    </div>
  );
}

export default DualMask;
