import { Output, WebMOutputFormat, BufferTarget, EncodedVideoPacketSource, VideoCodec } from 'mediabunny';

interface VideoRecordingConfig {
  width?: number;
  height?: number;
  framerate?: number;
  bitrate?: number;
  codec?: string;
  maxDuration?: number;
  format?: 'webm' | 'mp4'; // Add format option
}

class VideoLocalRecording extends VideoProcessor {
  // Recording state
  private isRecording: boolean = false;
  private frameCount: number = 0;
  private startTime: number = 0;
  private recordingStartTimestamp: number = 0;

  // Encoder and MediaBunny Output
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
    format: 'webm', // Default to WebM
  };

  // Drawing context for passthrough
  private context: OffscreenCanvasRenderingContext2D | null = null;

  // Max duration timer
  private maxDurationTimer: any = null;

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
        // Clone the frame for encoding (original will be closed by SDK)
        const clonedFrame = new VideoFrame(input, {
          timestamp: this.frameCount * (1_000_000 / this.config.framerate!), // microseconds
        });

        // Determine if this should be a keyframe (every 30 frames / 1 second at 30fps)
        const keyFrame = this.frameCount % 30 === 0;

        // Check encoder queue size to prevent memory buildup
        if (this.videoEncoder.encodeQueueSize < 10) {
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
    console.log('VideoLocalRecording processor initialized');
    const canvas = this.getOutput();
    if (canvas) {
      this.context = canvas.getContext('2d');
    }
  }

  onUninit() {
    console.log('VideoLocalRecording processor uninitialized');
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

      console.log('Starting video recording with config:', this.config);

      // Check if VideoEncoder is supported
      if (typeof VideoEncoder === 'undefined') {
        throw new Error('VideoEncoder is not supported in this browser');
      }

      // Determine codec string and MediaBunny video codec
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

      // Initialize MediaBunny Output
      this.outputTarget = new BufferTarget();
      this.output = new Output({
        format: new WebMOutputFormat(),
        target: this.outputTarget,
      });

      // Create video source for encoded packets
      const videoCodec: VideoCodec = this.config.codec === 'vp9' ? 'vp9' : 'vp8';
      this.videoSource = new EncodedVideoPacketSource(videoCodec);

      // Add video track to output
      // MediaBunny will automatically detect width/height from the encoder config
      this.output.addVideoTrack(this.videoSource, {
        frameRate: this.config.framerate,
      });

      // Initialize VideoEncoder
      this.videoEncoder = new VideoEncoder({
        output: async (chunk, metadata) => {
          if (this.videoSource) {
            try {
              // Add encoded packet to MediaBunny source
              // MediaBunny expects EncodedPacket, which is compatible with EncodedVideoChunk
              await this.videoSource.add(chunk as any, metadata);
            } catch (error) {
              console.error('Error adding video chunk to source:', error);
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

      // Configure encoder
      this.videoEncoder.configure({
        codec: codecString,
        width: this.config.width!,
        height: this.config.height!,
        bitrate: this.config.bitrate,
        framerate: this.config.framerate,
        latencyMode: 'quality',
      });

      // Start MediaBunny output
      await this.output.start();

      // Reset counters
      this.frameCount = 0;
      this.startTime = performance.now();
      this.recordingStartTimestamp = Date.now();
      this.isRecording = true;

      // Set max duration timer
      if (this.config.maxDuration && this.config.maxDuration > 0) {
        this.maxDurationTimer = setTimeout(() => {
          console.log('Max duration reached, stopping recording');
          this.stopRecording();
        }, this.config.maxDuration * 1000);
      }

      this.port.postMessage({
        type: 'status',
        message: 'Recording started',
        config: this.config,
      });

      console.log('Video recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
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

    console.log('Stopping video recording...');
    this.isRecording = false;

    // Clear max duration timer
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    try {
      // Flush and close encoder
      if (this.videoEncoder) {
        if (this.videoEncoder.state === 'configured') {
          await this.videoEncoder.flush();
        }
        this.videoEncoder.close();
        this.videoEncoder = null;
      }

      // Finalize MediaBunny output and get the video buffer
      if (this.output && this.outputTarget) {
        await this.output.finalize();
        const buffer = this.outputTarget.buffer;

        if (buffer) {
          const duration = (performance.now() - this.startTime) / 1000;
          const fileSize = buffer.byteLength;
          const avgBitrate = (fileSize * 8) / duration; // bits per second

          console.log(`Recording complete: ${this.frameCount} frames, ${duration.toFixed(2)}s, ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

          // Send the video buffer back to main thread
          this.port.postMessage(
            {
              type: 'encoding',
              videoFormat: this.config.format || 'webm',
              codec: this.config.codec,
              buffer: buffer,
              metadata: {
                frameCount: this.frameCount,
                duration: duration,
                fileSize: fileSize,
                width: this.config.width,
                height: this.config.height,
                framerate: this.config.framerate,
                bitrate: avgBitrate,
                timestamp: this.recordingStartTimestamp,
              },
            },
            [buffer] // Transfer buffer ownership
          );
        }

        this.output = null;
        this.outputTarget = null;
        this.videoSource = null;
      }

      this.port.postMessage({
        type: 'status',
        message: 'Recording stopped',
      });
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

  private cleanup() {
    this.isRecording = false;

    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
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

    this.output = null;
    this.outputTarget = null;
    this.videoSource = null;
    this.frameCount = 0;
    this.context = null;
  }
}

registerProcessor('video-local-recording', VideoLocalRecording);
