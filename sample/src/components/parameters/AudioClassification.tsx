import React, { useState, useRef, useEffect } from 'react';
import { Processor } from "@zoom/videosdk";
import { Play, Pause } from 'lucide-react';

type ProcessorInfo = {
  processor: Processor;
};

function AudioClassification({ processor }: ProcessorInfo) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [classification, setClassification] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processorRef = useRef<Processor | undefined>();
  processorRef.current = processor;

  useEffect(() => {
    if (!processorRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data.cmd === 'classification_result') {
        setClassification(event.data.result);
      }
    };

    processorRef.current.port.addEventListener('message', handleMessage);
    return () => {
      processorRef.current?.port.removeEventListener('message', handleMessage);
    };
  }, [processor]);

  const handleToggleAudio = () => {
    setIsPlaying(!isPlaying);
    processorRef.current?.port.postMessage({
      cmd: isPlaying ? 'stop_classification' : 'start_classification'
    });
  };

  return (
    <>
      {/* Visualizer Section */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Audio Classification</h2>
          <div className="flex space-x-2">
            <button 
              className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors"
              onClick={handleToggleAudio}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="w-full h-48 bg-gray-900 rounded-lg mb-4"
        />
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="text-lg font-semibold text-gray-800">
            Classification: <span className="text-blue-600">{classification || 'Not detected'}</span>
          </p>
        </div>
      </div>

      {/* Parameters Section */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Parameters</h2>
        </div>
        <div className="space-y-4">
          <p className="text-gray-600">
            Real-time audio classification using machine learning models to detect:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Speech</li>
            <li>Music</li>
            <li>Background noise</li>
            <li>Silence</li>
          </ul>
        </div>
      </div>
    </>
  );
}

export default AudioClassification;
