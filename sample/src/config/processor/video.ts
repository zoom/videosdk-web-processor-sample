import { Box, Binary, Gauge, Cpu, Video, Globe, Smartphone, Monitor, Apple, Laptop, SmartphoneIcon, VideoIcon } from "lucide-react";
import DualMask from "../../components/parameters/DualMask";
import WatermarkEffect from "../../components/parameters/WatermarkEffect";
import { ProcessorConfig } from "../../index-types";
import GamerLive from "../../components/parameters/GamerLive";
import VideoLocalRecording from "../../components/parameters/VideoLocalRecording";

const baseUrl = window.origin;

const videoConfig: Record<string, ProcessorConfig> = {
  "zoom-dual-mask-video-processor": {
    id: "zoom-dual-mask-video-processor",
    url: baseUrl + "/zoom-dual-mask-video-processor.js",
    options: {
      assetsUrlBase: baseUrl + "/assets/mediapipe",
    },
    render: DualMask,
    name: "Dual Mask",
    description:
      "Detect the face region in the video source and show it, other regions will be covered by the background image.",
    features: [{ icon: Video, text: "video pre-processor" }],
    platforms: [
      { icon: Globe, text: "Web" },
      { icon: Smartphone, text: "Android" },
      { icon: Apple, text: "iOS" },
      { icon: Laptop, text: "Windows" },
      { icon: Monitor, text: "Mac" }
    ],
    implementation: {
      usage: `
          // how to use ZoomDualMaskVideoProcessor in VideoSDK
          const processor: Processor = stream.createProcessor({
            url: 'https://example.com/zoom-dual-mask-video-processor.js',
            name: 'zoom-dual-mask-video-processor',
            type: 'video',
            options: {
              croppingShape: CROPPING_SHAPE.ELLIPSE,
              scaleFactor: 1.0,
              useAngle: false,
              zoomVideo: false,
            }
          });

          // 2. notify framework whether the input is processed by the processor (async)
          await stream.addProcessor(processor);

          // 3. notify framework to remove the video processor if you don't need it anymore (async)
          await stream.removeProcessor(processor);
        `,
      example: `
        // ZoomDualMaskVideoProcessor source code

        class ZoomDualMaskVideoProcessor extends VideoProcessor {
          // the background image layer defined in rendering pipeline
          private backgroundImage: ImageBitmap | null = null;
            
          // whether the dynamic mask engine is initialized
          // if yes, the dynamic mask engine will not be started again
          private isDynamicMaskInited = false;
            
          // real rendering engine that helps rendering and composition
          private dynamicMaskEngine = ZoomUtils.RenderEngine.getDynamicMaskEngine();

          constructor(port: MessagePort, options?: any) {
            super(port, options);

            this.port.addEventListener('message', (e) => {
              if (e.data.cmd === 'update_mask_background_image') {
                this.backgroundImage = e.data.data;
                if (this.isDynamicMaskInited && this.backgroundImage) {
                  this.dynamicMaskEngine.updateMaskImage(this.backgroundImage);
                }
              } else if (e.data.cmd === 'update_options') {
                this.options = e.data.data;
                if (this.dynamicMaskEngine) {
                  this.dynamicMaskEngine.updateMaskOptions(e.data.data);
                }
              }
            });
          }

          onInit() {
            console.log('initialize ZoomDualMaskVideoProcessor');
          }

          onUninit() {
            this.dynamicMaskEngine.uninitDynamicMaskEngine();
            this.isDynamicMaskInited = false;
            console.log('uninitialize ZoomDualMaskVideoProcessor');
          }

          processFrame(input: VideoFrame, output: OffscreenCanvas) {
            if (!this.backgroundImage || !detector || !input.visibleRect) {
              return false;
            }
            if (!this.isDynamicMaskInited) {
              this.dynamicMaskEngine.initDynamicMaskEngine(
                output,
                RENDERER_TYPE.WEBGL_2,
                this.backgroundImage,
                this.options
              );
              this.isDynamicMaskInited = true;
            }
            const detections = detector.detect(input).detections;
            this.dynamicMaskEngine.render(input, detections);
            return true;
          }
        }

        registerProcessor('zoom-dual-mask-video-processor', ZoomDualMaskVideoProcessor);
      `,
    },
    isInDevelopment: false,
  },
  "watermark-processor": {
    id: "watermark-processor",
    url: baseUrl + "/watermark-processor.js",
    options: {},
    render: WatermarkEffect,
    name: "Watermark Effect",
    description:
      "Add text similar to a watermark effect to the video source and send it to other attendees.",
    features: [{ icon: Video, text: "video pre-processor" }],
    platforms: [
      { icon: Globe, text: "Web" },
      { icon: Smartphone, text: "Android" },
      { icon: Apple, text: "iOS" }
    ],
    implementation: {
      usage: `
          const processor: Processor = stream.createProcessor({
            url: 'https://example.com/watermark-processor.js',
            name: 'watermark-processor',
            type: 'video',
            options: {},
          });

          await stream.addProcessor(processor);

          // update ImageBitmap
          processor.port.postMessage({
            cmd: 'update_watermark_image',
            data: imageBitmap
          });
        `,
      example: `
          class WatermarkProcessor extends VideoProcessor {
            private context: OffscreenCanvasRenderingContext2D | null = null;
            private watermarkImage: ImageBitmap | null = null;

            constructor(port: MessagePort, options?: any) {
              super(port, options);

              port.addEventListener('message', (e) => {
                if (e.data.cmd === 'update_watermark_image') {
                  this.updateWatermarkImage(e.data.data);
                }
              });
            }

            async processFrame(input: VideoFrame, output: OffscreenCanvas) {
              this.renderFrame(input, output);
              return true;
            }

            onInit() {
              const canvas = this.getOutput();
              if (canvas) {
                this.context = canvas.getContext('2d');
                if (!this.context) {
                  console.error('2D context could not be initialized.');
                }
              }
            }

            onUninit() {
              this.context = null;
              this.watermarkImage = null;
            }

            private updateWatermarkImage(ibm: ImageBitmap) {
              this.watermarkImage = ibm;
            }

            private renderFrame(input: VideoFrame, output: OffscreenCanvas) {
              if (!this.context) return;

              // Draw the video frame onto the canvas
              this.context.drawImage(input, 0, 0, output.width, output.height);

              // Overlay the watermark if available
              if (this.watermarkImage) {
                const watermarkWidth = output.width;
                const watermarkHeight = output.height;
                this.context.globalAlpha = 0.5;
                this.context.drawImage(
                  this.watermarkImage,
                  0,
                  0,
                  watermarkWidth,
                  watermarkHeight
                );
              }
            }
        }

        registerProcessor('watermark-processor', WatermarkProcessor);
        `,
    },
    isInDevelopment: false,
  },

  "gamer-live-video-processor": {
    id: "gamer-live-video-processor",
    url: baseUrl + "/gamer-live-video-processor.js",
    options: {
      assetsUrlBase: baseUrl + "/assets/mediapipe",
    },
    render: GamerLive,
    name: "Gamer Live",
    description:
      "Detect the face region in the video source and show it, other regions will be covered by the background image.",
    features: [{ icon: Video, text: "video pre-processor" }],
    platforms: [
      { icon: Globe, text: "Web" },
      { icon: Smartphone, text: "Android" },
      { icon: Apple, text: "iOS" }
    ],
    implementation: {
      usage: `
          const processor: Processor = stream.createProcessor({
            url: 'https://example.com/gamer-live-video-processor.js',
            name: 'gamer-live-video-processor',
            type: 'video',
            options: {
              croppingShape: CROPPING_SHAPE.ELLIPSE,
              scaleFactor: 1.0,
              useAngle: false,
              zoomVideo: false,
            }
          });

          await stream.addProcessor(processor);
        `,
      example: "",
    },
    isInDevelopment: true,
  },
  "demo-editor": {
    id: "demo-editor",
    url: baseUrl + "/demo-editor.js", // placeholder URL
    options: {},
    render: () => null, // no special parameters needed
    name: "Markdown Editor Demo",
    description:
      "Demonstration of the online markdown editing functionality. Try the 'Edit Documentation' feature!",
    features: [{ icon: Video, text: "documentation tool" }],
    platforms: [
      { icon: Globe, text: "Web" },
    ],
    implementation: {
      usage: `
          // This is a demo of the markdown editor
          // Click 'Edit Documentation' to try it out!
          console.log('Editor demo ready');
        `,
      example: `
          // Example of using the markdown editor
          const editor = new MarkdownEditor({
            content: '# Hello World',
            onSave: (content) => console.log('Saved:', content)
          });
        `,
    },
    isInDevelopment: false,
  },
  "theme-demo": {
    id: "theme-demo",
    url: baseUrl + "/theme-demo.js", // placeholder URL
    options: {},
    render: () => null, // no special parameters needed
    name: "Theme Demo",
    description:
      "Showcase the markdown theme system with live theme switching. Perfect for testing different themes!",
    features: [{ icon: Video, text: "theme showcase" }],
    platforms: [
      { icon: Globe, text: "Web" },
    ],
    implementation: {
      usage: `
          // Theme Demo Processor
          // Use the theme selector in the toolbar to switch themes
          const themeDemo = {
            name: 'Theme Demo',
            description: 'Live theme switching demonstration'
          };
        `,
      example: `
          // Example theme configuration
          const customTheme = {
            id: 'custom',
            name: 'Custom Theme',
            category: 'light',
            codeTheme: 'github',
            styles: {
              content: 'bg-white rounded-lg p-8',
              heading1: 'text-3xl font-bold text-blue-600',
              // ... more styles
            }
          };
        `,
    },
    isInDevelopment: false,
  },
  "video-local-recording": {
    id: "video-local-recording",
    url: baseUrl + "/video-local-recording.js",
    options: {},
    render: VideoLocalRecording,
    name: "Video Local Recording",
    description:
      "Record video stream locally in the browser using WebCodecs API. Supports VP8/VP9 encoding and WebM container format with configurable resolution, framerate, and bitrate.",
    features: [{ icon: Video, text: "video pre-processor" }],
    platforms: [
      { icon: Globe, text: "Web (Chrome/Edge)" },
    ],
    implementation: {
      usage: `
          // Create video local recording processor
          const processor: Processor = stream.createProcessor({
            url: 'https://example.com/video-local-recording.js',
            name: 'video-local-recording',
            type: 'video',
            options: {},
          });

          // Add processor to stream
          await stream.addProcessor(processor);

          // Start recording
          processor.port.postMessage({
            command: 'start',
            config: {
              width: 1280,
              height: 720,
              framerate: 30,
              bitrate: 2000000, // 2 Mbps
              codec: 'vp8', // or 'vp9'
              maxDuration: 300, // 5 minutes
            }
          });

          // Stop recording
          processor.port.postMessage({
            command: 'stop'
          });

          // Listen for encoded video data
          processor.port.onmessage = (event) => {
            if (event.data.type === 'encoding') {
              const videoBuffer = event.data.buffer;
              const metadata = event.data.metadata;
              // Handle the recorded video
            }
          };
        `,
      example: `
          import { Muxer, ArrayBufferTarget } from 'webm-muxer';

          class VideoLocalRecording extends VideoProcessor {
            private isRecording: boolean = false;
            private videoEncoder: VideoEncoder | null = null;
            private muxer: Muxer<ArrayBufferTarget> | null = null;
            private frameCount: number = 0;
            private config = {
              width: 1280,
              height: 720,
              framerate: 30,
              bitrate: 2_000_000,
              codec: 'vp8',
            };

            constructor(port: MessagePort, options?: any) {
              super(port, options);

              port.addEventListener('message', (e) => {
                const { command, config } = e.data;
                if (command === 'start') {
                  this.startRecording(config);
                } else if (command === 'stop') {
                  this.stopRecording();
                }
              });
            }

            async processFrame(input: VideoFrame, output: OffscreenCanvas) {
              // Passthrough video
              const ctx = output.getContext('2d');
              if (ctx) {
                ctx.drawImage(input, 0, 0, output.width, output.height);
              }

              // Encode frame if recording
              if (this.isRecording && this.videoEncoder) {
                const clonedFrame = new VideoFrame(input, {
                  timestamp: this.frameCount * (1_000_000 / this.config.framerate),
                });
                
                const keyFrame = this.frameCount % 30 === 0;
                this.videoEncoder.encode(clonedFrame, { keyFrame });
                clonedFrame.close();
                this.frameCount++;
              }

              return true;
            }

            private async startRecording(config?: any) {
              if (config) {
                this.config = { ...this.config, ...config };
              }

              // Initialize Muxer
              const target = new ArrayBufferTarget();
              this.muxer = new Muxer({
                target,
                video: {
                  codec: this.config.codec === 'vp9' ? 'V_VP9' : 'V_VP8',
                  width: this.config.width,
                  height: this.config.height,
                  frameRate: this.config.framerate,
                },
              });

              // Initialize VideoEncoder
              this.videoEncoder = new VideoEncoder({
                output: (chunk, metadata) => {
                  if (this.muxer) {
                    this.muxer.addVideoChunk(chunk, metadata);
                  }
                },
                error: (error) => {
                  console.error('VideoEncoder error:', error);
                },
              });

              // Configure encoder
              const codecString = this.config.codec === 'vp9' 
                ? 'vp09.00.10.08' 
                : 'vp8';

              this.videoEncoder.configure({
                codec: codecString,
                width: this.config.width,
                height: this.config.height,
                bitrate: this.config.bitrate,
                framerate: this.config.framerate,
              });

              this.isRecording = true;
              this.frameCount = 0;
            }

            private async stopRecording() {
              this.isRecording = false;

              // Flush encoder
              if (this.videoEncoder) {
                await this.videoEncoder.flush();
                this.videoEncoder.close();
              }

              // Finalize muxer
              if (this.muxer) {
                this.muxer.finalize();
                const { buffer } = this.muxer.target;

                // Send video buffer to main thread
                this.port.postMessage({
                  type: 'encoding',
                  videoFormat: 'webm',
                  buffer: buffer,
                }, [buffer]);
              }
            }

            onInit() {
              console.log('VideoLocalRecording initialized');
            }

            onUninit() {
              if (this.videoEncoder) {
                this.videoEncoder.close();
              }
            }
          }

          registerProcessor('video-local-recording', VideoLocalRecording);
        `,
    },
    isInDevelopment: false,
  }
};

export default videoConfig;
