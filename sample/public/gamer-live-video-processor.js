import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

let imageSegmenter;

async function initializeImageSegmenter(assetsUrlBase) {
  const vision = await FilesetResolver.forVisionTasks(assetsUrlBase + '/wasm');
  const runningMode = 'VIDEO';
  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite',
      delegate: 'GPU',
    },
    runningMode,
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  });
}

class GamerLiveVideoProcessor extends VideoProcessor {

  constructor(port, options) {
    super(port, options);

    if (!options?.assetsUrlBase) {
      console.error("The assetsUrlBase is empty.");
      return;
    }

    initializeImageSegmenter(options?.assetsUrlBase);
    console.log(`GamerLiveVideoProcessor imageSegmenter: ${imageSegmenter}`);

    port.addEventListener("message", (e) => {
      if (e.data.cmd === "update_video_frame") {
        console.log(`Updating video track: ${e.data.data}`);
      }
    });
  }

  onInit() {}

  onUninit() {}

  processVideoFrame(input, output) {
    // Process the video frame
  }
}

registerProcessor("gamer-live-video-processor", GamerLiveVideoProcessor);
