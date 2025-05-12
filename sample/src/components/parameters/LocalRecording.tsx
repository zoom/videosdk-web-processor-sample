import React, { useState, useRef, useContext, useEffect } from "react";
import ZoomMediaContext from "../../context/media-context";
import { Mic, Loader2, Upload, Play } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";

type ProcessorInfo = {
  processor: AudioWorkletNode;
};

function LocalRecording({ processor }: ProcessorInfo) {
  const isRecordingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { audioOn, handleToggleAudio } = useAudio();
  const sampleRate = 48000;

  // 添加参数状态
  const [selectedSampleRate, setSelectedSampleRate] = useState(sampleRate);
  const [selectedFormat, setSelectedFormat] = useState("wav");
  const [maxDuration, setMaxDuration] = useState(300); // 默认5分钟
  const [volumeThreshold, setVolumeThreshold] = useState(0.1);

  // 倒计时效果
  useEffect(() => {
    let timer: number | undefined;
    if (isRecording && remainingTime > 0) {
      timer = window.setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [isRecording, remainingTime]);

  // 处理录音结束后的音频
  useEffect(() => {
    if (recordedBlob && !audioUrl) {
      const url = URL.createObjectURL(recordedBlob);
      setAudioUrl(url);
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    }
  }, [recordedBlob, audioUrl]);

  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    // 这里添加停止录音的逻辑
    // 假设录音完成后会生成 recordedBlob
    // setRecordedBlob(generatedBlob);
  };

  const startRecording = async () => {
    setIsRecording(true);
    isRecordingRef.current = true;
    setRemainingTime(maxDuration);
    // 清除之前的录音
    setRecordedBlob(null);
    setAudioUrl(null);
    // 这里添加开始录音的逻辑
  };

  const handleUpload = async () => {
    if (!recordedBlob) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("audio", recordedBlob, `recording.${selectedFormat}`);

      // 这里添加实际上传逻辑
      // const response = await fetch('/api/upload', {
      //   method: 'POST',
      //   body: formData
      // });

      // if (!response.ok) throw new Error('Upload failed');

      // 上传成功后的处理（可以选择是否清空录音）
      // setRecordedBlob(null);
      // setAudioUrl(null);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePreview = () => {
    if (!audioUrl || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.error("Preview playback failed:", err);
      });
      setIsPlaying(true);
    }
  };

  // 监听音频播放完成
  useEffect(() => {
    const audioElement = audioRef.current;

    const handleEnded = () => {
      setIsPlaying(false);
    };

    if (audioElement) {
      audioElement.addEventListener("ended", handleEnded);
    }

    return () => {
      if (audioElement) {
        audioElement.removeEventListener("ended", handleEnded);
      }
    };
  }, []);

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            LocalRecording Processor
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
            {isRecording && (
              <div className="bg-gray-700 text-white px-2 py-1 rounded flex items-center">
                {Math.floor(remainingTime / 60)}:
                {(remainingTime % 60).toString().padStart(2, "0")}
              </div>
            )}
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="w-full h-48 bg-gray-900 rounded-lg"
        />
        {/* 隐藏的音频元素用于预览 */}
        <audio ref={audioRef} style={{ display: "none" }} />
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Parameters</h2>

        {/* 采样率选择 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sample Rate
          </label>
          <select
            value={selectedSampleRate}
            onChange={(e) => setSelectedSampleRate(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          >
            <option value={44100}>44.1 kHz</option>
            <option value={48000}>48 kHz</option>
            <option value={96000}>96 kHz</option>
          </select>
        </div>

        {/* 音频格式选择 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Audio Format
          </label>
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          >
            <option value="wav">WAV</option>
            <option value="mp3">MP3</option>
            <option value="ogg">OGG</option>
          </select>
        </div>

        {/* 最大录制时长 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Duration (seconds)
          </label>
          <input
            type="number"
            value={maxDuration}
            onChange={(e) => setMaxDuration(Number(e.target.value))}
            min="1"
            max="3600"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          />
        </div>

        {/* 音量阈值 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Volume Threshold
          </label>
          <input
            type="range"
            value={volumeThreshold}
            onChange={(e) => setVolumeThreshold(Number(e.target.value))}
            min="0"
            max="1"
            step="0.01"
            className="w-full"
            disabled={isRecording}
          />
          <div className="text-sm text-gray-500 mt-1">
            {Math.round(volumeThreshold * 100)}%
          </div>
        </div>

        {/* 预览和上传按钮 */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={handlePreview}
            disabled={!audioUrl || isRecording}
            className={`flex-1 py-2 px-4 rounded-md flex justify-center items-center space-x-2 ${
              audioUrl && !isRecording
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <Play className="w-5 h-5" />
            <span>{isPlaying ? "Stop" : "Preview"}</span>
          </button>

          <button
            onClick={handleUpload}
            disabled={!audioUrl || isRecording || isUploading}
            className={`flex-1 py-2 px-4 rounded-md flex justify-center items-center space-x-2 ${
              audioUrl && !isRecording && !isUploading
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Upload</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export default LocalRecording;
