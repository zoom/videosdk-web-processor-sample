// gamer-live-video-processor.js
import { ImageSegmenter, FilesetResolver } from "@mediapipe/tasks-vision";

let imageSegmenter = null;
async function initializeImageSegmenter(assetsUrlBase) {
  const vision = await FilesetResolver.forVisionTasks(assetsUrlBase + "/wasm");
  imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  });
}

class GamerLiveVideoProcessor extends VideoProcessor {
  #latestGameFrame = null;
  #gl = null;
  #bgProgram = null;
  #segProgram = null;
  #quadVBO = null;
  #bgTex = null;
  #videoTex = null;
  #maskTex = null;

  constructor(port, options) {
    super(port, options);

    if (!options?.assetsUrlBase) {
      console.error("assetsUrlBase is required");
      return;
    }
    initializeImageSegmenter(options.assetsUrlBase);

    port.onmessage = (e) => {
      if (e.data.cmd === "update_video_frame" && e.data.data) {
        this.#latestGameFrame = e.data.data;
      }
    };
  }

  onInit() {
    if (!this.#gl) {
      this.#gl = this.getOutput().getContext("webgl2", { alpha: true });
      const { width, height } = this.getOutput();
      this.#initWebGL(this.#gl, width, height);
    }
  }

  onUninit() {
    // nothing
  }

  async processFrame(input, output) {
    const gl = this.#gl;
    const w = output.width;
    const h = output.height;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    // 1. draw last game frame to background
    if (this.#latestGameFrame) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.#bgTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.#latestGameFrame
      );
      this.#latestGameFrame.close();
      this.#latestGameFrame = null;
    }

    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.#bgProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadVBO);
    gl.uniform1i(gl.getUniformLocation(this.#bgProgram, "u_tex"), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 2. upload and draw foreground mask
    const bitmap = await createImageBitmap(input);
    input.close();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.#videoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

    // B) 分割 → maskTex (unit 2)
    const result = await imageSegmenter.segmentForVideo(
      bitmap,
      performance.now()
    );
    const mask = result.categoryMask;
    const mw = mask.width,
      mh = mask.height;
    const raw = mask.getAsUint8Array();
    const buf = new Uint8Array(mw * mh * 4);
    for (let i = 0; i < mw * mh; i++) {
      const v = raw[i] ? 255 : 0;
      const j = i * 4;
      buf[j] = buf[j + 1] = buf[j + 2] = buf[j + 3] = v;
    }
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.#maskTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      mw,
      mh,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      buf
    );
    bitmap.close();

    // C) draw foreground mask at the bottom left 1/4 of the viewport
    gl.viewport(0, 0, w / 3, h / 3);
    gl.useProgram(this.#segProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadVBO);
    gl.uniform1i(gl.getUniformLocation(this.#segProgram, "u_video"), 1);
    gl.uniform1i(gl.getUniformLocation(this.#segProgram, "u_mask"), 2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // restore full screen viewport for next frame background
    gl.viewport(0, 0, w, h);
    mask.close();
    result.close();
    return true;
  }

  #initWebGL(gl, width, height) {
    // vertex shader (full screen quad)
    const vsSource = `#version 300 es
      in vec2 a_pos;
      out vec2 v_uv;
      void main() {
        v_uv = vec2((a_pos.x + 1.0) * 0.5, (-a_pos.y + 1.0) * 0.5);
        gl_Position = vec4(a_pos, 0, 1);
      }
    `;

    // fragment shader: background full screen
    const bgFs = `#version 300 es
      precision mediump float;
      in vec2 v_uv;
      uniform sampler2D u_tex;
      out vec4 outColor;
      void main() {
        outColor = texture(u_tex, v_uv);
      }
    `;

    // fragment shader: video * mask
    const segFs = `#version 300 es
      precision mediump float;
      in vec2 v_uv;
      uniform sampler2D u_video;
      uniform sampler2D u_mask;
      out vec4 outColor;
      void main() {
        vec4 c = texture(u_video, v_uv);
        float m = texture(u_mask,  v_uv).r;
        outColor = vec4(c.rgb, m);
      }
    `;

    // compile & link
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s));
      }
      return s;
    };
    const linkProgram = (vs, fs) => {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(p));
      }
      return p;
    };

    this.#bgProgram = linkProgram(vsSource, bgFs);
    this.#segProgram = linkProgram(vsSource, segFs);

    // full screen quad VBO
    this.#quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#quadVBO);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(this.#bgProgram, "a_pos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // three textures
    this.#bgTex = gl.createTexture();
    this.#videoTex = gl.createTexture();
    this.#maskTex = gl.createTexture();

    // set filtering/wrapping
    [this.#bgTex, this.#videoTex].forEach((tex) => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    });
    gl.bindTexture(gl.TEXTURE_2D, this.#maskTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.viewport(0, 0, width, height);
  }
}

registerProcessor("gamer-live-video-processor", GamerLiveVideoProcessor);
