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

class PiiMaskingShareProcessor extends ShareProcessor {
  constructor(port, options) {
    super(port, options);
    port.onmessage = (event) => {
      const { command, blurRegionNorm, blurRadius } = event.data;
      if (command === 'update-blur-options') {
        console.log("Received update-blur-options:", { blurRegionNorm, blurRadius });
        this.region = blurRegionNorm;
        
        // If radius changed, need to recalculate weights
        if (this.radius !== blurRadius) {
          this.radius = blurRadius;
          if (typeof this.radius !== "number" || this.radius <= 0) {
            this.radius = 10;
          }
          // Recalculate Gaussian weights
          this.weights = buildGaussianWeights(this.radius);
          console.log("Updated blur radius to:", this.radius, "weights:", this.weights);
        }
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
    this._contextLostHandler = null;
    this._contextRestoredHandler = null;
  }
  onInit() {}
  
  onUninit() {
    console.log("PII processor onUninit called");
    
    if (this.gl && !this.gl.isContextLost()) {
      const gl = this.gl;
      
      // Clean up textures
      if (this.texOrig) { gl.deleteTexture(this.texOrig); this.texOrig = null; }
      if (this.tex) { gl.deleteTexture(this.tex); this.tex = null; }
      if (this.tex2) { gl.deleteTexture(this.tex2); this.tex2 = null; }
      
      // Clean up framebuffers
      if (this.fbo) { gl.deleteFramebuffer(this.fbo); this.fbo = null; }
      if (this.fbo2) { gl.deleteFramebuffer(this.fbo2); this.fbo2 = null; }
      
      // Clean up vertex array object
      if (this.vao) { gl.deleteVertexArray(this.vao); this.vao = null; }
      
      // Clean up shader programs
      if (this.progH) { gl.deleteProgram(this.progH); this.progH = null; }
      if (this.progV) { gl.deleteProgram(this.progV); this.progV = null; }
      if (this.progC) { gl.deleteProgram(this.progC); this.progC = null; }
      
      // Reset GL state
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindVertexArray(null);
      gl.useProgram(null);
      
      // Clean up uniform locations
      this.uW = this.uO = this.uWV = this.uOV = null;
      this.uR = this.uOrig = this.uBlur = null;
    }
    
    // Reset GL-related state, but keep configuration parameters
    this.gl = null;
    this._inited = false;
    this.weights = null;
    // Don't clear region and radius, keep configuration available
    // this.region = null;
    // this.radius = null;
    
    // Clean up port
    if (this.port) {
      this.port.onmessage = null;
      this.port = null;
    }
  }
  
  _handleContextLost = (event) => {
    console.warn("WebGL context lost, preventing default");
    event.preventDefault();
    this._inited = false;
    this.gl = null;
  }
  
  _handleContextRestored = (event) => {
    console.log("WebGL context restored, will reinitialize on next frame");
    this._inited = false;
  }
  
  async processFrame(input, output) {
    const w = input.codedWidth;
    const h = input.codedHeight;
    output.width = w;
    output.height = h;
    
    // Ensure basic properties exist, use default values if not
    if (!this.region) {
      this.region = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
      console.log("Region not set, using default:", this.region);
    }
    if (!this.radius || this.radius <= 0) {
      this.radius = 10;
      console.log("Radius not set, using default:", this.radius);
    }
    
    if (!this._inited) {
      this._initGL(output, w, h);
      this._inited = true;
    }
    
    // Check if GL context and weights are valid
    const gl = this.gl;
    if (!gl || gl.isContextLost() || !this.weights) {
      console.warn("WebGL context lost or weights not available");
      input.close();
      return true;
    }
    
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

    // Composite - ensure region properties exist and are valid
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.progC);
    
    // Safely access region properties
    const region = this.region || { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
    gl.uniform4f(this.uR, region.x, region.y, region.width, region.height);
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
    
    // Ensure valid radius value
    if (!this.radius || this.radius <= 0) {
      this.radius = 10;
    }
    
    this.weights = buildGaussianWeights(this.radius);
    console.log("GL initialized with radius:", this.radius, "weights:", this.weights);
    
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
registerProcessor("pii-masking-share-processor", PiiMaskingShareProcessor);
