import { RingBuffer } from "@zoom/web-media-lib";

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
    this.mode = 0; // 0: non-sab, 1: sab
    this.channels = 2;
    this.frameBuffer = [];
    this.batchSize = 1024;

    // optional: sample code for ring buffer(sab) audio processing
    this.rb = null;
    this.frameCapacity = 0;

    this.port.onmessage = (event) => {
      console.log(
        `pitch-shift-processor message received:${JSON.stringify(event.data)}`
      );
      const { command, data } = event.data;
      if (command === "init-processor") {
        this.mode = data.mode || 0;
      } else if (command === "update-pitch-shift-config") {
        const { pitchRatio = 1.5, formantRatio = 1.2, dryWet = 0.0 } = data;
        this.pitchRatio = pitchRatio;
        this.formantRatio = formantRatio;
        this.dryWet = dryWet;
      } else if (command === "attach-ring-buffer") {
        this.frameCapacity = data.frameCapacity || 0;
        this.channels = data.channelCount || 2;
        this.rb = RingBuffer.attach(
          data.sab,
          this.frameCapacity,
          this.channels
        );
      }
    };
  }

  // process(inputs, outputs) {
  //   const input = inputs[0];
  //   const output = outputs[0];
  //   if (input.length === 0 || !input[0]) {
  //     return true;
  //   }

  //   const inputChannel = input[0];
  //   const outputChannel = output[0];
  //   const len = outputChannel.length;

  //   for (let i = 0; i < inputChannel.length; i++) {
  //     this.buffer[this.writePos] = inputChannel[i];
  //     this.writePos = (this.writePos + 1) % this.bufferSize;
  //   }

  //   for (let i = 0; i < len; i++) {
  //     let readPos = this.readPos % this.bufferSize;
  //     if (readPos < 0) readPos += this.bufferSize;
  //     const intPos = Math.floor(readPos);
  //     const frac = readPos - intPos;
  //     const nextPos = (intPos + 1) % this.bufferSize;
  //     const raw =
  //       this.buffer[intPos] * (1 - frac) + this.buffer[nextPos] * frac;
  //     const filtered =
  //       raw - this.hpf.prevIn + this.hpf.alpha * this.hpf.prevOut;
  //     this.hpf.prevIn = raw;
  //     this.hpf.prevOut = filtered;

  //     const outSample = filtered * this.dryWet + raw * (1 - this.dryWet);
  //     for (let ch = 0; ch < output.length; ch++) {
  //       output[ch][i] = outSample;
  //     }

  //     this.readPos += this.pitchRatio;
  //     if (this.readPos >= this.bufferSize) {
  //       this.readPos -= this.bufferSize;
  //     }
  //   }

  //   // optional: sample code for non-sab/sab audio processing
  //   if (this.mode === 1 && this.rb) {
  //     const temp = new Float32Array(len * this.channels);
  //     for (let i = 0; i < len; i++) {
  //       for (let ch = 0; ch < this.channels; ch++) {
  //         const chArr = output[ch] || output[0];
  //         temp[i * this.channels + ch] = chArr[i];
  //       }
  //     }
  //     this.rb.write(temp);
  //   } else {
  //     for (let i = 0; i < len; i++) {
  //       for (let ch = 0; ch < this.channels; ch++) {
  //         const channelData = outputs[0][ch] || outputs[0][0];
  //         this.frameBuffer.push(channelData[i]);
  //       }

  //       if (this.frameBuffer.length >= this.batchSize * this.channels) {
  //         const buf = new Float32Array(this.frameBuffer).buffer;
  //         this.port.postMessage(
  //           {
  //             command: "preview",
  //             data: buf,
  //           },
  //           [buf]
  //         );
  //         this.frameBuffer = [];
  //       }
  //     }
  //   }

  //   return true;
  // }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !input[0]) {
      return true;
    }
    const inCh = input[0];
    const outCh = output[0];
    const len = outCh.length; // 通常 = 128

    // 1) 写入内部循环延迟线
    for (let i = 0; i < inCh.length; i++) {
      this.buffer[this.writePos] = inCh[i];
      this.writePos = (this.writePos + 1) % this.bufferSize;
    }

    // 2) 从延迟线里插值 + 高通滤波 + 干/湿混合，写到 outCh
    for (let i = 0; i < len; i++) {
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

      const outSample = filtered * this.dryWet + raw * (1 - this.dryWet);
      for (let ch = 0; ch < output.length; ch++) {
        output[ch][i] = outSample;
      }

      // 只回环 readPos，不再重置 writePos
      this.readPos += this.pitchRatio;
      if (this.readPos >= this.bufferSize) {
        this.readPos -= this.bufferSize;
      }
    }

    // 3) SAB 模式：批量写入 RingBuffer
    if (this.mode === 1 && this.rb) {
      const frames = new Float32Array(len * this.channels);
      for (let i = 0; i < len; i++) {
        for (let ch = 0; ch < this.channels; ch++) {
          const chArr = output[ch] || output[0];
          frames[i * this.channels + ch] = chArr[i];
        }
      }
      this.rb.write(frames);
    }
    // 4) 非 SAB 模式：旧的 postMessage 逻辑
    else if (this.mode === 0) {
      for (let i = 0; i < len; i++) {
        for (let ch = 0; ch < this.channels; ch++) {
          const chArr = output[ch] || output[0];
          this.frameBuffer.push(chArr[i]);
        }
        if (this.frameBuffer.length >= this.batchSize * this.channels) {
          const buf = new Float32Array(this.frameBuffer).buffer;
          this.port.postMessage({ command: "preview", data: buf }, [buf]);
          this.frameBuffer = [];
        }
      }
    }

    return true;
  }
}

registerProcessor("pitch-shift-processor", PitchShiftProcessor);
