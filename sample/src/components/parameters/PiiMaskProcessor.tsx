import React, { useState, useRef, useEffect } from "react";
import { Processor } from "@zoom/videosdk";
import { Settings, Square, Crop, RotateCcw, Save, ExternalLink } from "lucide-react";

type ProcessorInfo = {
  processor: Processor;
  isSharing: boolean;
  previewCanvasRef: React.RefObject<HTMLCanvasElement>;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  createProcessor?: () => Promise<Processor | null>;
  removeProcessor?: () => Promise<void>;
  processorCreated?: boolean;
};

interface BlurRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

function PiiMaskProcessor({
  processor,
  isSharing,
  previewCanvasRef,
  previewVideoRef,
  createProcessor,
  removeProcessor,
  processorCreated = true,
}: ProcessorInfo) {
  // Processor state
  const [isProcessorActive, setIsProcessorActive] = useState(false);

  // Region editing state
  const [isEditingRegion, setIsEditingRegion] = useState(false);

  // Processor parameters
  const [blurRadius, setBlurRadius] = useState(10);
  const [blurRegion, setBlurRegion] = useState<BlurRegion>({
    x: 0.2,
    y: 0.2,
    width: 0.6,
    height: 0.6,
  });

  // Refs
  const regionCanvasRef = useRef<HTMLCanvasElement>(null);
  const editVideoRef = useRef<HTMLVideoElement>(null);
  const processorRef = useRef<Processor | undefined>();
  const isDrawing = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });

  processorRef.current = processor;

  // Automatically stop processor when screen sharing stops
  useEffect(() => {
    if (!isSharing && isProcessorActive) {
      stopProcessor();
      setIsEditingRegion(false);
    }
  }, [isSharing, isProcessorActive]);

  // Start processor
  const startProcessor = async () => {
    try {
      let currentProcessor = processorRef.current;
      
      // If processor hasn't been created yet, create it first
      if (!processorCreated && createProcessor) {
        console.log("Creating processor before starting...");
        const newProcessor = await createProcessor();
        if (!newProcessor) {
          console.error("Failed to create processor");
          return;
        }
        // Use the newly created processor directly
        currentProcessor = newProcessor;
      }

      if (!currentProcessor) {
        console.error("Processor not available");
        return;
      }

      console.log("Sending configuration to processor:", {
        blurRegionNorm: blurRegion,
        blurRadius: blurRadius,
      });

      // Send initial configuration to processor and ensure message is sent successfully
      try {
        currentProcessor.port.postMessage({
          command: "update-blur-options",
          blurRegionNorm: blurRegion,
          blurRadius: blurRadius,
        });
        
        setIsProcessorActive(true);
        console.log("PII mask processor started successfully");
      } catch (msgError) {
        console.error("Failed to send message to processor:", msgError);
        return;
      }
    } catch (error) {
      console.error("Failed to start processor:", error);
    }
  };

  // Stop processor
  const stopProcessor = async () => {
    try {
      // First set UI state to inactive
      setIsProcessorActive(false);

      // Call removeProcessor to remove processor from media stream
      if (removeProcessor) {
        await removeProcessor();
        console.log("PII mask processor removed from media stream");
      } else {
        console.warn("removeProcessor function not available");
      }

      console.log("PII mask processor stopped");
    } catch (error) {
      console.error("Failed to stop processor:", error);
    }
  };

  // Draw mask region on preview canvas
  useEffect(() => {
    if (isProcessorActive && previewCanvasRef.current) {
      const canvas = previewCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw mask region overlay in next frame
        requestAnimationFrame(() => {
          drawMaskRegion(ctx, canvas.width, canvas.height);
        });
      }
    }
  }, [isProcessorActive, blurRegion, previewCanvasRef]);

  // Draw mask region
  const drawMaskRegion = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    const x = blurRegion.x * width;
    const y = blurRegion.y * height;
    const w = blurRegion.width * width;
    const h = blurRegion.height * height;

    // Draw semi-transparent mask region
    ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
    ctx.fillRect(x, y, w, h);

    // Draw border
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  };

  // Sync video content to edit modal
  useEffect(() => {
    if (isEditingRegion && previewVideoRef.current && editVideoRef.current) {
      // Sync video source
      editVideoRef.current.srcObject = previewVideoRef.current.srcObject;
      editVideoRef.current.play().catch(console.error);
    }
  }, [isEditingRegion]);

  // Ensure Canvas size matches display size
  useEffect(() => {
    if (isEditingRegion && regionCanvasRef.current) {
      // Delayed initialization to ensure DOM is fully rendered
      const timeoutId = setTimeout(() => {
        if (!regionCanvasRef.current) return;

        const canvas = regionCanvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Ensure valid dimensions
        if (rect.width > 0 && rect.height > 0) {
          // Set canvas internal size to match display size for better clarity
          const dpr = window.devicePixelRatio || 1;
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;

          // Scale canvas context to match device pixel ratio
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.scale(dpr, dpr);
          }
        }
      }, 100); // Give DOM some time to render

      return () => clearTimeout(timeoutId);
    }
  }, [isEditingRegion]);

  // Start editing region
  const startEditingRegion = () => {
    setIsEditingRegion(true);
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditingRegion || !regionCanvasRef.current) return;

    const canvas = regionCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Use actual display dimensions instead of canvas internal dimensions
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    startPoint.current = { x, y };
    isDrawing.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !regionCanvasRef.current) return;

    const canvas = regionCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Use actual display dimensions instead of canvas internal dimensions
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const newRegion = {
      x: Math.min(startPoint.current.x, x),
      y: Math.min(startPoint.current.y, y),
      width: Math.abs(x - startPoint.current.x),
      height: Math.abs(y - startPoint.current.y),
    };

    setBlurRegion(newRegion);
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  // Save region settings
  const saveRegionSettings = () => {
    if (processorRef.current) {
      processorRef.current.port.postMessage({
        command: "update-blur-options",
        blurRegionNorm: blurRegion,
        blurRadius: blurRadius,
      });
    }
    cleanupEditingResources();
    setIsEditingRegion(false);
    console.log("Region settings saved:", blurRegion);
  };

  // Cancel editing and cleanup resources
  const cancelEditing = () => {
    cleanupEditingResources();
    setIsEditingRegion(false);
  };

  // Cleanup editing resources
  const cleanupEditingResources = () => {
    if (editVideoRef.current) {
      editVideoRef.current.srcObject = null;
    }
    if (regionCanvasRef.current) {
      const ctx = regionCanvasRef.current.getContext("2d");
      if (ctx) {
        ctx.clearRect(
          0,
          0,
          regionCanvasRef.current.width,
          regionCanvasRef.current.height
        );
      }
    }
  };

  // Reset region to default
  const resetRegion = () => {
    const defaultRegion = {
      x: 0.2,
      y: 0.2,
      width: 0.6,
      height: 0.6,
    };
    setBlurRegion(defaultRegion);
  };

  // Update blur radius
  const updateBlurRadius = (value: number) => {
    setBlurRadius(value);
    if (processorRef.current && isProcessorActive) {
      processorRef.current.port.postMessage({
        command: "update-blur-options",
        blurRegionNorm: blurRegion,
        blurRadius: value,
      });
    }
  };

  return (
    <>
      {/* PII Processor Control Area */}
      <div className="space-y-5">
        {/* Processor Title and Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-800">
              PII Processor
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                isProcessorActive
                  ? "bg-purple-500 shadow-md shadow-purple-200 animate-pulse"
                  : "bg-gray-300"
              }`}
            ></div>
            <span
              className={`text-xs font-medium ${
                isProcessorActive
                  ? "text-purple-600"
                  : !processorCreated
                  ? "text-orange-500"
                  : "text-gray-500"
              }`}
            >
              {isProcessorActive
                ? "ACTIVE"
                : !processorCreated
                ? "READY TO CREATE"
                : "CREATED BUT INACTIVE"}
            </span>
          </div>
        </div>

        {/* Processor Control Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={startProcessor}
            disabled={!isSharing || isProcessorActive}
            className={`group relative overflow-hidden rounded-xl py-3 px-4 font-medium transition-all duration-300 ${
              !isSharing || isProcessorActive
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 hover:shadow-lg hover:shadow-purple-200 transform hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Settings className="w-4 h-4" />
              <span>{!processorCreated ? "Create & Start" : "Start"}</span>
            </div>
            {!isSharing && !isProcessorActive && (
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
            )}
          </button>

          <button
            onClick={stopProcessor}
            disabled={!isProcessorActive}
            className={`group relative overflow-hidden rounded-xl py-3 px-4 font-medium transition-all duration-300 ${
              !isProcessorActive
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 hover:shadow-lg hover:shadow-orange-200 transform hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Square className="w-4 h-4" />
              <span>Stop</span>
            </div>
            {isProcessorActive && (
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
            )}
          </button>
        </div>
      </div>

      {/* Elegant Divider */}
      <div className="relative py-3">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
            Parameters
          </span>
        </div>
      </div>

      {/* Parameter Settings Area */}
      <div className="space-y-5">
        {/* Blur Radius Settings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Blur Radius
            </label>
            <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {blurRadius}px
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="1"
              max="50"
              value={blurRadius}
              onChange={(e) => updateBlurRadius(Number(e.target.value))}
              className="w-full h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, rgb(139 92 246) 0%, rgb(139 92 246) ${
                  (blurRadius / 50) * 100
                }%, rgb(229 231 235) ${
                  (blurRadius / 50) * 100
                }%, rgb(229 231 235) 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Soft</span>
              <span>Sharp</span>
            </div>
          </div>
        </div>

        {/* PII Region Editing */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Mask Region
            </label>
            <div className="flex gap-2">
              <button
                onClick={resetRegion}
                className="group flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RotateCcw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-300" />
                Reset
              </button>
              <button
                onClick={startEditingRegion}
                disabled={!isSharing}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-all duration-300 ${
                  !isSharing
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : isEditingRegion
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200"
                    : "bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 hover:shadow-md hover:shadow-blue-200 transform hover:-translate-y-0.5"
                }`}
              >
                <Crop className="w-3 h-3" />
                {isEditingRegion ? "Editing..." : "Edit"}
              </button>
            </div>
          </div>

          {/* Region Coordinates Display */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Position</p>
                <div className="space-y-1">
                  <div className="text-xs">
                    <span className="text-gray-600">X: </span>
                    <span className="font-mono font-semibold text-purple-600">
                      {(blurRegion.x * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">Y: </span>
                    <span className="font-mono font-semibold text-purple-600">
                      {(blurRegion.y * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Size</p>
                <div className="space-y-1">
                  <div className="text-xs">
                    <span className="text-gray-600">W: </span>
                    <span className="font-mono font-semibold text-purple-600">
                      {(blurRegion.width * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-600">H: </span>
                    <span className="font-mono font-semibold text-purple-600">
                      {(blurRegion.height * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isEditingRegion && (
            <div className="flex justify-end pt-2">
              <button
                onClick={saveRegionSettings}
                className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 hover:shadow-lg hover:shadow-green-200 transition-all duration-300 transform hover:-translate-y-0.5"
              >
                <Save className="w-3 h-3 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Save</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Region Edit Overlay - as Independent Panel */}
      {isEditingRegion && isSharing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-4xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Edit PII Region
              </h2>
              <a
                href="/docs/processors/sharing/pii-masking-share-processor.md#usage"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1"
                title="View Usage Documentation"
              >
                📖 How to use
              </a>
            </div>

            <div className="relative">
              {/* Display video as background */}
              <video
                ref={editVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full aspect-video bg-gray-900 rounded-lg border pointer-events-none"
              />

              {/* Interactive canvas overlay */}
              <canvas
                ref={regionCanvasRef}
                className="absolute inset-0 w-full aspect-video cursor-crosshair rounded-lg"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ background: "rgba(0,0,0,0.1)" }}
              />

              {/* Current region preview */}
              <div
                className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20"
                style={{
                  left: `${blurRegion.x * 100}%`,
                  top: `${blurRegion.y * 100}%`,
                  width: `${blurRegion.width * 100}%`,
                  height: `${blurRegion.height * 100}%`,
                  pointerEvents: "none",
                }}
              />
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <Crop className="w-4 h-4 inline mr-1" />
                Drag on the video preview above to define the PII masking
                region. The red rectangle shows the current region.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={cancelEditing}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveRegionSettings}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PiiMaskProcessor;
