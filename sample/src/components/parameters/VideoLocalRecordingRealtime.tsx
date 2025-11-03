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
  const isRecordingRef = useRef(false); // Ref to track recording state in cleanup
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedSegments, setRecordedSegments] = useState<Blob[]>([]);
  const [currentSegmentBlob, setCurrentSegmentBlob] = useState<Blob | null>(
    null
  );
  const [metadata, setMetadata] = useState<RecordingMetadata | null>(null);
  const [sessionId] = useState(
    () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  // Configuration
  const [resolution, setResolution] = useState<"720p" | "1080p" | "480p">(
    "720p"
  );
  const [framerate, setFramerate] = useState(30);
  const [bitrate, setBitrate] = useState(2);
  const [codec, setCodec] = useState<"vp8" | "vp9">("vp8");
  const [maxDuration, setMaxDuration] = useState(300);
  const [segmentDuration, setSegmentDuration] = useState(10); // seconds per segment
  const [enableRealtimePlayback, setEnableRealtimePlayback] = useState(true);

  // Upload
  const [uploadUrl, setUploadUrl] = useState("http://localhost:8001");
  const uploadUrlRef = useRef("http://localhost:8001"); // Ref to always access latest uploadUrl value
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
            console.log(
              `Segment ${segmentIndexRef.current} created: ${blob.size} bytes`
            );

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
          if (
            isSegment &&
            enableRealtimePlayback &&
            videoRef.current &&
            recorderRef.current
          ) {
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

      // 简化方案：不使用MediaSource
      // 使用简单的blob合并方式
      // 点击Play时会合并所有segments并播放

      // Handle messages from Worker
      processorRef.current.port.onmessage = async (event: MessageEvent) => {
        if (!event.data) return;

        const {
          type,
          chunk,
          metadata: chunkMetadata,
          config,
          message,
          metadata: recordingMetadata,
        } = event.data;

        switch (type) {
          case "start":
            setStatusMessage(message || "Recording started");
            setErrorMessage("");
            break;

          case "segment":
            // Received complete WebM segment from Worker
            if (event.data.segment) {
              const segmentBlob = new Blob([event.data.segment], {
                type: "video/webm",
              });

              setRecordedSegments((prev) => [...prev, segmentBlob]);
              setCurrentSegmentBlob(segmentBlob);
              segmentIndexRef.current =
                event.data.segmentIndex || recordedSegments.length;
              const segmentMetadata = event.data.metadata || {};

              console.log(
                `Received segment ${segmentIndexRef.current}: ${
                  segmentBlob.size
                } bytes, total segments: ${recordedSegments.length + 1}`
              );
              console.log(`Segment metadata:`, segmentMetadata);

              // Upload segment with metadata if URL provided
              // Use ref to get the latest uploadUrl value (avoid stale closure)
              const currentUploadUrl = uploadUrlRef.current;
              console.log(
                `Upload URL check: uploadUrl='${currentUploadUrl}', trimmed='${currentUploadUrl.trim()}', isEmpty=${!currentUploadUrl.trim()}`
              );
              if (currentUploadUrl.trim()) {
                console.log(`✓ Upload URL is set, calling uploadSegment...`);
                uploadSegment(
                  segmentBlob,
                  segmentIndexRef.current,
                  segmentMetadata
                );
              } else {
                console.warn(
                  `⚠️ Upload URL is empty, segment will NOT be uploaded`
                );
              }
            }
            break;

          case "chunk":
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

          case "stop":
            // Worker has already created final segment and stopped
            // Just cleanup recorder state
            if (recorderRef.current) {
              try {
                // For chunk recording mode, segments are created in Worker
                // Just cleanup, don't call stop() which expects MediaRecorder mode
                recorderRef.current.cleanup();
              } catch (error) {
                console.error("Error cleaning up recorder:", error);
              }
            }
            setStatusMessage(message || "Recording stopped");
            if (recordingMetadata) {
              setMetadata(recordingMetadata);
            }
            setIsRecording(false);
            isRecordingRef.current = false; // Update ref when stopped
            break;

          case "error":
            setErrorMessage(message || "Unknown error");
            setStatusMessage("");
            setIsRecording(false);
            isRecordingRef.current = false; // Update ref on error
            break;

          case "status":
            setStatusMessage(message || "");
            setErrorMessage("");
            break;

          default:
            console.warn("Unknown message type:", type);
        }
      };
    }

    return () => {
      // Cleanup only when component unmounts AND not recording
      // Don't cleanup during recording as it will close MediaSource
      console.log(
        "useEffect cleanup: isRecordingRef.current =",
        isRecordingRef.current
      );
      if (recorderRef.current && !isRecordingRef.current) {
        console.log("Cleaning up playback (MediaSource will be closed)");
        recorderRef.current.cleanupPlayback();
      } else if (isRecordingRef.current) {
        console.log("Skipping cleanup - recording in progress");
      }
    };
  }, [processor]); // Only re-run when processor changes (which should be rare)

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

  // Note: Removed useEffect that was automatically setting video.src
  // It was overwriting the MediaSource that setupPlayback() creates.
  // Now RealtimeVideoRecorder.playSegment() handles segment playback via MediaSource.

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
      isRecordingRef.current = true; // Update ref for cleanup
      setRecordedSegments([]);
      setCurrentSegmentBlob(null);
      segmentIndexRef.current = 0;
      totalDataSizeRef.current = 0;
      setRecordingTime(0);

      const { width, height } = getResolutionDimensions(resolution);

      // MediaSource is already setup in useEffect - no need to setup again
      // Just start the chunk recording

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
      isRecordingRef.current = false; // Update ref on error
      setErrorMessage(
        `Failed to start recording: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const stopRecording = async () => {
    if (!processorRef.current) {
      return;
    }

    setIsRecording(false);
    isRecordingRef.current = false; // Update ref when stopping

    // Send stop command to Worker
    // Worker will create final segment and cleanup
    if (processorRef.current.port) {
      processorRef.current.port.postMessage({
        command: "stop",
      });
    }

    // Note: For real-time chunk recording, segments are created in Worker
    // The recorder cleanup is handled in the 'stop' message handler

    // If upload is enabled, finalize the recording on server
    // Use ref to get the latest uploadUrl value
    if (uploadUrlRef.current.trim()) {
      // Wait a bit for the final segment to be uploaded
      setTimeout(() => {
        finalizeRecording();
      }, 1000);
    }
  };

  const handlePreview = async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        // Check if we have segments to play
        if (recordedSegments.length === 0) {
          setErrorMessage(
            "No video segment available to play. Please record a segment first."
          );
          return;
        }

        console.log(`Playing ${recordedSegments.length} segments combined`);

        // 简单方案：合并所有segments为一个blob
        // 这样可以seekable，浏览器支持progressive download
        const combinedBlob = new Blob(recordedSegments, { type: "video/webm" });
        const blobUrl = URL.createObjectURL(combinedBlob);

        // Cleanup previous blob URL
        if (videoRef.current.src && videoRef.current.src.startsWith("blob:")) {
          URL.revokeObjectURL(videoRef.current.src);
        }

        // Set new source
        videoRef.current.src = blobUrl;
        videoRef.current.load();

        console.log(
          `Combined blob size: ${(combinedBlob.size / 1024 / 1024).toFixed(
            2
          )} MB`
        );

        await videoRef.current.play();
        setIsPlaying(true);
        setErrorMessage("");
      } catch (error) {
        console.error("Preview playback failed:", error);
        setErrorMessage(
          `Preview playback failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
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
        `Download failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
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
        `Download failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const uploadSegment = async (blob: Blob, index: number, metadata?: any) => {
    // Use ref to get the latest uploadUrl value
    const currentUploadUrl = uploadUrlRef.current;
    if (!currentUploadUrl.trim()) return;

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append(
        "file",
        blob,
        `segment-${String(index).padStart(4, "0")}.webm`
      );
      formData.append("sessionId", sessionId);
      formData.append("segmentIndex", index.toString());

      if (metadata) {
        formData.append("metadata", JSON.stringify(metadata));
      }

      console.log(
        `Uploading segment ${index} to ${currentUploadUrl}/api/recordings/segment (session: ${sessionId})`
      );
      const response = await fetch(
        `${currentUploadUrl}/api/recordings/segment`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✓ Segment ${index} uploaded:`, result);
      setStatusMessage(
        `Uploaded segment ${index} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`
      );
    } catch (error) {
      console.error(`✗ Segment ${index} upload failed:`, error);
      setErrorMessage(
        `Upload failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const finalizeRecording = async () => {
    // Use ref to get the latest uploadUrl value
    const currentUploadUrl = uploadUrlRef.current;
    if (!currentUploadUrl.trim()) return;

    try {
      console.log(`Finalizing recording for session ${sessionId}...`);
      setStatusMessage("Merging segments on server...");

      const response = await fetch(
        `${currentUploadUrl}/api/recordings/finalize`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            method: "concat", // Use ffmpeg concat (reliable and professional)
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Finalize failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("✓ Recording finalized:", result);
      setStatusMessage(
        `Recording complete! ${result.segmentCount} segments merged (${result.sizeFormatted}). ` +
          `Download: ${currentUploadUrl}${result.outputPath}`
      );
    } catch (error) {
      console.error("✗ Finalize failed:", error);
      setErrorMessage(
        `Failed to merge segments: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Real-time Video Recording
          </h2>
          <a
            href={`${uploadUrl}/admin/recordings.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            View Recordings
          </a>
        </div>
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
                  Segment {index + 1} ({(segment.size / 1024 / 1024).toFixed(2)}{" "}
                  MB)
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
          Server URL
        </label>
        <input
          type="text"
          value={uploadUrl}
          onChange={(e) => {
            const newUrl = e.target.value;
            setUploadUrl(newUrl);
            uploadUrlRef.current = newUrl; // Keep ref in sync
          }}
          placeholder="http://localhost:8001"
          disabled={isRecording}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
        <p className="mt-1 text-xs text-gray-500">
          Segments will be automatically uploaded to this server
        </p>
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
            <p>
              Resolution: {metadata.width}×{metadata.height}
            </p>
            <p>Frame Rate: {metadata.framerate} fps</p>
            <p>Total Segments: {recordedSegments.length}</p>
            <p>
              Total Size: {(totalDataSizeRef.current / 1024 / 1024).toFixed(2)}{" "}
              MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoLocalRecordingRealtime;

