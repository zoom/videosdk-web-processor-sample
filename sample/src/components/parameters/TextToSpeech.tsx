import React, { useState, useRef, useEffect } from 'react';
import { Processor } from "@zoom/videosdk";
import { Mic, Loader2 } from 'lucide-react';

type ProcessorInfo = {
  processor: Processor;
};

function TextToSpeech({ processor }: ProcessorInfo) {
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [settings, setSettings] = useState({
    language: 'en-US',
    quality: 'high',
    engine: 'assemblyai',
    deviceId: '',
    apiKey: ''
  });
  const [microphoneList, setMicrophoneList] = useState<MediaDeviceInfo[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processorRef = useRef<Processor>();
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext>();
  const analyserRef = useRef<AnalyserNode>();
  const mediaStreamRef = useRef<MediaStream>();
  const isRecordingRef = useRef(false); 

  useEffect(() => {
    processorRef.current = processor;
  }, [processor]);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      if (!isRecordingRef.current) return;

      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgb(25, 25, 25)';
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(59, 130, 246)';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();
  };

  const getMicrophoneList = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      setMicrophoneList(audioDevices);
      
      if (!settings.deviceId && audioDevices.length > 0) {
        handleSettingChange('deviceId', audioDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error getting microphone list:', err);
    }
  };

  useEffect(() => {
    getMicrophoneList();
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = 'rgb(25, 25, 25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const startRecording = async () => {
    try {
      setIsInitializing(true);

      if (!settings.apiKey) {
        throw new Error('API Key is required');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          deviceId: settings.deviceId ? { exact: settings.deviceId } : undefined
        } 
      });
      
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      if (processorRef.current) {
        processorRef.current.port.postMessage({
          cmd: 'start_transcription',
          data: {
            apiKey: settings.apiKey
          }
        });
      }

      isRecordingRef.current = true;
      setIsRecording(true);
      setTranscription('');
      drawWaveform();

    } catch (err) {
      console.error('Error starting recording:', err);
      stopRecording();
    } finally {
      setIsInitializing(false);
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    if (processorRef.current) {
      processorRef.current.port.postMessage({
        cmd: 'stop_transcription'
      });
    }

    clearCanvas();
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSettingChange = (key: keyof typeof settings, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    if (processorRef.current) {
      processorRef.current.port.postMessage({
        cmd: 'update_settings',
        data: { [key]: value }
      });
    }
  };

  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording && settings.engine === 'webspeech') {
      stopRecording();
      startRecording();
    }
  }, [settings.language]);

  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  useEffect(() => {
    if (!processorRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      const { cmd, text, error } = event.data;
      switch (cmd) {
        case 'transcription_result':
          setTranscription(prev => prev + ' ' + text);
          break;
        case 'error':
          console.error('Processor error:', error);
          break;
      }
    };

    processorRef.current.port.addEventListener('message', handleMessage);
    return () => {
      processorRef.current?.port.removeEventListener('message', handleMessage);
    };
  }, [processor]);

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Text to Speech</h2>
          <div className="flex space-x-2">
            <button 
              className={`p-2 rounded-lg transition-colors ${
                isInitializing 
                  ? 'bg-gray-500'
                  : isRecording 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
              }`}
              onClick={handleToggleRecording}
              disabled={isInitializing}
            >
              {isInitializing ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Mic className={`w-5 h-5 text-white ${isRecording ? 'animate-pulse' : ''}`} />
              )}
            </button>
          </div>
        </div>

        {/* Visualization Area */}
        <div className="space-y-4">
          <canvas
            ref={canvasRef}
            className="w-full h-32 bg-gray-900 rounded-lg"
            width={1024}
            height={256}
          />
          <div className="bg-gray-100 p-4 rounded-lg h-48 overflow-y-auto">
            <p className="text-gray-800 whitespace-pre-wrap">
              {transcription || 'Start speaking to see transcription...'}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
        </div>
        <div className="space-y-4">
          {/* Microphone Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Microphone
            </label>
            <select 
              className="w-full p-2 border rounded-lg bg-gray-50"
              value={settings.deviceId}
              onChange={(e) => handleSettingChange('deviceId', e.target.value)}
            >
              {microphoneList.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                </option>
              ))}
            </select>
            <button 
              onClick={getMicrophoneList}
              className="mt-2 text-sm text-blue-500 hover:text-blue-600"
            >
              Refresh microphone list
            </button>
          </div>

          {/* Speech Recognition Engine */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Recognition Engine
            </label>
            <select 
              className="w-full p-2 border rounded-lg bg-gray-50"
              value={settings.engine}
              onChange={(e) => handleSettingChange('engine', e.target.value)}
            >
              <option value="assemblyai">AssemblyAI</option>
              <option value="azure">Azure Speech Services</option>
              <option value="deepspeech">Mozilla DeepSpeech</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {settings.engine === 'assemblyai' && 'Real-time transcription with high accuracy'}
              {settings.engine === 'azure' && 'Cloud-based with high accuracy'}
              {settings.engine === 'deepspeech' && 'Open-source, privacy focused'}
            </p>
          </div>

          {/* API Key Input - 只在选择 AssemblyAI 时显示 */}
          {settings.engine === 'assemblyai' && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                AssemblyAI API Key
              </label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => handleSettingChange('apiKey', e.target.value)}
                placeholder="Enter your AssemblyAI API key"
                className="w-full p-2 border rounded-lg bg-gray-50"
              />
            </div>
          )}

          {/* Language Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Language
            </label>
            <select 
              className="w-full p-2 border rounded-lg bg-gray-50"
              value={settings.language}
              onChange={(e) => handleSettingChange('language', e.target.value)}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </div>

          {/* Model Quality */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Model Quality
            </label>
            <select 
              className="w-full p-2 border rounded-lg bg-gray-50"
              value={settings.quality}
              onChange={(e) => handleSettingChange('quality', e.target.value)}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

export default TextToSpeech;
