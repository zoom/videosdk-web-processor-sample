import React, { useState, useRef, useEffect } from "react";
import { Video as VideoIcon, Loader2, Download, Play, Upload, Settings } from "lucide-react";
import { Processor } from "@zoom/videosdk";

type ProcessorInfo = {
  processor: Processor;
};

interface VideoRecordingMetadata {
  frameCount: number;
  duration: number;
  fileSize: number;
  width: number;
  height: number;
  framerate: number;
  bitrate: number;
  timestamp: number;
}

function VideoLocalRecording({ processor }: ProcessorInfo) {
  const processorRef = useRef<Processor>(processor);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [metadata, setMetadata] = useState<VideoRecordingMetadata | null>(null);

  // Configuration
  const [resolution, setResolution] = useState<'720p' | '1080p' | '480p'>('720p');
  const [framerate, setFramerate] = useState(30);
  const [bitrate, setBitrate] = useState(2);
  const [codec, setCodec] = useState<'vp8' | 'vp9'>('vp8');
  const [maxDuration, setMaxDuration] = useState(300);

  // Upload
  const [uploadUrl, setUploadUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Status
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Recording time
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    processorRef.current = processor;
    if (processorRef.current) {
      console.log(`VideoLocalRecording processor loaded: ${processorRef.current.name}`);
      
      processorRef.current.port.onmessage = (event: MessageEvent) => {
        if (event.data) {
          const { type, message, buffer, metadata: videoMetadata, videoFormat } = event.data;
          
          if (type === 'status') {
            setStatusMessage(message);
            setErrorMessage("");
            console.log('[VideoRecording]', message);
          } else if (type === 'error') {
            setErrorMessage(message);
            setStatusMessage("");
            console.error('[VideoRecording]', message);
          } else if (type === 'encoding' && buffer) {
            // Received encoded video data
            console.log('[VideoRecording] Received encoded video:', videoMetadata);
            
            const mimeType = videoFormat === 'webm' ? 'video/webm' : 'video/mp4';
            const videoBlob = new Blob([buffer], { type: mimeType });
            
            setRecordedBlob(videoBlob);
            setMetadata(videoMetadata);
            
            // Auto-upload if URL is provided
            if (uploadUrl.trim()) {
              setTimeout(() => handleAutoUpload(videoBlob, videoMetadata), 100);
            }
          }
        }
      };
    }
  }, [processor]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  // Video URL management
  useEffect(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    if (recordedBlob && recordedBlob.size > 0) {
      try {
        const url = URL.createObjectURL(recordedBlob);
        console.log('Created video URL:', url);
        setVideoUrl(url);
      } catch (error) {
        console.error('Error creating object URL:', error);
      }
    }

    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [recordedBlob]);

  // Load video URL to video element
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      try {
        videoRef.current.src = videoUrl;
        videoRef.current.load();
        console.log('Video URL loaded to video element');
      } catch (error) {
        console.error('Error loading video:', error);
      }
    }
  }, [videoUrl]);

  const getResolutionDimensions = (res: '720p' | '1080p' | '480p') => {
    switch (res) {
      case '1080p':
        return { width: 1920, height: 1080 };
      case '720p':
        return { width: 1280, height: 720 };
      case '480p':
        return { width: 854, height: 480 };
    }
  };

  const startRecording = async () => {
    setIsRecording(true);
    setRecordedBlob(null);
    setVideoUrl(null);
    setMetadata(null);
    setStatusMessage("");
    setErrorMessage("");

    const { width, height } = getResolutionDimensions(resolution);

    if (processor && processor.port) {
      processor.port.postMessage({
        command: 'start',
        config: {
          width,
          height,
          framerate,
          bitrate: bitrate * 1_000_000, // Convert Mbps to bps
          codec,
          maxDuration,
        },
      });
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    if (processor && processor.port) {
      processor.port.postMessage({
        command: 'stop',
      });
    }
  };

  const handlePreview = async () => {
    if (!videoUrl || !videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await videoRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Preview playback failed:', error);
      }
    }
  };

  const handleDownload = async () => {
    if (!recordedBlob) return;

    try {
      setIsDownloading(true);
      
      const timestamp = new Date(metadata?.timestamp || Date.now()).toISOString().replace(/[:.]/g, '-');
      const filename = `video-recording-${timestamp}.webm`;
      const downloadUrl = URL.createObjectURL(recordedBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);
      
      console.log('Video downloaded:', filename);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAutoUpload = async (videoBlob: Blob, videoMetadata: VideoRecordingMetadata) => {
    if (!videoBlob || !uploadUrl.trim()) return;

    try {
      setIsUploading(true);
      const timestamp = new Date(videoMetadata.timestamp).toISOString().replace(/[:.]/g, '-');
      const filename = `video-recording-${timestamp}.webm`;

      const formData = new FormData();
      formData.append('file', videoBlob, filename);
      formData.append('width', videoMetadata.width.toString());
      formData.append('height', videoMetadata.height.toString());
      formData.append('framerate', videoMetadata.framerate.toString());
      formData.append('duration', videoMetadata.duration.toString());
      formData.append('timestamp', timestamp);

      console.log('Starting auto-upload to:', uploadUrl);
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Auto-upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Auto-upload completed successfully:', result);
      alert('Video uploaded successfully!');
    } catch (error) {
      console.error('Auto-upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Auto-upload failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!recordedBlob || !uploadUrl.trim() || !metadata) return;

    try {
      setIsUploading(true);
      const timestamp = new Date(metadata.timestamp).toISOString().replace(/[:.]/g, '-');
      const filename = `video-recording-${timestamp}.webm`;

      const formData = new FormData();
      formData.append('file', recordedBlob, filename);
      formData.append('width', metadata.width.toString());
      formData.append('height', metadata.height.toString());
      formData.append('framerate', metadata.framerate.toString());
      formData.append('duration', metadata.duration.toString());
      formData.append('timestamp', timestamp);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      console.log('Video uploaded successfully');
      alert('Video uploaded successfully!');
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Video Local Recording
          </h2>
          <div className="flex space-x-2 items-center">
            <button
              className={`p-2 rounded-lg transition-colors ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 animate-pulse"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isUploading}
            >
              <VideoIcon className="w-5 h-5 text-white" />
            </button>
            {isRecording && (
              <div className="bg-gray-700 text-white px-3 py-1 rounded flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="font-mono text-sm">{formatTime(recordingTime)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Video Preview */}
        <div className="mb-4">
          <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              controls={false}
              onEnded={() => setIsPlaying(false)}
            />
            {!videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <VideoIcon className="w-16 h-16 mx-auto mb-2 opacity-50" />
                  <p>No recording available</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {statusMessage && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Metadata Display */}
        {metadata && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Recording Info</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div>Duration: {metadata.duration.toFixed(2)}s</div>
              <div>Frames: {metadata.frameCount}</div>
              <div>Resolution: {metadata.width}x{metadata.height}</div>
              <div>Frame Rate: {metadata.framerate} fps</div>
              <div>File Size: {formatFileSize(metadata.fileSize)}</div>
              <div>Bitrate: {(metadata.bitrate / 1_000_000).toFixed(2)} Mbps</div>
            </div>
          </div>
        )}

        {/* Upload Status */}
        {isUploading && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-700 font-medium">Uploading video...</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>

        {/* Resolution */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resolution
          </label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as any)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          >
            <option value="480p">480p (854x480)</option>
            <option value="720p">720p (1280x720)</option>
            <option value="1080p">1080p (1920x1080)</option>
          </select>
        </div>

        {/* Frame Rate */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Frame Rate (fps)
          </label>
          <select
            value={framerate}
            onChange={(e) => setFramerate(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          >
            <option value={15}>15 fps</option>
            <option value={24}>24 fps</option>
            <option value={30}>30 fps</option>
            <option value={60}>60 fps</option>
          </select>
        </div>

        {/* Bitrate */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bitrate (Mbps)
          </label>
          <input
            type="number"
            value={bitrate}
            onChange={(e) => setBitrate(Number(e.target.value))}
            min="0.5"
            max="10"
            step="0.5"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          />
          <div className="text-xs text-gray-500 mt-1">
            Higher bitrate = better quality, larger file size
          </div>
        </div>

        {/* Codec */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Codec
          </label>
          <select
            value={codec}
            onChange={(e) => setCodec(e.target.value as any)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          >
            <option value="vp8">VP8 (faster, good compatibility)</option>
            <option value="vp9">VP9 (slower, better compression)</option>
          </select>
        </div>

        {/* Max Duration */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Duration (seconds)
          </label>
          <input
            type="number"
            value={maxDuration}
            onChange={(e) => setMaxDuration(Number(e.target.value))}
            min="10"
            max="3600"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          />
        </div>

        {/* Upload URL */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload URL
          </label>
          <input
            type="url"
            value={uploadUrl}
            onChange={(e) => setUploadUrl(e.target.value)}
            placeholder="http://localhost:8001/upload"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          />
          <div className="text-xs text-gray-500 mt-1">
            If provided, video will be automatically uploaded after recording
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-2">
          <button
            onClick={handlePreview}
            disabled={!videoUrl || isRecording}
            className={`py-2 px-4 rounded-md flex justify-center items-center space-x-2 ${
              videoUrl && !isRecording
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <Play className="w-5 h-5" />
            <span>{isPlaying ? "Pause" : "Preview"}</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={!videoUrl || isRecording || isDownloading}
            className={`py-2 px-4 rounded-md flex justify-center items-center space-x-2 ${
              videoUrl && !isRecording && !isDownloading
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Download</span>
              </>
            )}
          </button>

          <button
            onClick={handleUpload}
            disabled={!videoUrl || !uploadUrl.trim() || isRecording || isUploading}
            className={`py-2 px-4 rounded-md flex justify-center items-center space-x-2 ${
              videoUrl && uploadUrl.trim() && !isRecording && !isUploading
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <Upload className="w-5 h-5" />
            <span>Upload</span>
          </button>
        </div>
      </div>
    </>
  );
}

export default VideoLocalRecording;

