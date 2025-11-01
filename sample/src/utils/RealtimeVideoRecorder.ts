/**
 * Real-time video recording manager for main thread
 * Receives encoded chunks from Worker and handles real-time recording, streaming, and playback
 */

interface RecordingConfig {
  codec: string;
  width: number;
  height: number;
  framerate: number;
  bitrate: number;
}

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
  temporalLayerId?: number;
  spatialLayerId?: number;
}

export type ChunkCallback = (blob: Blob, isSegment: boolean) => void;
export type StatusCallback = (status: string) => void;
export type ErrorCallback = (error: Error) => void;

export class RealtimeVideoRecorder {
  private config: RecordingConfig | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private canvasContext: CanvasRenderingContext2D | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  
  // Callbacks
  private chunkCallback: ChunkCallback | null = null;
  private statusCallback: StatusCallback | null = null;
  private errorCallback: ErrorCallback | null = null;

  // State
  private isRecording: boolean = false;
  private chunks: Blob[] = [];
  private segmentIndex: number = 0;
  private segmentDuration: number = 10; // 10 seconds per segment
  private segmentStartTime: number = 0;
  private totalDuration: number = 0;

  // Video decoder for playback
  private videoDecoder: VideoDecoder | null = null;
  private sourceBuffer: SourceBuffer | null = null;
  private mediaSource: MediaSource | null = null;
  private videoElement: HTMLVideoElement | null = null;

  constructor(options?: {
    onChunk?: ChunkCallback;
    onStatus?: StatusCallback;
    onError?: ErrorCallback;
    segmentDuration?: number;
  }) {
    if (options?.onChunk) this.chunkCallback = options.onChunk;
    if (options?.onStatus) this.statusCallback = options.onStatus;
    if (options?.onError) this.errorCallback = options.onError;
    if (options?.segmentDuration) this.segmentDuration = options.segmentDuration;
  }

  /**
   * Start real-time recording using MediaRecorder API
   */
  async startMediaRecorder(config: RecordingConfig): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    this.config = config;
    this.isRecording = true;
    this.segmentIndex = 0;
    this.segmentStartTime = Date.now();

    try {
      // Create a canvas to capture frames
      this.canvas = document.createElement('canvas');
      this.canvas.width = config.width;
      this.canvas.height = config.height;
      this.canvasContext = this.canvas.getContext('2d', {
        willReadFrequently: true,
      });

      if (!this.canvasContext) {
        throw new Error('Failed to get canvas context');
      }

      // Create MediaStream from canvas
      this.mediaStream = this.canvas.captureStream(config.framerate);
      this.videoTrack = this.mediaStream.getVideoTracks()[0];

      // Determine MIME type based on codec
      const mimeType = this.getMimeType(config.codec);
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`MIME type ${mimeType} is not supported`);
      }

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        videoBitsPerSecond: config.bitrate,
      });

      // Handle data chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
          
          // Check if we need to create a segment
          const currentTime = Date.now();
          const elapsed = (currentTime - this.segmentStartTime) / 1000;
          
          if (elapsed >= this.segmentDuration) {
            this.createSegment();
            this.segmentStartTime = currentTime;
            this.segmentIndex++;
          }

          // Call callback with chunk
          if (this.chunkCallback) {
            this.chunkCallback(event.data, false);
          }
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleStop();
      };

      this.mediaRecorder.onerror = (event) => {
        const error = new Error('MediaRecorder error');
        if (this.errorCallback) {
          this.errorCallback(error);
        }
      };

      // Start recording with timeslice for real-time chunks
      const timeslice = 100; // 100ms chunks
      this.mediaRecorder.start(timeslice);

      if (this.statusCallback) {
        this.statusCallback('Real-time recording started');
      }

      console.log('MediaRecorder started:', mimeType);
    } catch (error) {
      this.isRecording = false;
      const err = error instanceof Error ? error : new Error('Failed to start recording');
      if (this.errorCallback) {
        this.errorCallback(err);
      }
      throw err;
    }
  }

  /**
   * Start real-time recording using WebCodecs chunks from Worker
   */
  async startChunkRecording(config: RecordingConfig): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    this.config = config;
    this.isRecording = true;
    this.segmentIndex = 0;
    this.segmentStartTime = Date.now();
    this.chunks = [];

    if (this.statusCallback) {
      this.statusCallback('Real-time chunk recording started');
    }

    console.log('Chunk recording started');
  }

  // Chunk storage for segment assembly
  private chunkQueue: Array<{ chunk: VideoChunk; metadata?: ChunkMetadata }> = [];
  private decoderConfig: ChunkMetadata['decoderConfig'] | null = null;

  /**
   * Add encoded chunk from Worker
   */
  addChunk(chunk: VideoChunk, metadata?: ChunkMetadata): void {
    if (!this.isRecording || !this.config) {
      return;
    }

    try {
      // Store decoder config from first chunk
      if (metadata?.decoderConfig && !this.decoderConfig) {
        this.decoderConfig = metadata.decoderConfig;
      }

      // Store chunk in queue
      this.chunkQueue.push({ chunk, metadata });

      // Convert chunk to Blob for immediate callback (for transmission)
      const blob = new Blob([chunk.data], {
        type: 'application/octet-stream', // Raw chunk data, not playable WebM
      });

      // Note: Individual chunks are raw encoded data and cannot be played directly
      // They need to be assembled into WebM segments first

      // Check if we need to create a segment
      const currentTime = Date.now();
      const elapsed = (currentTime - this.segmentStartTime) / 1000;

      if (elapsed >= this.segmentDuration && this.chunkQueue.length > 0) {
        this.createSegmentFromChunks();
        this.segmentStartTime = currentTime;
        this.segmentIndex++;
        this.chunkQueue = []; // Reset chunks for next segment
        this.decoderConfig = null; // Reset decoder config for next segment
      }

      // Call callback with chunk (for transmission purposes)
      if (this.chunkCallback) {
        this.chunkCallback(blob, false);
      }
    } catch (error) {
      console.error('Error processing chunk:', error);
      if (this.errorCallback) {
        this.errorCallback(error instanceof Error ? error : new Error('Chunk processing error'));
      }
    }
  }

  /**
   * Create WebM segment from accumulated chunks
   * Note: This is a simplified version. In production, you'd use MediaBunny or webm-muxer
   * to properly assemble the chunks into a valid WebM segment
   */
  private createSegmentFromChunks(): void {
    if (this.chunkQueue.length === 0) {
      return;
    }

    try {
      // For now, we'll combine the chunks into a single blob
      // In a real implementation, you'd use MediaBunny to properly mux them
      const combinedChunks = this.chunkQueue.map(item => item.chunk.data);
      const segmentBlob = new Blob(combinedChunks, {
        type: this.getMimeType(this.config!.codec),
      });

      this.chunks.push(segmentBlob);

      // Create segment
      if (this.chunkCallback) {
        this.chunkCallback(segmentBlob, true);
      }

      console.log(`Segment ${this.segmentIndex} created from ${this.chunkQueue.length} chunks: ${segmentBlob.size} bytes`);
    } catch (error) {
      console.error('Error creating segment from chunks:', error);
      if (this.errorCallback) {
        this.errorCallback(error instanceof Error ? error : new Error('Segment creation error'));
      }
    }
  }

  /**
   * Update canvas with new frame (for MediaRecorder mode)
   */
  updateFrame(imageData: ImageBitmap | ImageData | HTMLImageElement | HTMLVideoElement): void {
    if (!this.canvasContext || !this.canvas) {
      return;
    }

    try {
      this.canvasContext.drawImage(imageData, 0, 0, this.canvas.width, this.canvas.height);
    } catch (error) {
      console.error('Error updating frame:', error);
    }
  }

  /**
   * Stop recording
   */
  async stop(): Promise<Blob> {
    // Check if we're using chunk recording mode (segments created in Worker)
    const isChunkRecordingMode = this.config && !this.mediaRecorder;

    // For chunk recording mode, segments are created in Worker
    // We don't need to stop anything here, just mark as not recording
    if (isChunkRecordingMode) {
      if (!this.isRecording) {
        // Already stopped, return empty blob
        return new Blob([], { type: this.getMimeType(this.config?.codec || 'vp8') });
      }
      
      // Mark as stopped and cleanup
      this.handleStop();
      this.cleanup();
      return new Blob([], { type: this.getMimeType(this.config?.codec || 'vp8') });
    }

    // For MediaRecorder mode
    if (!this.isRecording) {
      throw new Error('Not recording');
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      // Wait for stop event
      await new Promise((resolve) => {
        if (this.mediaRecorder) {
          this.mediaRecorder.onstop = () => {
            this.handleStop();
            resolve(undefined);
          };
        }
      });
    } else {
      this.handleStop();
    }

    // Create final segment from remaining chunks
    if (this.chunkQueue.length > 0) {
      this.createSegmentFromChunks();
    }

    // Create final blob from remaining chunks
    const finalBlob = new Blob(this.chunks, {
      type: this.getMimeType(this.config!.codec),
    });

    this.cleanup();
    return finalBlob;
  }

  /**
   * Create a segment file from accumulated chunks (legacy method for MediaRecorder mode)
   */
  private createSegment(): void {
    if (this.chunks.length === 0) {
      return;
    }

    const segmentBlob = new Blob(this.chunks, {
      type: this.getMimeType(this.config!.codec),
    });

    if (this.chunkCallback) {
      this.chunkCallback(segmentBlob, true);
    }

    console.log(`Segment ${this.segmentIndex} created: ${segmentBlob.size} bytes`);
  }

  /**
   * Get accumulated chunks for final segment creation
   */
  getAccumulatedChunks(): Array<{ chunk: VideoChunk; metadata?: ChunkMetadata }> {
    return [...this.chunkQueue];
  }

  private handleStop(): void {
    this.isRecording = false;
    if (this.statusCallback) {
      this.statusCallback('Recording stopped');
    }
  }

  cleanup(): void {
    if (this.videoTrack) {
      this.videoTrack.stop();
      this.videoTrack = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.canvas = null;
    this.canvasContext = null;
    this.mediaRecorder = null;
    this.isRecording = false;
    this.segmentIndex = 0;
    this.chunks = [];
    this.chunkQueue = [];
    this.decoderConfig = null;
  }

  private getMimeType(codec: string): string {
    switch (codec.toLowerCase()) {
      case 'vp8':
        return 'video/webm;codecs=vp8';
      case 'vp9':
        return 'video/webm;codecs=vp9';
      case 'h264':
      case 'avc1':
        return 'video/mp4;codecs=avc1';
      default:
        return 'video/webm;codecs=vp8';
    }
  }

  /**
   * Setup real-time playback using blob URLs for segments
   * Note: MediaSource Extensions requires complete WebM segments,
   * so we use blob URLs instead for simpler real-time playback
   */
  async setupPlayback(videoElement: HTMLVideoElement): Promise<void> {
    this.videoElement = videoElement;
    // Initialize with empty video - will be updated when segments arrive
    videoElement.src = '';
    videoElement.load();
    console.log('Playback setup completed - will use blob URLs for segments');
  }

  /**
   * Update video element with new segment blob for playback
   * Uses blob URL for simple real-time playback
   */
  appendChunkForPlayback(blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.videoElement) {
        reject(new Error('Video element not initialized'));
        return;
      }

      try {
        // For segments, create blob URL and update video source
        if (blob.size > 0) {
          // Only update if this is a meaningful segment (not just a small chunk)
          // For now, we'll use segment callbacks to update video
          // Individual chunks are too small to play
          resolve(undefined);
        } else {
          resolve(undefined);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Set video element source to a segment blob URL
   */
  playSegment(blob: Blob): void {
    if (!this.videoElement) return;

    try {
      const blobUrl = URL.createObjectURL(blob);
      this.videoElement.src = blobUrl;
      this.videoElement.load();
      
      // Auto-play if possible
      this.videoElement.play().catch((error) => {
        console.log('Auto-play prevented:', error);
      });

      // Cleanup previous blob URL
      if (this.videoElement.dataset.prevBlobUrl) {
        URL.revokeObjectURL(this.videoElement.dataset.prevBlobUrl);
      }
      this.videoElement.dataset.prevBlobUrl = blobUrl;
    } catch (error) {
      console.error('Error playing segment:', error);
    }
  }

  /**
   * Cleanup playback resources
   */
  cleanupPlayback(): void {
    if (this.videoElement) {
      // Cleanup blob URLs
      if (this.videoElement.dataset.prevBlobUrl) {
        URL.revokeObjectURL(this.videoElement.dataset.prevBlobUrl);
        delete this.videoElement.dataset.prevBlobUrl;
      }
      this.videoElement.src = '';
      this.videoElement = null;
    }

    this.mediaSource = null;
    this.sourceBuffer = null;
  }
}

