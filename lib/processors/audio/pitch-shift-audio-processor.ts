class PitchShiftProcessor extends AudioProcessor {
  pitchRatio: number;
  bufferSize: number;
  buffer: Float32Array;
  writePos: number;
  readPos: number;
  formantRatio: number;
  dryWet: number;
  hpf: {
    prevIn: number;
    prevOut: number;
    alpha: number;
  };

  // add for data transmission and buffer management
  outputBuffer: Float32Array;
  outputBufferSize: number;
  outputWritePos: number;
  sampleRate: number;
  isTransmitting: boolean;
  transmitInterval: number;
  lastTransmitTime: number;
  smoothingBuffer: Float32Array;
  smoothingSize: number;
  smoothingIndex: number;

  // buffer management state
  isBufferReady: boolean;
  minBufferFill: number;
  positionCheckCounter: number;

  // latency monitoring
  lastLatencyReport: number;
  processingStartTime: number;

  constructor(port: MessagePort, options: any) {
    super(port, options);

    // original parameters
    this.bufferSize = 48000; // 1 second buffer (48kHz sampling rate) - increase buffer size
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;
    this.readPos = this.bufferSize / 4; // initial read position set to 1/4 of the buffer, provide enough lookahead
    this.pitchRatio = 1.8; // Tone ratio (1.0 is original sound)
    this.formantRatio = 0; // Formant ratio
    this.dryWet = 0; // Dry/Wet mix ratio

    // high-pass filter parameters (reduce alpha value to reduce noise)
    this.hpf = {
      prevIn: 0,
      prevOut: 0,
      alpha: 0.95, // more gentle high-pass filter
    };

    // add for output buffer management
    this.sampleRate = 48000;
    this.outputBufferSize = Math.floor(this.sampleRate * 0.05); // 50ms buffer, reduce delay
    this.outputBuffer = new Float32Array(this.outputBufferSize);
    this.outputWritePos = 0;
    this.isTransmitting = false;
    this.transmitInterval = Math.floor(this.sampleRate * 0.01); // 10ms transmission interval, reduce delay
    this.lastTransmitTime = this.smoothingSize = 32; // reduce smoothing window size to avoid over-smoothing
    this.smoothingBuffer = new Float32Array(this.smoothingSize);
    this.smoothingIndex = 0;

    // buffer management state
    this.isBufferReady = false;
    this.minBufferFill = this.bufferSize / 8; // reduce warm-up requirements, reduce delay and repeated audio
    this.positionCheckCounter = 0;

    // latency monitoring initialization
    this.lastLatencyReport = 0;
    this.processingStartTime = 0;

    this.port.onmessage = (event) => {
      const command = event.data.command;
      if (command === "update-pitch-shift-config") {
        const oldPitchRatio = this.pitchRatio;
        this.pitchRatio = event.data.data.pitchRatio;
        this.formantRatio = event.data.data.formantRatio;
        this.dryWet = event.data.data.dryWet;

        console.log(
          `[PitchShift] Config updated: pitch ${oldPitchRatio} → ${this.pitchRatio}, formant: ${this.formantRatio}, dryWet: ${this.dryWet}`
        );

        // check if pitch > 1 boundary is crossed
        const wasAboveOne = oldPitchRatio > 1.0;
        const isAboveOne = this.pitchRatio > 1.0;

        if (wasAboveOne !== isAboveOne) {
          console.log(
            `[PitchShift] Pitch boundary crossed (${
              wasAboveOne ? ">1" : "<=1"
            } → ${isAboveOne ? ">1" : "<=1"}), adjusting strategy`
          );
          this.resetBufferPositions();
        } else {
          // reset check counter only when parameters change
          this.positionCheckCounter = 0;
        }
      } else if (command === "start-transmission") {
        this.isTransmitting = true;
        this.outputWritePos = 0;
        this.lastTransmitTime = 0;
        this.resetBufferPositions(); // reset position when starting
        console.log(
          "[PitchShift] Started audio transmission - AudioWorklet will be muted, only main thread playback"
        );
      } else if (command === "stop-transmission") {
        this.isTransmitting = false;
        console.log(
          "[PitchShift] Stopped audio transmission - AudioWorklet direct output resumed"
        );
      } else if (command === "start-preview") {
        // start preview playback
        this.isTransmitting = true;
        this.resetBufferPositions(); // reset position when starting preview
        console.log(
          "[PitchShift] Preview playback started - AudioWorklet muted, main thread active"
        );
      } else if (command === "stop-preview") {
        // stop preview playback
        this.isTransmitting = false;
        console.log(
          "[PitchShift] Preview playback stopped - AudioWorklet direct output resumed"
        );
      }
    };
  }

  // add for smoothing processing, reduce noise
  applySmoothingFilter(sample: number): number {
    // add current sample to smoothing buffer
    const bufferIndex = this.smoothingIndex % this.smoothingSize;
    this.smoothingBuffer[bufferIndex] = sample;
    this.smoothingIndex++;

    // calculate moving average (only use recent samples)
    let sum = 0;
    let count = 0;
    const windowSize = Math.min(this.smoothingSize, this.smoothingIndex);
    const actualWindow = Math.min(8, windowSize); // limit

    for (let i = 0; i < actualWindow; i++) {
      const idx = (bufferIndex - i + this.smoothingSize) % this.smoothingSize;
      sum += this.smoothingBuffer[idx];
      count++;
    }

    return count > 0 ? sum / count : sample;
  }

  // add for data transmission to main thread
  transmitAudioData(forceTransmit: boolean = false): void {
    if (!this.isTransmitting) return;

    const currentTime = this.lastTransmitTime + 128; // assume 128 samples per processing
    const shouldTransmit =
      forceTransmit ||
      currentTime - this.lastTransmitTime >= this.transmitInterval;

    if (shouldTransmit && this.outputWritePos > 0) {
      try {
        // create data to transmit
        const dataToTransmit = new Float32Array(this.outputWritePos);
        dataToTransmit.set(this.outputBuffer.subarray(0, this.outputWritePos));

        // transmit data to main thread - use preview command
        this.port.postMessage({
          command: "preview",
          audioData: dataToTransmit,
          sampleRate: this.sampleRate,
          timestamp: currentTime,
          bufferSize: this.outputWritePos,
        });

        // reset output buffer
        this.outputWritePos = 0;
        this.lastTransmitTime = currentTime;
      } catch (error) {
        console.error("[PitchShift] Error transmitting audio data:", error);
      }
    }
  }

  // add for audio quality check and fix
  validateAndFixSample(sample: number): number {
    // check NaN and infinity
    if (!isFinite(sample)) {
      return 0;
    }

    // limit amplitude range [-1, 1]
    return Math.max(-1, Math.min(1, sample));
  }

  // improve for pitch > 1 special position management
  manageReadWritePositions(): boolean {
    // smart check frequency: adjust based on pitch ratio and distance
    this.positionCheckCounter++;
    let checkInterval = 48; // default check interval

    if (this.pitchRatio > 2.0) {
      checkInterval = 16; // high pitch very frequently
    } else if (this.pitchRatio > 1.5) {
      checkInterval = 24; // medium pitch moderately frequently
    }

    if (this.positionCheckCounter < checkInterval) {
      return true;
    }
    this.positionCheckCounter = 0;

    // calculate distance between read and write positions
    let distance = this.writePos - this.readPos;
    if (distance < 0) {
      distance += this.bufferSize;
    }

    // smart safe distance: balance delay and stability
    let baseSafeDistance = 3072; // moderate base safe distance

    if (this.pitchRatio > 1.0) {
      // segment strategy for different pitch ranges
      if (this.pitchRatio <= 1.5) {
        // low pitch: prioritize low delay
        baseSafeDistance += (this.pitchRatio - 1.0) * 2048;
      } else if (this.pitchRatio <= 2.5) {
        // medium pitch: balance delay and stability
        baseSafeDistance += 1024 + (this.pitchRatio - 1.5) * 3072;
      } else {
        // high pitch: prioritize stability
        baseSafeDistance += 4096 + (this.pitchRatio - 2.5) * 4096;
      }
    }

    const minDistance = Math.min(baseSafeDistance, this.bufferSize / 6); // limit maximum distance

    // check if position needs to be adjusted
    if (distance < minDistance) {
      console.warn(
        `[PitchShift] Position collision detected (distance: ${distance}, required: ${minDistance}, pitch: ${this.pitchRatio})`
      );

      if (this.pitchRatio > 1.0) {
        // pitch > 1, force adjust read position, ensure enough buffer data
        const safeReadPos =
          (this.writePos - minDistance + this.bufferSize) % this.bufferSize;
        console.log(
          `[PitchShift] Adjusting readPos from ${this.readPos} to ${safeReadPos} for pitch ${this.pitchRatio}`
        );
        this.readPos = safeReadPos;
      } else {
        // pitch <= 1, output silence and wait for more data
        return false;
      }
    }

    return true; // position safe, continue normal processing
  }

  // improve for smart reset for different pitch ratio
  resetBufferPositions(): void {
    console.log(`[PitchShift] Smart reset for pitch ratio: ${this.pitchRatio}`);

    // reset necessary state
    this.positionCheckCounter = 0;

    if (this.pitchRatio > 1.0) {
      // pitch > 1, need more cautious position management
      console.log(
        `[PitchShift] Pitch > 1.0 detected, applying safe position strategy`
      );

      // smart safe distance strategy: keep consistent with position check logic
      let safeDistance = 3072;

      if (this.pitchRatio <= 1.5) {
        safeDistance += (this.pitchRatio - 1.0) * 2048;
      } else if (this.pitchRatio <= 2.5) {
        safeDistance += 1024 + (this.pitchRatio - 1.5) * 3072;
      } else {
        safeDistance += 4096 + (this.pitchRatio - 2.5) * 4096;
      }

      safeDistance = Math.min(safeDistance, this.bufferSize / 6);

      this.readPos =
        (this.writePos - safeDistance + this.bufferSize) % this.bufferSize;

      // smart warm-up strategy: high pitch needs more warm-up
      this.isBufferReady = false;
      if (this.pitchRatio > 2.0) {
        this.minBufferFill = Math.min(this.bufferSize / 12, safeDistance * 0.8); // high pitch more warm-up
      } else {
        this.minBufferFill = Math.min(this.bufferSize / 16, safeDistance * 0.6); // low pitch fast startup
      }

      console.log(
        `[PitchShift] Reset positions: writePos=${this.writePos}, readPos=${this.readPos}, safeDistance=${safeDistance}, minBufferFill=${this.minBufferFill}`
      );
    } else {
      // pitch <= 1, keep current position, only reset state
      console.log(`[PitchShift] Pitch <= 1.0, minimal reset`);
      if (!this.isBufferReady) {
        this.isBufferReady = false;
      }
    }

    // reset filter state
    this.hpf.prevIn = 0;
    this.hpf.prevOut = 0;

    // reset smoothing filter (avoid parameter mutation)
    this.smoothingIndex = 0;
  }

  process(
    inputs: Array<Array<Float32Array>>,
    outputs: Array<Array<Float32Array>>
  ) {
    const input = inputs[0];
    const output = outputs[0];

    if (input.length === 0 || !input[0]) {
      return true;
    }

    const inputChannel = input[0];
    const outputChannel = output[0];
    const frameLength = inputChannel.length;

    // check if bypass mode (original sound
    const isBypassMode =
      Math.abs(this.pitchRatio - 1.0) < 0.01 && this.dryWet < 0.01;

    if (isBypassMode) {
      // bypass mode: determine output based on transmission state
      for (let i = 0; i < frameLength; i++) {
        const cleanSample = this.validateAndFixSample(inputChannel[i]);

        if (this.isTransmitting) {
          // transmission mode: only send to main thread, AudioWorklet does not directly output
          outputChannel[i] = 0; // silence direct output
          if (this.outputWritePos < this.outputBufferSize) {
            this.outputBuffer[this.outputWritePos] = cleanSample;
            this.outputWritePos++;
          }
        } else {
          // non-transmission mode: directly output through AudioWorklet
          outputChannel[i] = cleanSample;
        }
      }
    } else {
      // normal processing mode
      // first write input data to ring buffer
      for (let i = 0; i < frameLength; i++) {
        this.buffer[this.writePos] = inputChannel[i];
        this.writePos = (this.writePos + 1) % this.bufferSize;
      }

      // check if buffer is ready
      if (!this.isBufferReady) {
        const filled =
          this.writePos >= this.minBufferFill
            ? this.writePos
            : this.writePos + this.bufferSize;
        if (filled >= this.minBufferFill) {
          this.isBufferReady = true;
          console.log(
            `[PitchShift] Buffer ready (filled: ${filled}/${this.bufferSize}, pitch: ${this.pitchRatio})`
          );
        } else {
          // buffer not ready, output silence
          outputChannel.fill(0);
          return true;
        }
      }

      // check read/write position (reduce frequency)
      const positionOk = this.manageReadWritePositions();

      // process each output sample
      for (let i = 0; i < frameLength; i++) {
        let processedSample = 0;

        if (positionOk || this.positionCheckCounter > 0) {
          // position normal or just checked, normal processing
          let readPos = this.readPos % this.bufferSize;
          if (readPos < 0) readPos += this.bufferSize;

          // linear interpolation
          const intPos = Math.floor(readPos);
          const frac = readPos - intPos;
          const nextPos = (intPos + 1) % this.bufferSize;

          // safe read
          const sampleA = this.buffer[intPos] || 0;
          const sampleB = this.buffer[nextPos] || 0;
          const raw = sampleA * (1 - frac) + sampleB * frac;

          if (this.dryWet < 0.01) {
            processedSample = raw;
          } else {
            const filtered =
              raw - this.hpf.prevIn + this.hpf.alpha * this.hpf.prevOut;
            this.hpf.prevIn = raw;
            this.hpf.prevOut = filtered;
            processedSample = filtered * this.dryWet + raw * (1 - this.dryWet);
          }

          // smart step control: balance speed and stability
          let actualStep = this.pitchRatio;

          if (this.pitchRatio > 1.0) {
            // calculate current distance
            const currentDistance =
              (this.writePos - this.readPos + this.bufferSize) %
              this.bufferSize;

            // dynamic step adjustment: distance越小，步进越保守
            if (this.pitchRatio > 1.8) {
              // high pitch conservative strategy
              if (currentDistance < this.bufferSize * 0.2) {
                // distance very small, use very conservative step
                actualStep = this.pitchRatio * 0.8;
              } else if (currentDistance < this.bufferSize * 0.3) {
                // distance small, moderate conservative step
                actualStep = this.pitchRatio * 0.9;
              }
              // distance enough, use normal step
            }

            // prevent duplicate read basic check
            const nextReadPos = this.readPos + actualStep;
            const currentIntPos = Math.floor(this.readPos);
            const nextIntPos = Math.floor(nextReadPos % this.bufferSize);

            if (nextIntPos === currentIntPos) {
              actualStep = Math.ceil(this.readPos) - this.readPos + 0.1;
            }
          } else {
            // pitch <= 1, keep original logic
            actualStep = Math.max(actualStep, 0.1); // ensure minimum step
          }

          this.readPos += actualStep;

          // wrap around
          if (this.readPos >= this.bufferSize) {
            this.readPos -= this.bufferSize;
          }
          if (this.readPos < 0) {
            this.readPos += this.bufferSize;
          }
        } else {
          // position有问题，输出静音避免噪音
          processedSample = 0;
        }

        // quality check and smoothing
        processedSample = this.validateAndFixSample(processedSample);
        if (this.dryWet > 0.01 && processedSample !== 0) {
          processedSample = this.applySmoothingFilter(processedSample);
        }

        // determine output based on transmission state, avoid double playback
        if (this.isTransmitting) {
          // transmission mode: only send to main thread playback
          outputChannel[i] = 0; // AudioWorklet silence output
          if (this.outputWritePos < this.outputBufferSize) {
            this.outputBuffer[this.outputWritePos] = processedSample;
            this.outputWritePos++;
          }
        } else {
          // non-transmission mode: directly output through AudioWorklet
          outputChannel[i] = processedSample;
        }
      }
    }

    // latency monitoring (report once per second)
    const currentTime = Date.now();
    if (currentTime - this.lastLatencyReport > 1000) {
      const bufferLatency = (this.outputWritePos / this.sampleRate) * 1000; // ms
      const distance =
        (this.writePos - this.readPos + this.bufferSize) % this.bufferSize;
      const ringBufferLatency = (distance / this.sampleRate) * 1000; // ms

      // calculate current safe distance (for diagnosis)
      let currentSafeDistance = 3072;
      if (this.pitchRatio <= 1.5) {
        currentSafeDistance += (this.pitchRatio - 1.0) * 2048;
      } else if (this.pitchRatio <= 2.5) {
        currentSafeDistance += 1024 + (this.pitchRatio - 1.5) * 3072;
      } else {
        currentSafeDistance += 4096 + (this.pitchRatio - 2.5) * 4096;
      }
      const safeDistanceMs = (currentSafeDistance / this.sampleRate) * 1000;

      console.log(
        `[PitchShift] Latency Report - Pitch: ${this.pitchRatio.toFixed(
          1
        )}, Output: ${bufferLatency.toFixed(
          1
        )}ms, Ring: ${ringBufferLatency.toFixed(
          1
        )}ms, Safe: ${safeDistanceMs.toFixed(1)}ms`
      );
      this.lastLatencyReport = currentTime;
    }

    // transmit audio data to main thread
    this.transmitAudioData();

    // more aggressive transmission strategy, reduce delay
    if (this.outputWritePos >= this.outputBufferSize * 0.4) {
      // 40% transmission
      this.transmitAudioData(true);
    }

    return true;
  }
}

registerProcessor("pitch-shift-audio-processor", PitchShiftProcessor);
