import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

let detector: FaceDetector;

async function initializeFaceDetector(assetsUrlBase: string) {
  const vision = await FilesetResolver.forVisionTasks(assetsUrlBase + '/wasm');
  const runningMode = 'IMAGE';
  detector = await FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: assetsUrlBase + '/blaze_face_short_range.tflite',
      delegate: 'GPU',
    },
    runningMode,
    canvas: new OffscreenCanvas(1, 1),
  });
}

const { RENDERER_TYPE } = ZoomUtils.RenderEngineConst;

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

    if (!options?.assetsUrlBase) {
      console.error('The assetsUrlBase is empty.');
      return;
    }

    initializeFaceDetector(options?.assetsUrlBase);

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
