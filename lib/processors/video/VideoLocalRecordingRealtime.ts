import { Output, WebMOutputFormat, BufferTarget, EncodedVideoPacketSource, VideoCodec, EncodedPacket } from 'mediabunny';

interface VideoRecordingConfig {
  width?: number;
  height?: number;
  framerate?: number;
  bitrate?: number;
  codec?: string;
  maxDuration?: number;
  format?: 'webm' | 'mp4';
  realtime?: boolean; // Enable real-time streaming mode
  segmentDuration?: number; // Duration in seconds for each segment
}

/**
 * Real-time video recording processor
 * Encodes video frames in Worker and streams encoded chunks to main thread
 * for real-time recording, transmission, and playback
 */
class VideoLocalRecordingRealtime extends VideoProcessor {
  // Recording state
  private isRecording: boolean = false;
  private frameCount: number = 0;
  private startTime: number = 0;
  private recordingStartTimestamp: number = 0;

  // Encoder and MediaBunny for segment creation
  private videoEncoder: VideoEncoder | null = null;
  private output: Output | null = null;
  private outputTarget: BufferTarget | null = null;
  private videoSource: EncodedVideoPacketSource | null = null;

  // Configuration
  private config: VideoRecordingConfig = {
    width: 1280,
    height: 720,
    framerate: 30,
    bitrate: 2_000_000, // 2 Mbps
    codec: 'vp8',
    maxDuration: 300, // 5 minutes
    format: 'webm',
    realtime: true, // Default to real-time mode
    segmentDuration: 10, // 10 seconds per segment
  };

  // Drawing context for passthrough
  private context: OffscreenCanvasRenderingContext2D | null = null;

  // Max duration timer
  private maxDurationTimer: any = null;

  // Segment timer
  private segmentTimer: any = null;
  private segmentIndex: number = 0;
  private needsSegmentSplit: boolean = false; // Flag to request segment split at next keyframe
  
  // Store decoder config for new segments
  private decoderConfig: EncodedVideoChunkMetadata | null = null;
  private isFirstChunkInSegment: boolean = true;
  private pendingChunks: Array<{ chunk: EncodedVideoChunk; metadata: EncodedVideoChunkMetadata | undefined }> = [];
  private lastTimestamp: number = 0; // Track last timestamp from previous segment/GOP
  private firstFrameTimestamp: number = 0; // Track first frame's timestamp for relative timing
  private segmentStartTime: number = 0; // Track segment start time for metadata

  constructor(port: MessagePort, options?: any) {
    super(port, options);

    port.addEventListener('message', (e) => {
      const { command, config } = e.data;

      if (command === 'start') {
        this.startRecording(config);
      } else if (command === 'stop') {
        this.stopRecording();
      } else if (command === 'updateConfig') {
        this.updateConfig(config);
      }
    });
  }

  async processFrame(input: VideoFrame, output: OffscreenCanvas) {
    // Always passthrough the video frame to output
    if (!this.context) {
      this.context = output.getContext('2d');
    }

    if (this.context) {
      this.context.drawImage(input, 0, 0, output.width, output.height);
    }

    // If recording, encode the frame
    if (this.isRecording && this.videoEncoder && this.videoEncoder.state === 'configured') {
      try {
        // Track first frame timestamp for relative timing
        if (this.frameCount === 0) {
          this.firstFrameTimestamp = input.timestamp;
          console.log(`First frame: input.timestamp=${input.timestamp}μs (${(input.timestamp / 1_000_000).toFixed(3)}s)`);
        }

        // Calculate relative timestamp from first frame
        const relativeTimestamp = input.timestamp - this.firstFrameTimestamp;

        // Log first few frames to see actual timing
        if (this.frameCount < 3) {
          const relativeSeconds = relativeTimestamp / 1_000_000;
          const theoreticalTimestamp = this.frameCount / (this.config.framerate || 30);
          console.log(`Frame ${this.frameCount}: relativeTime=${relativeSeconds.toFixed(3)}s, theoretical=${theoreticalTimestamp.toFixed(3)}s, delta=${(relativeSeconds - theoreticalTimestamp).toFixed(3)}s`);
        }

        // Clone the frame for encoding
        // Use relative timestamp starting from 0
        const clonedFrame = new VideoFrame(input, {
          timestamp: relativeTimestamp, // Use relative timestamp from recording start
        });

        // Determine if this should be a keyframe
        // For new segments, we need a keyframe more frequently
        // Every 30 frames (1 second at 30fps), if this is the first frame after a segment,
        // or if a segment split is requested
        const keyFrame = this.frameCount % 30 === 0 || this.isFirstChunkInSegment || this.needsSegmentSplit;

        // Check encoder queue size to prevent memory buildup
        if (this.videoEncoder.encodeQueueSize < 10) {
          // Log first frame
          if (this.frameCount === 0) {
            console.log(`First frame encoded at ${new Date().toISOString()}, timestamp: ${clonedFrame.timestamp}μs`);
          }
          this.videoEncoder.encode(clonedFrame, { keyFrame });
          this.frameCount++;
        } else {
          console.warn('Encoder queue is full, dropping frame');
        }

        clonedFrame.close();
      } catch (error) {
        console.error('Error encoding frame:', error);
        // Don't stop recording on individual frame errors
      }
    }

    return true;
  }

  onInit() {
    console.log('VideoLocalRecordingRealtime processor initialized');
    const canvas = this.getOutput();
    if (canvas) {
      this.context = canvas.getContext('2d');
    }
  }

  onUninit() {
    console.log('VideoLocalRecordingRealtime processor uninitialized');
    this.cleanup();
  }

  private updateConfig(config: VideoRecordingConfig) {
    if (this.isRecording) {
      console.warn('Cannot update config while recording');
      return;
    }
    this.config = { ...this.config, ...config };
    console.log('Recording config updated:', this.config);
  }

  private async startRecording(config?: VideoRecordingConfig) {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      // Update config if provided
      if (config) {
        this.config = { ...this.config, ...config };
      }

      console.log('Starting real-time video recording with config:', this.config);

      // Check if VideoEncoder is supported
      if (typeof VideoEncoder === 'undefined') {
        throw new Error('VideoEncoder is not supported in this browser');
      }

      // Determine codec string
      const codecString = this.config.codec === 'vp9' 
        ? 'vp09.00.10.08' 
        : 'vp8';

      // Check codec support first
      const support = await VideoEncoder.isConfigSupported({
        codec: codecString,
        width: this.config.width!,
        height: this.config.height!,
        bitrate: this.config.bitrate,
        framerate: this.config.framerate,
      });

      if (!support.supported) {
        throw new Error(`Codec ${codecString} is not supported`);
      }

      // Initialize MediaBunny Output for segment creation
      this.outputTarget = new BufferTarget();
      this.output = new Output({
        format: new WebMOutputFormat(),
        target: this.outputTarget,
      });

      // Create video source for encoded packets
      const videoCodec: VideoCodec = this.config.codec === 'vp9' ? 'vp9' : 'vp8';
      this.videoSource = new EncodedVideoPacketSource(videoCodec);

      // Add video track to output
      this.output.addVideoTrack(this.videoSource, {
        frameRate: this.config.framerate,
      });

      // Start MediaBunny output
      await this.output.start();

      // Initialize VideoEncoder for real-time streaming
      this.videoEncoder = new VideoEncoder({
        output: async (chunk, metadata) => {
          // Add encoded chunk to MediaBunny source for segment assembly
          if (this.videoSource) {
            try {
              // Store decoder config from first chunk
              if (metadata?.decoderConfig && !this.decoderConfig) {
                this.decoderConfig = metadata;
              }

              // Calculate timestamp in seconds
              const chunkTimestamp = chunk.timestamp / 1_000_000;
              // If chunk.duration is 0 or undefined, use theoretical frame duration
              let chunkDuration = chunk.duration ? (chunk.duration / 1_000_000) : 0;
              if (chunkDuration === 0) {
                // Use theoretical frame duration: 1 / framerate
                chunkDuration = 1.0 / (this.config.framerate || 30);
              }

              // Log chunk info for debugging timing issues
              if (this.frameCount % 30 === 0) {
                console.log(`Frame ${this.frameCount}: type=${chunk.type}, timestamp=${chunkTimestamp.toFixed(3)}s, duration=${chunkDuration.toFixed(3)}s (${chunk.duration ? 'actual' : 'calculated'}), lastTimestamp=${this.lastTimestamp.toFixed(3)}s`);
              }

              // Check if we need to split segment at this keyframe
              // Must be after a segment has started (not the very first chunk of recording)
              // We check !isFirstChunkInSegment to ensure we have at least one chunk in current segment
              if (this.needsSegmentSplit) {
                console.log(`Segment split requested. Chunk type: ${chunk.type}, isFirstChunkInSegment: ${this.isFirstChunkInSegment}`);
                if (chunk.type === 'key' && !this.isFirstChunkInSegment) {
                  console.log('Creating segment at requested keyframe');
                  await this.createAndSendSegment();
                  this.needsSegmentSplit = false;
                  // After creating segment, this chunk becomes the first chunk of new segment
                  // So continue processing below
                } else if (chunk.type !== 'key') {
                  console.log('Waiting for keyframe to split segment (current chunk is delta)');
                }
              }

              // For first chunk in a new segment:
              // 1. Must be a key frame
              // 2. Must include decoder config
              // 3. Timestamp must be >= last timestamp from previous GOP
              if (this.isFirstChunkInSegment) {
                // If this is not a key frame, queue it and wait for next key frame
                if (chunk.type !== 'key') {
                  console.log('Queuing non-key frame, waiting for key frame to start new segment');
                  this.pendingChunks.push({ chunk, metadata });
                  return;
                }

                // Ensure we have decoder config for first chunk
                if (!this.decoderConfig && !metadata?.decoderConfig) {
                  console.warn('No decoder config available for first chunk in segment, queuing');
                  this.pendingChunks.push({ chunk, metadata });
                  return;
                }

                // Ensure timestamp is >= last timestamp from previous segment
                // If not, adjust it to be at least equal to last timestamp
                let adjustedTimestamp = chunkTimestamp;
                if (chunkTimestamp < this.lastTimestamp) {
                  console.log(`Adjusting timestamp from ${chunkTimestamp}s to ${this.lastTimestamp}s`);
                  adjustedTimestamp = this.lastTimestamp;
                }

                // This is a key frame, use it to start the segment
                // Must include decoder config for first chunk
                // Ensure we use the stored decoderConfig if available, otherwise use current metadata
                const metadataToSend: EncodedVideoChunkMetadata = this.decoderConfig 
                  ? { ...this.decoderConfig }
                  : (metadata ? { ...metadata } : { decoderConfig: undefined as any });
                
                // If metadataToSend doesn't have decoderConfig, try to get it from metadata
                if (!metadataToSend.decoderConfig) {
                  if (metadata?.decoderConfig) {
                    metadataToSend.decoderConfig = metadata.decoderConfig;
                  } else if (this.decoderConfig?.decoderConfig) {
                    metadataToSend.decoderConfig = this.decoderConfig.decoderConfig;
                  } else {
                    console.error('No decoder config available for first chunk');
                    return;
                  }
                }
                
                const chunkData = new Uint8Array(chunk.byteLength);
                chunk.copyTo(chunkData);
                
                const packet = new EncodedPacket(
                  chunkData,
                  chunk.type,
                  adjustedTimestamp,
                  chunkDuration,
                  this.frameCount,
                  chunk.byteLength
                );

                await this.videoSource.add(packet, metadataToSend);
                this.isFirstChunkInSegment = false;
                this.lastTimestamp = Math.max(this.lastTimestamp, adjustedTimestamp + chunkDuration);

                // Now process any pending chunks
                for (const pending of this.pendingChunks) {
                  try {
                    const pendingTimestamp = pending.chunk.timestamp / 1_000_000;
                    const pendingDuration = (pending.chunk.duration || 0) / 1_000_000;
                    // Adjust timestamp to be >= lastTimestamp
                    const adjustedPendingTimestamp = Math.max(this.lastTimestamp, pendingTimestamp);
                    
                    const pendingData = new Uint8Array(pending.chunk.byteLength);
                    pending.chunk.copyTo(pendingData);
                    
                    const pendingPacket = new EncodedPacket(
                      pendingData,
                      pending.chunk.type,
                      adjustedPendingTimestamp,
                      pendingDuration,
                      this.frameCount,
                      pending.chunk.byteLength
                    );

                    await this.videoSource.add(pendingPacket, pending.metadata);
                    this.lastTimestamp = Math.max(this.lastTimestamp, adjustedPendingTimestamp + pendingDuration);
                  } catch (error) {
                    console.error('Error processing pending chunk:', error);
                  }
                }
                this.pendingChunks = [];
              } else {
                // Subsequent chunks use normal metadata
                // Ensure timestamp is >= last timestamp
                let adjustedTimestamp = chunkTimestamp;
                if (chunkTimestamp < this.lastTimestamp) {
                  adjustedTimestamp = this.lastTimestamp;
                }
                
                const chunkData = new Uint8Array(chunk.byteLength);
                chunk.copyTo(chunkData);
                
                const packet = new EncodedPacket(
                  chunkData,
                  chunk.type,
                  adjustedTimestamp,
                  chunkDuration,
                  this.frameCount,
                  chunk.byteLength
                );

                await this.videoSource.add(packet, metadata);
                this.lastTimestamp = Math.max(this.lastTimestamp, adjustedTimestamp + chunkDuration);
              }
            } catch (error) {
              console.error('Error adding chunk to MediaBunny source:', error);
              // If error is about first frame not being key, queue this chunk
              if (error instanceof Error && error.message.includes('First frame must be a key frame')) {
                console.log('First frame must be key, queueing chunk');
                this.pendingChunks.push({ chunk, metadata });
              }
            }
          }
        },
        error: (error) => {
          console.error('VideoEncoder error:', error);
          this.port.postMessage({
            type: 'error',
            message: `Encoder error: ${error.message}`,
          });
          this.stopRecording();
        },
      });

      // Configure encoder with low latency for real-time streaming
      this.videoEncoder.configure({
        codec: codecString,
        width: this.config.width!,
        height: this.config.height!,
        bitrate: this.config.bitrate,
        framerate: this.config.framerate,
        latencyMode: 'realtime', // Use realtime mode for low latency
      });

      // Reset counters
      this.frameCount = 0;
      this.segmentIndex = 0;
      this.startTime = performance.now();
      this.recordingStartTimestamp = Date.now();
      this.isRecording = true;
      this.decoderConfig = null;
      this.isFirstChunkInSegment = true;
      this.pendingChunks = [];
      this.lastTimestamp = 0; // Reset timestamp tracking for new recording
      this.needsSegmentSplit = false;
      this.firstFrameTimestamp = 0; // Reset first frame timestamp
      this.segmentStartTime = 0; // Reset segment start time

      console.log(`Recording started at ${new Date().toISOString()}, frameCount reset to 0`);

      // Set max duration timer
      if (this.config.maxDuration && this.config.maxDuration > 0) {
        this.maxDurationTimer = setTimeout(() => {
          console.log('Max duration reached, stopping recording');
          this.stopRecording();
        }, this.config.maxDuration * 1000);
      }

      // Set segment timer for periodic segment creation
      const segmentDurationMs = (this.config.segmentDuration || 10) * 1000;
      this.segmentTimer = setInterval(() => {
        // Request segment split at next keyframe instead of immediately
        // This ensures we don't wait too long for the next natural keyframe
        console.log(`Segment timer triggered after ${this.config.segmentDuration}s, requesting keyframe for segment split`);
        this.needsSegmentSplit = true;
      }, segmentDurationMs);

      // Send initial config to main thread
      this.port.postMessage({
        type: 'start',
        message: 'Real-time recording started',
        config: this.config,
      });

      console.log('Real-time video recording started successfully');
    } catch (error) {
      console.error('Failed to start real-time recording:', error);
      this.cleanup();
      this.port.postMessage({
        type: 'error',
        message: `Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async stopRecording() {
    if (!this.isRecording) {
      console.warn('Not currently recording');
      return;
    }

    console.log('Stopping real-time video recording...');
    this.isRecording = false;

    // Clear max duration timer
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    try {
      // Clear segment timer
      if (this.segmentTimer) {
        clearInterval(this.segmentTimer);
        this.segmentTimer = null;
      }

      // Flush encoder
      if (this.videoEncoder && this.videoEncoder.state === 'configured') {
        await this.videoEncoder.flush();
      }

      // Create and send final segment
      if (this.frameCount > 0) {
        await this.createAndSendSegment();
      }

      // Close encoder
      if (this.videoEncoder) {
        this.videoEncoder.close();
        this.videoEncoder = null;
      }

      const duration = (performance.now() - this.startTime) / 1000;

      // Notify main thread that recording has stopped
      this.port.postMessage({
        type: 'stop',
        message: 'Recording stopped',
        metadata: {
          frameCount: this.frameCount,
          duration: duration,
          width: this.config.width,
          height: this.config.height,
          framerate: this.config.framerate,
          timestamp: this.recordingStartTimestamp,
          segmentCount: this.segmentIndex,
        },
      });

      console.log(`Real-time recording complete: ${this.frameCount} frames, ${duration.toFixed(2)}s, ${this.segmentIndex} segments`);
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.port.postMessage({
        type: 'error',
        message: `Error stopping recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      this.cleanup();
    }
  }

  /**
   * Create and send a segment
   */
  private async createAndSendSegment(): Promise<void> {
    if (!this.isRecording || !this.output || !this.outputTarget) {
      return;
    }

    try {
      const segmentCreationTime = Date.now();
      const elapsedTime = (segmentCreationTime - this.recordingStartTimestamp) / 1000;
      console.log(`Creating segment ${this.segmentIndex}: frameCount=${this.frameCount}, elapsed time=${elapsedTime.toFixed(2)}s, lastTimestamp=${this.lastTimestamp.toFixed(2)}s`);

      // Finalize current segment
      await this.output.finalize();
      const buffer = this.outputTarget.buffer;

      if (buffer) {
        const bufferSize = buffer.byteLength;
        const segmentDuration = this.lastTimestamp - this.segmentStartTime;

        // Send segment to main thread with complete metadata
        this.port.postMessage(
          {
            type: 'segment',
            segment: buffer,
            segmentIndex: this.segmentIndex++,
            metadata: {
              startTime: this.segmentStartTime,
              endTime: this.lastTimestamp,
              duration: segmentDuration,
              frameCount: this.frameCount,
              width: this.config.width,
              height: this.config.height,
              framerate: this.config.framerate,
              codec: this.config.codec,
              bitrate: this.config.bitrate,
              size: bufferSize,
              timestamp: Date.now(),
            },
          },
          [buffer] // Transfer buffer ownership
        );

        console.log(`Segment ${this.segmentIndex - 1} sent: ${bufferSize} bytes, duration: ${segmentDuration.toFixed(2)}s (${this.segmentStartTime.toFixed(2)}s - ${this.lastTimestamp.toFixed(2)}s)`);

        // Update segment start time for next segment
        this.segmentStartTime = this.lastTimestamp;
      }

      // Reset for next segment
      this.outputTarget = new BufferTarget();
      this.output = new Output({
        format: new WebMOutputFormat(),
        target: this.outputTarget,
      });

      const videoCodec: VideoCodec = this.config.codec === 'vp9' ? 'vp9' : 'vp8';
      this.videoSource = new EncodedVideoPacketSource(videoCodec);
      this.output.addVideoTrack(this.videoSource, {
        frameRate: this.config.framerate,
      });

      await this.output.start();
      
      // Mark that next chunk will be first in new segment
      // Clear any pending chunks from previous segment (they're already processed or invalid)
      this.pendingChunks = [];
      this.isFirstChunkInSegment = true;
      
      // Note: lastTimestamp is preserved to ensure continuity between segments
    } catch (error) {
      console.error('Error creating segment:', error);
      this.port.postMessage({
        type: 'error',
        message: `Segment creation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private cleanup() {
    this.isRecording = false;

    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    if (this.segmentTimer) {
      clearInterval(this.segmentTimer);
      this.segmentTimer = null;
    }

    if (this.videoEncoder) {
      try {
        if (this.videoEncoder.state !== 'closed') {
          this.videoEncoder.close();
        }
      } catch (error) {
        console.error('Error closing encoder:', error);
      }
      this.videoEncoder = null;
    }

    if (this.output) {
      try {
        this.output.finalize().catch(console.error);
      } catch (error) {
        console.error('Error finalizing output:', error);
      }
      this.output = null;
    }

    this.outputTarget = null;
    this.videoSource = null;
    this.segmentIndex = 0;
    this.frameCount = 0;
    this.context = null;
    this.decoderConfig = null;
    this.isFirstChunkInSegment = true;
    this.needsSegmentSplit = false;
    this.firstFrameTimestamp = 0;
    this.lastTimestamp = 0;
    this.segmentStartTime = 0;
    
    // Cleanup pending chunks (chunks may already be closed or transferred)
    this.pendingChunks = [];
  }
}

registerProcessor('video-local-recording-realtime', VideoLocalRecordingRealtime);

