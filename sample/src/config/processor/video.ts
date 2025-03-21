import { Box, Binary, Gauge, Cpu, Video } from "lucide-react";
import DualMask from "../../components/parameters/DualMask";
import WatermarkEffect from "../../components/parameters/WatermarkEffect";
import { ProcessorConfig } from "../../index-types";

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

          // 2. notify framework whether the input is processed by the processor
          stream.addProcessor(processor);

          // 3. notify framework to remove the video processor if you don't need it anymore
          stream.removeProcessor(processor);
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
    implementation: {
      usage: `
          const processor: Processor = stream.createProcessor({
            url: 'https://example.com/watermark-processor.js',
            name: 'watermark-processor',
            type: 'video',
            options: {},
          });

          stream.addProcessor(processor);

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
};

export default videoConfig;
