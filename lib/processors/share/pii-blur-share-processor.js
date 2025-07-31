/*
 * PiiWebGLShareProcessor.js
 * A ShareProcessor that applies a Gaussian blur to a specified normalized region
 * of each VideoFrame using WebGL2 for high performance.
 */

// Vertex shader: fullscreen quad
const vertSrc = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_uv;

void main() {
  v_uv = a_texCoord;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Fragment shader: horizontal Gaussian blur
const blurFragSrcH = `#version 300 es
    precision mediump float;
    in vec2 v_uv;
    uniform sampler2D u_texture;
    uniform float u_texelOffset;
    uniform float u_weights[9];
    out vec4 outColor;
    void main() {
      vec2 off = vec2(u_texelOffset, 0.0);
      vec4 sum = texture(u_texture, v_uv) * u_weights[0];
      for (int i = 1; i < 9; ++i) {
        sum += texture(u_texture, v_uv + off * float(i)) * u_weights[i];
        sum += texture(u_texture, v_uv - off * float(i)) * u_weights[i];
      }
      outColor = sum;
    }`;

// Fragment shader: vertical Gaussian blur
const blurFragSrcV = `#version 300 es
    precision mediump float;
    in vec2 v_uv;
    uniform sampler2D u_texture;
    uniform float u_texelOffset;
    uniform float u_weights[9];
    out vec4 outColor;
    void main() {
      vec2 off = vec2(0.0, u_texelOffset);
      vec4 sum = texture(u_texture, v_uv) * u_weights[0];
      for (int i = 1; i < 9; ++i) {
        sum += texture(u_texture, v_uv + off * float(i)) * u_weights[i];
        sum += texture(u_texture, v_uv - off * float(i)) * u_weights[i];
      }
      outColor = sum;
    }`;

// Fragment shader: composite original and blurred based on region
const compositeFragSrc = `#version 300 es
    precision mediump float;
    in vec2 v_uv;
    uniform sampler2D u_orig;
    uniform sampler2D u_blur;
    uniform vec4 u_region;
    out vec4 outColor;
    void main() {
      if (v_uv.x >= u_region.x && v_uv.x <= u_region.x + u_region.z &&
          v_uv.y >= u_region.y && v_uv.y <= u_region.y + u_region.w) {
        outColor = texture(u_blur, v_uv);
      } else {
        outColor = texture(u_orig, v_uv);
      }
    }`;

// Utility: compile a shader
function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s));
  }
  return s;
}
function createProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p));
  }
  return p;
}

// Compute Gaussian weights for given radius (9 taps)
function buildGaussianWeights(sigma) {
  const w = [];
  let sum = 0;
  const twoSigmaSq = 2 * sigma * sigma;

  for (let i = 0; i < 9; i++) {
    const val = Math.exp(-(i * i) / twoSigmaSq);
    w.push(val);
    sum += i === 0 ? val : val * 2;
  }

  return w.map((x) => x / sum);
}

class PiiWebGLProcessor extends ShareProcessor {
  constructor(port, options) {
    super(port, options);
//     port.postMessage({
//       command: "share-processor-framework-options",
//       options: {
//         processorName: 'share-webgl-pii',
//         waitForGPUCommandsFinished: true,
//       },
//     });

    port.onmessage = (event) => {
      const { command, blurRegionNorm, blurRadius } = event.data;
      if (command === 'update-blur-options') {
        this.region = blurRegionNorm;
        this.radius = blurRadius;
      }
    }

    this.region = options.blurRegionNorm || {
      x: 0.2,
      y: 0.2,
      width: 0.6,
      height: 0.6,
    };
    this.radius = options.blurRadius || 10;

    if (typeof this.radius !== "number" || this.radius <= 0) {
      this.radius = 10;
    }

    this._inited = false;
  }
  onInit() {}
  
  onUninit() {
    if (this.gl && !this.gl.isContextLost()) {
      const gl = this.gl;
      
      if (this.texOrig) { gl.deleteTexture(this.texOrig); this.texOrig = null; }
      if (this.tex) { gl.deleteTexture(this.tex); this.tex = null; }
      if (this.tex2) { gl.deleteTexture(this.tex2); this.tex2 = null; }
      
      if (this.fbo) { gl.deleteFramebuffer(this.fbo); this.fbo = null; }
      if (this.fbo2) { gl.deleteFramebuffer(this.fbo2); this.fbo2 = null; }
      
      if (this.vao) { gl.deleteVertexArray(this.vao); this.vao = null; }
      if (this.progH) { gl.deleteProgram(this.progH); this.progH = null; }
      if (this.progV) { gl.deleteProgram(this.progV); this.progV = null; }
      if (this.progC) { gl.deleteProgram(this.progC); this.progC = null; }
      
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindVertexArray(null);
      gl.useProgram(null);
      
      this.uW = this.uO = this.uWV = this.uOV = null;
      this.uR = this.uOrig = this.uBlur = null;
    }
    
    this.gl = null;
    this._inited = false;
    this.weights = null;
    this.region = null;
    this.radius = null;
    if (this.port) {
      this.port = null;
    }
  }
  async processFrame(input, output) {
    const w = input.codedWidth,
      h = input.codedHeight;
    output.width = w;
    output.height = h;
    if (!this._inited) {
      this._initGL(output, w, h);
      this._inited = true;
    }
    const gl = this.gl;
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.texOrig);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);

    gl.bindVertexArray(this.vao);

    // H blur: original image -> tex
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.useProgram(this.progH);
    gl.uniform1fv(this.uW, this.weights);
    gl.uniform1f(this.uO, (this.radius / 8.0) / w);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texOrig);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // V blur: tex -> tex2
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo2);
    gl.useProgram(this.progV);
    gl.uniform1fv(this.uWV, this.weights);
    gl.uniform1f(this.uOV, (this.radius / 8.0) / h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.progC);
    gl.uniform4f(this.uR, this.region.x, this.region.y, this.region.width, this.region.height);
    gl.uniform1i(this.uOrig, 0);
    gl.uniform1i(this.uBlur, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texOrig);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
    input.close();
    return true;
  }
  _initGL(canvas, w, h) {
    const gl = canvas.getContext("webgl2");
    this.gl = gl;
    gl.viewport(0, 0, w, h);
    this.weights = buildGaussianWeights(this.radius);
    
    this.progH = createProgram(gl, vertSrc, blurFragSrcH);
    this.progV = createProgram(gl, vertSrc, blurFragSrcV);
    this.progC = createProgram(gl, vertSrc, compositeFragSrc);
    
    this.uW = gl.getUniformLocation(this.progH, "u_weights");
    this.uO = gl.getUniformLocation(this.progH, "u_texelOffset");
    this.uWV = gl.getUniformLocation(this.progV, "u_weights");
    this.uOV = gl.getUniformLocation(this.progV, "u_texelOffset");
    this.uR = gl.getUniformLocation(this.progC, "u_region");
    this.uOrig = gl.getUniformLocation(this.progC, "u_orig");
    this.uBlur = gl.getUniformLocation(this.progC, "u_blur");

    this.texOrig = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texOrig);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.tex,
      0
    );

    this.tex2 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo2 = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex2, 0);

    const verts = new Float32Array([
      -1, -1, 0, 1,
      1, -1, 1, 1,
      -1, 1, 0, 0,
      1, 1, 1, 0,
    ]);
    this.vao = gl.createVertexArray();
    const buf = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    
    const aP = gl.getAttribLocation(this.progH, "a_position");
    const aT = gl.getAttribLocation(this.progH, "a_texCoord");
    gl.enableVertexAttribArray(aP);
    gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aT);
    gl.vertexAttribPointer(aT, 2, gl.FLOAT, false, 16, 8);
    
    gl.bindVertexArray(null);
  }
}
registerProcessor("share-webgl-pii", PiiWebGLProcessor);
