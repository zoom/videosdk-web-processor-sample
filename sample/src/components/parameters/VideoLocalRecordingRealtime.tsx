import React, { useState, useRef, useEffect } from "react";
import {
  Video as VideoIcon,
  Loader2,
  Download,
  Play,
  Upload,
  Square,
  Radio,
} from "lucide-react";
import { Processor } from "@zoom/videosdk";
import { RealtimeVideoRecorder } from "../../utils/RealtimeVideoRecorder";

type ProcessorInfo = {
  processor: Processor;
};

interface VideoChunk {
  data: ArrayBuffer;
  timestamp: number;
  duration: number;
  type: 'key' | 'delta';
  byteLength: number;
}

interface ChunkMetadata {
  decoderConfig?: {
    codec: string;
    codedWidth: number;
    codedHeight: number;
    colorSpace?: VideoColorSpaceInit;
  };
}

interface RecordingMetadata {
  frameCount: number;
  duration: number;
  width: number;
  height: number;
  framerate: number;
  timestamp: number;
}

function VideoLocalRecordingRealtime({ processor }: ProcessorInfo) {
  const processorRef = useRef<Processor>(processor);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<RealtimeVideoRecorder | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedSegments, setRecordedSegments] = useState<Blob[]>([]);
  const [currentSegmentBlob, setCurrentSegmentBlob] = useState<Blob | null>(null);
  const [metadata, setMetadata] = useState<RecordingMetadata | null>(null);

  // Configuration
  const [resolution, setResolution] = useState<"720p" | "1080p" | "480p">("720p");
  const [framerate, setFramerate] = useState(30);
  const [bitrate, setBitrate] = useState(2);
  const [codec, setCodec] = useState<"vp8" | "vp9">("vp8");
  const [maxDuration, setMaxDuration] = useState(300);
  const [segmentDuration, setSegmentDuration] = useState(10); // seconds per segment
  const [enableRealtimePlayback, setEnableRealtimePlayback] = useState(true);

  // Upload
  const [uploadUrl, setUploadUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Status
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Recording time
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);

  // Segment tracking
  const segmentIndexRef = useRef(0);
  const totalDataSizeRef = useRef(0);

  useEffect(() => {
    processorRef.current = processor;
    
    if (processorRef.current) {
      console.log(
        `VideoLocalRecordingRealtime processor loaded: ${processorRef.current.name}`
      );

      // Initialize real-time recorder
      recorderRef.current = new RealtimeVideoRecorder({
        onChunk: (blob: Blob, isSegment: boolean) => {
          if (isSegment) {
            // New segment created
            setRecordedSegments((prev) => [...prev, blob]);
            segmentIndexRef.current++;
            console.log(`Segment ${segmentIndexRef.current} created: ${blob.size} bytes`);
            
            // Upload segment if URL provided
            if (uploadUrl.trim()) {
              uploadSegment(blob, segmentIndexRef.current);
            }
          } else {
            // Regular chunk
            totalDataSizeRef.current += blob.size;
          }

          // Update current segment blob for download
          setCurrentSegmentBlob(blob);

          // For segments, update video playback
          if (isSegment && enableRealtimePlayback && videoRef.current && recorderRef.current) {
            recorderRef.current.playSegment(blob);
          }
        },
        onStatus: (status: string) => {
          setStatusMessage(status);
          setErrorMessage("");
          console.log("[RealtimeRecording]", status);
        },
        onError: (error: Error) => {
          setErrorMessage(error.message);
          setStatusMessage("");
          console.error("[RealtimeRecording]", error);
        },
        segmentDuration,
      });

      // Setup MediaSource for real-time playback
      if (videoRef.current && enableRealtimePlayback) {
        recorderRef.current.setupPlayback(videoRef.current).catch((error) => {
          console.error('Failed to setup playback:', error);
          setErrorMessage(`Playback setup failed: ${error.message}`);
        });
      }

      // Handle messages from Worker
      processorRef.current.port.onmessage = async (event: MessageEvent) => {
        if (!event.data) return;

        const { type, chunk, metadata: chunkMetadata, config, message, metadata: recordingMetadata } = event.data;

        switch (type) {
          case 'start':
            setStatusMessage(message || 'Recording started');
            setErrorMessage("");
            break;

          case 'segment':
            // Received complete WebM segment from Worker
            if (event.data.segment) {
              const segmentBlob = new Blob([event.data.segment], {
                type: 'video/webm',
              });
              
              setRecordedSegments((prev) => [...prev, segmentBlob]);
              setCurrentSegmentBlob(segmentBlob);
              segmentIndexRef.current = event.data.segmentIndex || recordedSegments.length;

              console.log(`Received segment ${segmentIndexRef.current}: ${segmentBlob.size} bytes`);

              // Upload segment if URL provided
              if (uploadUrl.trim()) {
                uploadSegment(segmentBlob, segmentIndexRef.current);
              }

              // Update video playback if enabled
              if (enableRealtimePlayback && videoRef.current && recorderRef.current) {
                recorderRef.current.playSegment(segmentBlob);
              }
            }
            break;

          case 'chunk':
            // Legacy chunk handling (deprecated - using segments instead)
            // Keep for backwards compatibility but segments are preferred
            if (chunk && recorderRef.current) {
              // Reconstruct chunk from data
              const videoChunk: VideoChunk = {
                data: chunk.data,
                timestamp: chunk.timestamp,
                duration: chunk.duration,
                type: chunk.type,
                byteLength: chunk.byteLength,
              };
              recorderRef.current.addChunk(videoChunk, chunkMetadata);
            }
            break;

          case 'stop':
            // Worker has already created final segment and stopped
            // Just cleanup recorder state
            if (recorderRef.current) {
              try {
                // For chunk recording mode, segments are created in Worker
                // Just cleanup, don't call stop() which expects MediaRecorder mode
                recorderRef.current.cleanup();
              } catch (error) {
                console.error('Error cleaning up recorder:', error);
              }
            }
            setStatusMessage(message || 'Recording stopped');
            if (recordingMetadata) {
              setMetadata(recordingMetadata);
            }
            setIsRecording(false);
            break;

          case 'error':
            setErrorMessage(message || 'Unknown error');
            setStatusMessage("");
            setIsRecording(false);
            break;

          case 'status':
            setStatusMessage(message || '');
            setErrorMessage("");
            break;

          default:
            console.warn('Unknown message type:', type);
        }
      };
    }

    return () => {
      if (recorderRef.current) {
        recorderRef.current.cleanupPlayback();
      }
    };
  }, [processor, uploadUrl, segmentDuration, enableRealtimePlayback]);

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

  // Auto-set video source when segment is available
  useEffect(() => {
    if (!videoRef.current || !enableRealtimePlayback) {
      return;
    }

    const segmentToPlay = currentSegmentBlob || 
      (recordedSegments.length > 0 ? recordedSegments[recordedSegments.length - 1] : null);
    
    if (segmentToPlay && segmentToPlay.size > 0) {
      try {
        // Cleanup previous blob URL if exists
        if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
          URL.revokeObjectURL(videoRef.current.src);
        }
        
        const blobUrl = URL.createObjectURL(segmentToPlay);
        videoRef.current.src = blobUrl;
        // load() returns void in some browsers, so check if it returns a promise
        const loadResult = videoRef.current.load();
        if (loadResult && typeof loadResult.catch === 'function') {
          loadResult.catch((error) => {
            // Ignore load errors if video is already loaded or other expected cases
            console.log('Video load error (may be expected):', error);
          });
        }
      } catch (error) {
        console.error('Error setting video source:', error);
      }
    } else {
      // Only clear source if we previously had one, don't set empty src initially
      if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(videoRef.current.src);
        videoRef.current.src = '';
        videoRef.current.load();
      }
    }

    return () => {
      // Cleanup blob URLs on unmount
      if (videoRef.current && videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(videoRef.current.src);
      }
    };
  }, [currentSegmentBlob, recordedSegments, enableRealtimePlayback]);

  const getResolutionDimensions = (res: string) => {
    switch (res) {
      case "480p":
        return { width: 854, height: 480 };
      case "720p":
        return { width: 1280, height: 720 };
      case "1080p":
        return { width: 1920, height: 1080 };
      default:
        return { width: 1280, height: 720 };
    }
  };

  const startRecording = async () => {
    if (!processorRef.current) {
      console.error("Processor not available");
      return;
    }

    try {
      setIsRecording(true);
      setRecordedSegments([]);
      setCurrentSegmentBlob(null);
      segmentIndexRef.current = 0;
      totalDataSizeRef.current = 0;
      setRecordingTime(0);

      const { width, height } = getResolutionDimensions(resolution);

      // Start real-time recorder (not needed for segment-based recording, but keep for compatibility)
      if (recorderRef.current) {
        await recorderRef.current.startChunkRecording({
          codec,
          width,
          height,
          framerate,
          bitrate: bitrate * 1_000_000, // Convert Mbps to bps
        });
      }

      // Send start command to Worker
      processorRef.current.port.postMessage({
        command: "start",
        config: {
          width,
          height,
          framerate,
          bitrate: bitrate * 1_000_000,
          codec,
          maxDuration,
          realtime: true,
          segmentDuration, // Pass segment duration to Worker
        },
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      setIsRecording(false);
      setErrorMessage(
        `Failed to start recording: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const stopRecording = async () => {
    if (!processorRef.current) {
      return;
    }

    setIsRecording(false);

    // Send stop command to Worker
    // Worker will create final segment and cleanup
    if (processorRef.current.port) {
      processorRef.current.port.postMessage({
        command: "stop",
      });
    }

    // Note: For real-time chunk recording, segments are created in Worker
    // The recorder cleanup is handled in the 'stop' message handler
  };

  const handlePreview = async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        // Check if we have a segment to play
        const segmentToPlay = currentSegmentBlob || 
          (recordedSegments.length > 0 ? recordedSegments[recordedSegments.length - 1] : null);
        
        if (!segmentToPlay) {
          setErrorMessage("No video segment available to play. Please record a segment first.");
          return;
        }

        // Set video source if not already set or if it's different
        const blobUrl = URL.createObjectURL(segmentToPlay);
        if (videoRef.current.src !== blobUrl) {
          // Cleanup previous blob URL if exists
          if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
            URL.revokeObjectURL(videoRef.current.src);
          }
          videoRef.current.src = blobUrl;
          videoRef.current.load();
        }

        await videoRef.current.play();
        setIsPlaying(true);
        setErrorMessage(""); // Clear any previous errors
      } catch (error) {
        console.error("Preview playback failed:", error);
        setErrorMessage(
          `Preview playback failed: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  };

  const handleDownloadSegment = async (segment: Blob, index: number) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `video-segment-${index}-${timestamp}.webm`;
      const downloadUrl = URL.createObjectURL(segment);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);

      console.log("Segment downloaded:", filename);
    } catch (error) {
      console.error("Download failed:", error);
      alert(
        `Download failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const handleDownloadAll = async () => {
    if (recordedSegments.length === 0) {
      alert("No segments to download");
      return;
    }

    try {
      // Combine all segments
      const combinedBlob = new Blob(recordedSegments, {
        type: "video/webm",
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `video-recording-all-${timestamp}.webm`;
      const downloadUrl = URL.createObjectURL(combinedBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);

      console.log("All segments downloaded:", filename);
    } catch (error) {
      console.error("Download failed:", error);
      alert(
        `Download failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const uploadSegment = async (blob: Blob, index: number) => {
    if (!uploadUrl.trim()) return;

    try {
      setIsUploading(true);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `video-segment-${index}-${timestamp}.webm`;

      const formData = new FormData();
      formData.append("file", blob, filename);
      formData.append("segmentIndex", index.toString());
      formData.append("timestamp", timestamp);

      console.log(`Uploading segment ${index} to:`, uploadUrl);
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`Segment ${index} uploaded successfully:`, result);
    } catch (error) {
      console.error(`Segment ${index} upload failed:`, error);
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Real-time Video Recording
        </h2>
        {isRecording && (
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            <span className="text-red-500 font-semibold">
              {formatTime(recordingTime)}
            </span>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">{statusMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}

      {/* Configuration */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resolution
          </label>
          <select
            value={resolution}
            onChange={(e) =>
              setResolution(e.target.value as "720p" | "1080p" | "480p")
            }
            disabled={isRecording}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="480p">480p (854×480)</option>
            <option value="720p">720p (1280×720)</option>
            <option value="1080p">1080p (1920×1080)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frame Rate (fps)
            </label>
            <select
              value={framerate}
              onChange={(e) => setFramerate(Number(e.target.value))}
              disabled={isRecording}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={24}>24 fps</option>
              <option value={30}>30 fps</option>
              <option value={60}>60 fps</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bitrate (Mbps)
            </label>
            <input
              type="number"
              value={bitrate}
              onChange={(e) => setBitrate(Number(e.target.value))}
              disabled={isRecording}
              min="0.5"
              max="10"
              step="0.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Codec
            </label>
            <select
              value={codec}
              onChange={(e) => setCodec(e.target.value as "vp8" | "vp9")}
              disabled={isRecording}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="vp8">VP8</option>
              <option value="vp9">VP9</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Segment Duration (s)
            </label>
            <input
              type="number"
              value={segmentDuration}
              onChange={(e) => setSegmentDuration(Number(e.target.value))}
              disabled={isRecording}
              min="1"
              max="60"
              step="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableRealtimePlayback}
              onChange={(e) => setEnableRealtimePlayback(e.target.checked)}
              disabled={isRecording}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Enable Real-time Playback
            </span>
          </label>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 flex gap-3">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            <VideoIcon className="w-5 h-5" />
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            <Square className="w-5 h-5" />
            Stop Recording
          </button>
        )}

        {(currentSegmentBlob || recordedSegments.length > 0) && (
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            <Play className="w-5 h-5" />
            {isPlaying ? "Pause" : "Play"}
          </button>
        )}
      </div>

      {/* Video Preview */}
      <div className="mb-6">
        {(currentSegmentBlob || recordedSegments.length > 0) ? (
          <video
            ref={videoRef}
            controls
            className="w-full rounded-lg bg-gray-900"
            style={{ maxHeight: "400px" }}
            onLoadedMetadata={() => {
              console.log("Video metadata loaded");
            }}
            onError={(e) => {
              const video = e.currentTarget;
              const error = video.error;
              if (error) {
                console.error("Video playback error:", {
                  code: error.code,
                  message: error.message,
                });
                setErrorMessage(
                  `Video playback error (${error.code}): ${error.message || "Unknown error"}`
                );
              }
            }}
          />
        ) : (
          <div className="w-full rounded-lg bg-gray-900 flex items-center justify-center" style={{ minHeight: "300px", maxHeight: "400px" }}>
            <div className="text-center text-gray-400">
              <VideoIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No video available</p>
              <p className="text-xs mt-2">Start recording to generate segments</p>
            </div>
          </div>
        )}
      </div>

      {/* Segments */}
      {recordedSegments.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Recorded Segments ({recordedSegments.length})
          </h3>
          <div className="space-y-2">
            {recordedSegments.map((segment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-sm text-gray-700">
                  Segment {index + 1} ({(segment.size / 1024 / 1024).toFixed(2)} MB)
                </span>
                <button
                  onClick={() => handleDownloadSegment(segment, index + 1)}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Download
                </button>
              </div>
            ))}
            <button
              onClick={handleDownloadAll}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
            >
              Download All Segments
            </button>
          </div>
        </div>
      )}

      {/* Upload Configuration */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload URL (for auto-upload segments)
        </label>
        <input
          type="text"
          value={uploadUrl}
          onChange={(e) => setUploadUrl(e.target.value)}
          placeholder="https://example.com/upload"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Metadata */}
      {metadata && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Recording Info
          </h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p>Duration: {metadata.duration.toFixed(2)}s</p>
            <p>Frames: {metadata.frameCount}</p>
            <p>Resolution: {metadata.width}×{metadata.height}</p>
            <p>Frame Rate: {metadata.framerate} fps</p>
            <p>Total Segments: {recordedSegments.length}</p>
            <p>Total Size: {(totalDataSizeRef.current / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoLocalRecordingRealtime;

