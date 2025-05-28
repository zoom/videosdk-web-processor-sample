class PitchShiftProcessor extends AudioProcessor {
  constructor(port, options) {
    super(port, options);

    this.bufferSize = 11025;
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;
    this.readPos = 0.0;
    this.pitchRatio = 1.5;
    this.formantRatio = 1.2;
    this.dryWet = 0.7;
    this.hpf = {
      prevIn: 0,
      prevOut: 0,
      alpha: 0.86,
    };

    // optional: sample code for non-sab audio processing
    this.channels = 2;
    this.frameBuffer = [];
    this.batchSize = 4096;

    this.port.onmessage = (event) => {
      const { command, config } = event.data;
      if (command === "update-pitch-shift-config") {
        const { pitchRatio = 1.5, formantRatio = 1.2, dryWet = 0.0 } = config;
        this.pitchRatio = pitchRatio;
        this.formantRatio = formantRatio;
        this.dryWet = dryWet;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (input.length === 0 || !input[0]) {
      return true;
    }
    const inputChannel = input[0];
    const outputChannel = output[0];

    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.writePos] = inputChannel[i];
      this.writePos = (this.writePos + 1) % this.bufferSize;
    }

    for (let i = 0; i < outputChannel.length; i++) {
      let readPos = this.readPos % this.bufferSize;
      if (readPos < 0) readPos += this.bufferSize;
      const intPos = Math.floor(readPos);
      const frac = readPos - intPos;
      const nextPos = (intPos + 1) % this.bufferSize;
      const raw =
        this.buffer[intPos] * (1 - frac) + this.buffer[nextPos] * frac;
      const filtered =
        raw - this.hpf.prevIn + this.hpf.alpha * this.hpf.prevOut;
      this.hpf.prevIn = raw;
      this.hpf.prevOut = filtered;
      outputChannel[i] = filtered * this.dryWet + raw * (1 - this.dryWet);
      this.readPos += this.pitchRatio;
      if (this.readPos >= this.bufferSize) {
        this.readPos -= this.bufferSize;
        this.writePos = 0;
      }
    }

    // optional: sample code for non-sab audio processing
    const len = outputChannel.length;
    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < this.channels; ch++) {
        const channelData = outputs[0][ch] || outputs[0][0];
        this.frameBuffer.push(channelData[i]);
      }

      if (this.frameBuffer.length >= this.batchSize * this.channels) {
        const buf = new Float32Array(this.frameBuffer).buffer;
        this.port.postMessage(
          {
            command: "preview",
            data: buf,
          },
          [buf]
        );
        this.frameBuffer = [];
      }
    }

    return true;
  }
}

registerProcessor("pitch-shift-processor", PitchShiftProcessor);
