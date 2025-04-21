// gamer-live-video-processor.js

// 先确保你已经在主线程用 Worker 的 `{ type: 'module' }` 或者 classic + importScripts
// 把 @mediapipe/tasks-vision 的 UMD 包加载进来，然后全局拿到 API。
// 这里只示例已通过 importScripts 全局加载，或者已用 ES module worker import。

import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

let imageSegmenter = null;
async function initializeImageSegmenter(assetsUrlBase) {
  const vision = await FilesetResolver.forVisionTasks(assetsUrlBase + '/wasm');
  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite',
      delegate: 'GPU',
    },
    runningMode: "VIDEO",
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  });
}

class GamerLiveVideoProcessor extends VideoProcessor {
  #latestGameFrame = null;
  #maskTexture     = null;

  constructor(port, options) {
    super(port, options);

    if (!options?.assetsUrlBase) {
      console.error("assetsUrlBase is required");
      return;
    }
    // 异步初始化分割模型
    initializeImageSegmenter(options.assetsUrlBase);

    // 接收主线程发来的最新游戏帧（ImageBitmap）
    port.onmessage = (e) => {
      if (e.data.cmd === 'update_video_frame' && e.data.data) {
        this.#latestGameFrame = e.data.data;
      }
    };

    // WebGL 相关句柄，延迟到第一次 processFrame 再初始化
    this.gl            = null;
    this.program       = null;
    this.aPosLoc       = null;
    this.aTexLoc       = null;
    this.uTexLoc       = null;
    this.posBuffer     = null;
    this.texBuffer     = null;
    this.gameTexture   = null;
  }

  onInit() {
    // nothing
  }
  onUninit() {
    // nothing
  }

  processFrame(input, output) {
    const width  = output.displayWidth;
    const height = output.displayHeight;

    // 第一次调用时初始化 WebGL 上下文和着色器
    if (!this.gl) {
      // 拿到 OffscreenCanvas 的 WebGL2 上下文
      this.gl = output.getContext('webgl2') || output.getContext('webgl');
      const gl = this.gl;

      // --- 1. 编译 Shader Program ---
      const vsSource = `
        attribute vec2 a_position;
        attribute vec2 a_texcoord;
        varying vec2 v_texcoord;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
          v_texcoord = a_texcoord;
        }
      `;
      const fsSource = `
        precision mediump float;
        uniform sampler2D u_texture;
        varying vec2 v_texcoord;
        void main() {
          gl_FragColor = texture2D(u_texture, v_texcoord);
        }
      `;
      const compile = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.error(gl.getShaderInfoLog(s));
        }
        return s;
      };
      const vs = compile(gl.VERTEX_SHADER,   vsSource);
      const fs = compile(gl.FRAGMENT_SHADER, fsSource);
      this.program = gl.createProgram();
      gl.attachShader(this.program, vs);
      gl.attachShader(this.program, fs);
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(this.program));
      }

      // 拿 attribute / uniform location
      this.aPosLoc = gl.getAttribLocation(this.program, 'a_position');
      this.aTexLoc = gl.getAttribLocation(this.program, 'a_texcoord');
      this.uTexLoc = gl.getUniformLocation(this.program, 'u_texture');

      // --- 2. 创建顶点 & 纹理坐标 Buffer(全屏 Quad) ---
      this.posBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
      // 四个顶点(clip space)：左下→右下→左上→右上
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          -1, -1,
           1, -1,
          -1,  1,
           1,  1,
        ]),
        gl.STATIC_DRAW
      );

      this.texBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
      // 对应的 UV 坐标
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
          0, 0,
          1, 0,
          0, 1,
          1, 1,
        ]),
        gl.STATIC_DRAW
      );

      // --- 3. 创建游戏帧专用纹理 ---
      this.gameTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.gameTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);

      // 清屏为透明
      gl.clearColor(0, 0, 0, 0);
    }

    const gl = this.gl;

    // 每帧：先清屏
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // --- A. 绘制游戏帧全屏背景 ---
    if (this.#latestGameFrame) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.gameTexture);
      // ImageBitmap / HTMLVideoElement / HTMLCanvasElement 都可
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.#latestGameFrame
      );
    }

    gl.useProgram(this.program);
    // 顶点位置
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(this.aPosLoc);
    gl.vertexAttribPointer(this.aPosLoc, 2, gl.FLOAT, false, 0, 0);
    // UV 坐标
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texBuffer);
    gl.enableVertexAttribArray(this.aTexLoc);
    gl.vertexAttribPointer(this.aTexLoc, 2, gl.FLOAT, false, 0, 0);

    // 把纹理单元 0 绑定到 uniform
    gl.uniform1i(this.uTexLoc, 0);
    // 画全屏 Quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // --- B. 在左下角绘制分割 Mask ---
    if (this.#maskTexture) {
      // 左下角四分之一大小
      const smallW = width  / 4;
      const smallH = height / 4;
      gl.viewport(0, 0, smallW, smallH);
      gl.bindTexture(gl.TEXTURE_2D, this.#maskTexture);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // 恢复全屏 viewport
      gl.viewport(0, 0, width, height);
    }

    // --- C. 启动异步分割（下一个 input 帧就能拿到新 mask） ---
    if (imageSegmenter) {
      const t0 = performance.now();
      imageSegmenter.segmentForVideo(
        input,
        t0,
        (result) => {
          if (result.categoryMask?.hasWebGLTexture()) {
            // 拿到 GPU 纹理
            this.#maskTexture = result.categoryMask.getAsWebGLTexture();
          }
        }
      );
    }

    input.close();
    return true;
  }
}

registerProcessor('gamer-live-video-processor', GamerLiveVideoProcessor);