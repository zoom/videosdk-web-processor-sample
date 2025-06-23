import {
  Box,
  Binary,
  Gauge,
  Cpu,
  Video,
  Globe,
  Smartphone,
  Monitor,
  Apple,
  Laptop,
  SmartphoneIcon,
  Sparkles,
  User,
  Sticker,
} from "lucide-react";
import DualMask from "../../components/parameters/DualMask";
import WatermarkEffect from "../../components/parameters/WatermarkEffect";
import SmartVirtualBackground from "../../components/parameters/SmartVirtualBackground";
import VideoBusinessCard from "../../components/parameters/VideoBusinessCard";
import VideoStickers from "../../components/parameters/VideoStickers";
import { ProcessorConfig } from "../../index-types";
import GamerLive from "../../components/parameters/GamerLive";

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
      { icon: Monitor, text: "Mac" },
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
    platforms: [
      { icon: Globe, text: "Web" },
      { icon: Smartphone, text: "Android" },
      { icon: Apple, text: "iOS" },
    ],
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
      { icon: Apple, text: "iOS" },
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

          stream.addProcessor(processor);
        `,
      example: "",
    },
    isInDevelopment: true,
  },

  "smart-virtual-background": {
    id: "smart-virtual-background",
    url: baseUrl + "/smart-virtual-background.js",
    options: {},
    render: SmartVirtualBackground,
    name: "智能虚拟背景",
    description:
      "通过AI技术根据文本描述动态生成个性化背景图像，实现智能虚拟背景替换功能。",
    features: [
      { icon: Sparkles, text: "AI生成背景" },
      { icon: Video, text: "实时背景替换" },
      { icon: Cpu, text: "智能抠图" },
    ],
    platforms: [
      { icon: Globe, text: "Web" },
      { icon: Smartphone, text: "Android" },
      { icon: Apple, text: "iOS" },
      { icon: Laptop, text: "Windows" },
      { icon: Monitor, text: "Mac" },
    ],
    implementation: {
      usage: `
          const processor: Processor = stream.createProcessor({
            url: 'https://example.com/smart-virtual-background.js',
            name: 'smart-virtual-background',
            type: 'video',
            options: {
              backgroundType: 'ai-generated',
              prompt: '现代办公室，柔和光线，简约风格',
              quality: 'high',
              enableEdgeSmoothing: true,
            }
          });

          stream.addProcessor(processor);
          
          // 更新背景描述
          processor.port.postMessage({
            cmd: 'update_background_prompt',
            data: '海滩日落，温暖色调'
          });
        `,
      example: `
          class SmartVirtualBackgroundProcessor extends VideoProcessor {
            private backgroundImage: ImageBitmap | null = null;
            private aiGenerator: AIBackgroundGenerator;
            private segmentationModel: SegmentationModel;

            constructor(port: MessagePort, options?: any) {
              super(port, options);
              
              this.aiGenerator = new AIBackgroundGenerator();
              this.segmentationModel = new SegmentationModel();

              port.addEventListener('message', async (e) => {
                if (e.data.cmd === 'update_background_prompt') {
                  const backgroundImage = await this.aiGenerator.generateBackground(e.data.data);
                  this.backgroundImage = backgroundImage;
                } else if (e.data.cmd === 'upload_background_image') {
                  this.backgroundImage = e.data.data;
                }
              });
            }

            async processFrame(input: VideoFrame, output: OffscreenCanvas) {
              if (!this.backgroundImage) return false;
              
              // 使用AI模型进行前景分割
              const mask = await this.segmentationModel.segment(input);
              
              // 合成背景和前景
              const ctx = output.getContext('2d');
              ctx.drawImage(this.backgroundImage, 0, 0, output.width, output.height);
              ctx.globalCompositeOperation = 'source-atop';
              ctx.drawImage(input, 0, 0, output.width, output.height);
              
              return true;
            }
          }

          registerProcessor('smart-virtual-background', SmartVirtualBackgroundProcessor);
        `,
    },
    isInDevelopment: true,
  },

  "video-business-card": {
    id: "video-business-card",
    url: baseUrl + "/video-business-card.js",
    options: {},
    render: VideoBusinessCard,
    name: "视频名片",
    description:
      "在视频画面上叠加动态名片信息，支持个人信息、公司Logo和多种主题样式，完美展示专业形象。",
    features: [
      { icon: User, text: "个人名片" },
      { icon: Video, text: "实时叠加" },
      { icon: Binary, text: "多种主题" },
    ],
    platforms: [
      { icon: Globe, text: "Web" },
      { icon: Smartphone, text: "Android" },
      { icon: Apple, text: "iOS" },
      { icon: Laptop, text: "Windows" },
      { icon: Monitor, text: "Mac" },
    ],
    implementation: {
      usage: `
          const processor: Processor = stream.createProcessor({
            url: 'https://example.com/video-business-card.js',
            name: 'video-business-card',
            type: 'video',
            options: {
              position: 'bottom-right',
              theme: 'modern',
              opacity: 0.8,
              size: 'medium',
            }
          });

          stream.addProcessor(processor);
          
          // 更新名片信息
          processor.port.postMessage({
            cmd: 'update_card_info',
            data: {
              name: '张三',
              title: '产品经理',
              company: '科技有限公司',
              email: 'zhangsan@company.com',
              phone: '+86 138 0000 0000'
            }
          });
        `,
      example: `
          class VideoBusinessCardProcessor extends VideoProcessor {
            private cardInfo: BusinessCardInfo;
            private cardStyle: CardStyle;
            private logoImage: ImageBitmap | null = null;

            constructor(port: MessagePort, options?: any) {
              super(port, options);
              
              this.cardInfo = {
                name: '',
                title: '',
                company: '',
                email: '',
                phone: ''
              };
              
              this.cardStyle = {
                theme: options?.theme || 'modern',
                position: options?.position || 'bottom-right',
                opacity: options?.opacity || 0.8,
                size: options?.size || 'medium'
              };

              port.addEventListener('message', (e) => {
                if (e.data.cmd === 'update_card_info') {
                  this.cardInfo = { ...this.cardInfo, ...e.data.data };
                } else if (e.data.cmd === 'update_card_style') {
                  this.cardStyle = { ...this.cardStyle, ...e.data.data };
                } else if (e.data.cmd === 'update_logo_image') {
                  this.logoImage = e.data.data;
                }
              });
            }

            async processFrame(input: VideoFrame, output: OffscreenCanvas) {
              const ctx = output.getContext('2d');
              
              // 绘制原始视频
              ctx.drawImage(input, 0, 0, output.width, output.height);
              
              // 绘制名片
              this.renderBusinessCard(ctx, output.width, output.height);
              
              return true;
            }

            private renderBusinessCard(ctx: CanvasRenderingContext2D, width: number, height: number) {
              const cardWidth = this.getCardWidth();
              const cardHeight = this.getCardHeight();
              const { x, y } = this.getCardPosition(width, height, cardWidth, cardHeight);
              
              // 绘制名片背景
              ctx.globalAlpha = this.cardStyle.opacity;
              ctx.fillStyle = this.getThemeColor();
              ctx.fillRect(x, y, cardWidth, cardHeight);
              
              // 绘制名片内容
              this.renderCardContent(ctx, x, y, cardWidth, cardHeight);
              
              ctx.globalAlpha = 1;
            }
          }

          registerProcessor('video-business-card', VideoBusinessCardProcessor);
        `,
    },
    isInDevelopment: true,
  },

  "video-stickers": {
    id: "video-stickers",
    url: baseUrl + "/video-stickers.js",
    options: {
      assetsUrlBase: baseUrl + "/assets/mediapipe",
    },
    render: VideoStickers,
    name: "视频贴图",
    description:
      "为视频添加趣味贴纸和装饰元素，支持静态贴纸和人脸跟踪功能，让视频更加生动有趣。",
    features: [
      { icon: Sticker, text: "趣味贴纸" },
      { icon: Video, text: "人脸跟踪" },
      { icon: Sparkles, text: "动态效果" },
    ],
    platforms: [
      { icon: Globe, text: "Web" },
      { icon: Smartphone, text: "Android" },
      { icon: Apple, text: "iOS" },
      { icon: Laptop, text: "Windows" },
      { icon: Monitor, text: "Mac" },
    ],
    implementation: {
      usage: `
          const processor: Processor = stream.createProcessor({
            url: 'https://example.com/video-stickers.js',
            name: 'video-stickers',
            type: 'video',
            options: {
              assetsUrlBase: '/assets/mediapipe',
              enableFaceTracking: true,
              maxStickers: 10,
            }
          });

          stream.addProcessor(processor);
          
          // 添加贴纸
          processor.port.postMessage({
            cmd: 'add_sticker',
            data: {
              id: 'sticker-1',
              src: '/stickers/heart.png',
              x: 50,
              y: 50,
              scale: 1,
              rotation: 0,
              trackFace: true
            }
          });
        `,
      example: `
          class VideoStickersProcessor extends VideoProcessor {
            private stickers: Map<string, StickerData> = new Map();
            private faceDetector: FaceDetector;
            private isTrackerInitialized = false;

            constructor(port: MessagePort, options?: any) {
              super(port, options);
              
              if (options?.enableFaceTracking) {
                this.faceDetector = new FaceDetector({
                  assetsUrlBase: options.assetsUrlBase
                });
              }

              port.addEventListener('message', (e) => {
                switch (e.data.cmd) {
                  case 'add_sticker':
                    this.stickers.set(e.data.data.id, e.data.data);
                    break;
                  case 'remove_sticker':
                    this.stickers.delete(e.data.data.id);
                    break;
                  case 'update_sticker':
                    const existing = this.stickers.get(e.data.data.id);
                    if (existing) {
                      this.stickers.set(e.data.data.id, { ...existing, ...e.data.data });
                    }
                    break;
                }
              });
            }

            async processFrame(input: VideoFrame, output: OffscreenCanvas) {
              const ctx = output.getContext('2d');
              
              // 绘制原始视频
              ctx.drawImage(input, 0, 0, output.width, output.height);
              
              // 检测人脸（如果启用）
              let faceDetections = null;
              if (this.faceDetector && !this.isTrackerInitialized) {
                await this.faceDetector.initialize();
                this.isTrackerInitialized = true;
              }
              
              if (this.faceDetector && this.isTrackerInitialized) {
                faceDetections = await this.faceDetector.detect(input);
              }
              
              // 渲染贴纸
              for (const sticker of this.stickers.values()) {
                if (sticker.isActive) {
                  this.renderSticker(ctx, sticker, faceDetections, output.width, output.height);
                }
              }
              
              return true;
            }

            private renderSticker(
              ctx: CanvasRenderingContext2D, 
              sticker: StickerData, 
              faceDetections: any[], 
              width: number, 
              height: number
            ) {
              let x = (sticker.x / 100) * width;
              let y = (sticker.y / 100) * height;
              
              // 人脸跟踪逻辑
              if (sticker.trackFace && faceDetections && faceDetections.length > 0) {
                const face = faceDetections[0];
                x = face.boundingBox.x + face.boundingBox.width / 2;
                y = face.boundingBox.y + face.boundingBox.height / 2;
              }
              
              ctx.save();
              ctx.translate(x, y);
              ctx.scale(sticker.scale, sticker.scale);
              ctx.rotate((sticker.rotation * Math.PI) / 180);
              ctx.globalAlpha = sticker.opacity;
              
              // 绘制贴纸
              if (sticker.image) {
                ctx.drawImage(sticker.image, -sticker.image.width / 2, -sticker.image.height / 2);
              }
              
              ctx.restore();
            }
          }

          registerProcessor('video-stickers', VideoStickersProcessor);
        `,
    },
    isInDevelopment: true,
  },
};

export default videoConfig;
