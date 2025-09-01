export {};

/**
 * An interface for the constant values used in the RenderEngine.
 */
interface RenderEngineConst {
  /**
   * The renderer types.
   */
  RENDERER_TYPE: {
    /**
     * The 2D renderer.
     */
    _2D: number;
    /**
     * The WebGL renderer.
     */
    WEBGL: number;
    /**
     * The WebGL2 renderer.
     */
    WEBGL_2: number;
    /**
     * The WebGPU renderer.
     */
    WEBGPU: number;
  };

  /**
   * The cropping shapes.
   */
  CROPPING_SHAPE: {
    /**
     * The circle cropping shape.
     */
    CIRCLE: number;
    /**
     * The ellipse cropping shape.
     */
    ELLIPSE: number;
  };
}

/**
 * An interface for the DynamicMaskEngine.
 */
interface DynamicMaskEngine {
  /**
   * Initializes the dynamic mask engine.
   *
   * @param {OffscreenCanvas} canvas - The canvas to render on.
   * @param {RenderEngineConst['RENDERER_TYPE'][keyof RenderEngineConst['RENDERER_TYPE']]} rendererType - The renderer type.
   * @param {ImageBitmap} maskImage - The mask image.
   * @param {{
   *   croppingShape: RenderEngineConst['CROPPING_SHAPE'][keyof RenderEngineConst['CROPPING_SHAPE']];
   *   scaleFactor: number;
   *   useAngle: boolean;
   *   zoomVideo: boolean;
   * }} options - The options.
   * @return {void}
   */
  initDynamicMaskEngine(
    canvas: OffscreenCanvas,
    rendererType: RenderEngineConst['RENDERER_TYPE'][keyof RenderEngineConst['RENDERER_TYPE']],
    maskImage: ImageBitmap,
    options: {
      croppingShape: RenderEngineConst['CROPPING_SHAPE'][keyof RenderEngineConst['CROPPING_SHAPE']];
      scaleFactor: number;
      useAngle: boolean;
      zoomVideo: boolean;
    }
  ): void;

  /**
   * Updates the mask image.
   *
   * @param {ImageBitmap} maskImage - The mask image.
   * @return {void}
   */
  updateMaskImage(maskImage: ImageBitmap): void;

  /**
   * Updates the mask options.
   *
   * @param {any} options - The options.
   * @return {void}
   */
  updateMaskOptions(options: any): void;

  /**
   * Renders the dynamic mask.
   *
   * @param {VideoFrame} videoSrc - The video frame.
   * @param {any} dataSet - The data set.
   * @return {void}
   */
  render(videoSrc: VideoFrame, dataSet: any): void;

  /**
   * Uninitializes the dynamic mask engine.
   *
   * @return {void}
   */
  uninitDynamicMaskEngine(): void;
}

/**
 * An interface for the RenderEngine.
 */
interface RenderEngine {
  /**
   * Gets the dynamic mask engine.
   *
   * @return {DynamicMaskEngine} The dynamic mask engine.
   */
  getDynamicMaskEngine: () => DynamicMaskEngine;
}

declare global {
  const __CDN_BASE__: string;
  /**
   * An interface for the ZoomUtils.
   */
  const ZoomUtils: {
    /**
     * An interface for the RenderEngine.
     */
    RenderEngine: RenderEngine;

    /**
     * An interface for the RenderEngineConst.
     */
    RenderEngineConst: RenderEngineConst;
  };
  /**
   * Registers a processor with the given name.
   *
   * @param {string} name - The name of the processor.
   * @param {typeof VideoProcessor | typeof AudioProcessor} processor - The processor to register.
   * @return {void}
   */
  function registerProcessor(
    name: string,
    processor: typeof VideoProcessor | typeof AudioProcessor
  ): void;
  /**
   * A base class for video processors.
   */
  class VideoProcessor {
    /**
     * Constructs a new VideoProcessor.
     *
     * @param {MessagePort} port - The message port.
     * @param {any} [options] - Optional options.
     */
    constructor(port: MessagePort, options?: any);

    /**
     * The message port to synchronize messages with the main thread.
     */
    port: MessagePort;

    /**
     * Optional options parameter passed when adding the processor.
     */
    options?: any;

    /**
     * Gets the output canvas, if called before initialized, return null.
     *
     * @type {OffscreenCanvas | null}
     */
    getOutput(): OffscreenCanvas | null;

    /**
     * The lifecycle function, called when the processor is initialized.
     *
     * @return {void}
     */
    onInit(): void;

    /**
     * The lifecycle function, called when the processor is uninitialized.
     *
     * @return {void}
     */
    onUninit(): void;

    /**
     * Processes the video frame. Draws the results on the output canvas.
     * If don't need to draw, return false and use the original video frame.
     *
     * @param {VideoFrame} input - The input video frame.
     * @param {OffscreenCanvas} output - The output canvas.
     * @return {boolean | Promise<boolean>} A boolean or a promise that resolves to a boolean.
     */
    processFrame(
      input: VideoFrame,
      output: OffscreenCanvas
    ): boolean | Promise<boolean>;
  }

  /**
   * A base class for video processors.
   */
  class AudioProcessor {
    /**
     * Constructs a new AudioProcessor.
     *
     * @param {MessagePort} port - The message port.
     * @param {any} [options] - Optional options.
     */
    constructor(port: MessagePort, options?: any);

    /**
     * The message port to synchronize messages with the main thread.
     */
    port: MessagePort;

    /**
     * Optional options parameter passed when adding the processor.
     */
    options?: any;

    /**
     * The lifecycle function, called when the processor is initialized.
     *
     * @return {void}
     */
    onInit(): void;

    /**
     * The lifecycle function, called when the processor is uninitialized.
     *
     * @return {void}
     */
    onUninit(): void;

    /**
     * Processes the audio frame.
     *
     * @param {Array<Array<Float32Array>>} inputs - The input audio frames.
     * @param {Array<Array<Float32Array>>} outputs - The output audio frames.
     * @return {boolean | Promise<boolean>} A boolean or a promise that resolves to a boolean.
     */
    process(inputs: Array<Array<Float32Array>>, outputs: Array<Array<Float32Array>>): boolean | Promise<boolean>;
  }

  /**
   * A base class for share processors.
   */
  class ShareProcessor {
    /**
     * Constructs a new ShareProcessor.
     *
     * @param {MessagePort} port - The message port.
     * @param {any} [options] - Optional options.
     */
    constructor(port: MessagePort, options?: any);

    /**
     * The message port to synchronize messages with the main thread.
     */
    port: MessagePort;

    /**
     * Optional options parameter passed when adding the processor.
     */
    options?: any;

    /**
     * Gets the output canvas, if called before initialized, return null.
     *
     * @type {OffscreenCanvas | null}
     */
    getOutput(): OffscreenCanvas | null;

    /**
     * The lifecycle function, called when the processor is initialized.
     *
     * @return {void}
     */
    onInit(): void;

    /**
     * The lifecycle function, called when the processor is uninitialized.
     *
     * @return {void}
     */
    onUninit(): void;

    /**
     * Processes the video frame. Draws the results on the output canvas.
     * If don't need to draw, return false and use the original share frame.
     *
     * @param {VideoFrame} input - The input video frame.
     * @param {OffscreenCanvas} output - The output canvas.
     * @return {boolean | Promise<boolean>} A boolean or a promise that resolves to a boolean.
     */
    processFrame(
      input: VideoFrame,
      output: OffscreenCanvas
    ): boolean | Promise<boolean>;
  }
}
