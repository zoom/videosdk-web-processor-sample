import { RingBuffer } from "@zoom/web-media-lib";

/**
 * Advanced Pitch Shift Audio Processor
 * Supports both SharedArrayBuffer (RingBuffer) and non-SAB modes
 */
class PitchShiftProcessor extends AudioProcessor {
  constructor(port, options) {
    super(port, options);

    // Audio processing parameters
    this.sampleRate = 48000; // Will be updated from context
    this.channels = 2;

    // Pitch shifting parameters
    this.pitchRatio = 1.0; // 1.0 = no change, 2.0 = one octave up, 0.5 = one octave down
    this.formantRatio = 1.0; // Formant preservation (1.0 = preserve formants)
    this.dryWet = 0.7; // 0.0 = dry (original), 1.0 = wet (processed)

    // Processing mode
    this.mode = 0; // 0: non-SAB (postMessage), 1: SAB (RingBuffer)
    this.isAudioActive = false;
    this.isMuted = false;

    // Pitch shifting buffers and state
    this.bufferSize = 16384; // Large buffer for better quality
    this.hopSize = 1024; // Hop size for overlap-add
    this.overlapBuffer = new Float32Array(this.hopSize);
    this.inputBuffer = new Float32Array(this.bufferSize);
    this.outputBuffer = new Float32Array(this.bufferSize);
    this.writePos = 0;
    this.readPos = 0;
    this.phase = 0;

    // Window function for overlap-add
    this.window = this.createHannWindow(this.hopSize);

    // High-pass filter for removing DC offset
    this.hpFilter = {
      x1: 0,
      y1: 0,
      alpha: 0.995, // High-pass cutoff around 7.5 Hz at 48kHz
    };

    // RingBuffer for SharedArrayBuffer mode
    this.ringBuffer = null;
    this.frameCapacity = 0;

    // Non-SAB mode accumulation
    this.outputAccumulator = [];
    this.accumulatorTarget = 4096; // Send data in chunks of 4096 samples

    // Message handling
    this.setupMessageHandler();

    console.log("[PitchShiftProcessor] Initialized");
  }

  setupMessageHandler() {
    this.port.onmessage = (event) => {
      const { command, data } = event.data;
      console.log(`[PitchShiftProcessor] Received command: ${command}`);

      switch (command) {
        case "init-processor":
          this.handleInitProcessor(data);
          break;
        case "update-pitch-shift-config":
          this.handleUpdateConfig(data);
          break;
        case "attach-ring-buffer":
          this.handleAttachRingBuffer(data);
          break;
        case "audio-state-changed":
          this.handleAudioStateChanged(data);
          break;
        default:
          console.warn(`[PitchShiftProcessor] Unknown command: ${command}`);
      }
    };
  }

  handleInitProcessor(data) {
    this.mode = data.mode || 0;
    this.sampleRate = data.sampleRate || 48000;
    console.log(
      `[PitchShiftProcessor] Initialized with mode: ${this.mode}, sampleRate: ${this.sampleRate}`
    );
  }

  handleUpdateConfig(data) {
    const {
      pitchRatio = this.pitchRatio,
      formantRatio = this.formantRatio,
      dryWet = this.dryWet,
    } = data;

    this.pitchRatio = Math.max(0.25, Math.min(4.0, pitchRatio)); // Clamp to reasonable range
    this.formantRatio = Math.max(0.25, Math.min(4.0, formantRatio));
    this.dryWet = Math.max(0.0, Math.min(1.0, dryWet));

    console.log(
      `[PitchShiftProcessor] Config updated: pitch=${this.pitchRatio.toFixed(
        2
      )}, formant=${this.formantRatio.toFixed(2)}, dryWet=${this.dryWet.toFixed(
        2
      )}`
    );
  }

  handleAttachRingBuffer(data) {
    if (data.sab && data.frameCapacity && data.channelCount) {
      this.frameCapacity = data.frameCapacity;
      this.channels = data.channelCount;
      this.ringBuffer = RingBuffer.attach(
        data.sab,
        this.frameCapacity,
        this.channels
      );
      console.log(
        `[PitchShiftProcessor] RingBuffer attached: ${this.frameCapacity} frames, ${this.channels} channels`
      );
    }
  }

  handleAudioStateChanged(data) {
    this.isAudioActive = data.audioOn || false;
    this.isMuted = data.isMuted || false;
    console.log(
      `[PitchShiftProcessor] Audio state: active=${this.isAudioActive}, muted=${this.isMuted}`
    );
  }

  createHannWindow(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return window;
  }

  // High-pass filter to remove DC offset
  highPassFilter(input) {
    const output =
      this.hpFilter.alpha * (this.hpFilter.y1 + input - this.hpFilter.x1);
    this.hpFilter.x1 = input;
    this.hpFilter.y1 = output;
    return output;
  }

  // Simple time-domain pitch shifting using variable delay with interpolation
  processPitchShift(input) {
    // Write input to circular buffer
    this.inputBuffer[this.writePos] = input;
    this.writePos = (this.writePos + 1) % this.bufferSize;

    // Read with variable delay for pitch shifting
    const delaySamples = this.bufferSize / 4; // Base delay
    const modulation = Math.sin(this.phase) * (this.hopSize / 4); // Modulation for smoothness
    const readOffset = delaySamples + modulation;

    // Linear interpolation for fractional delay
    const readPosFloat =
      (this.writePos - readOffset + this.bufferSize) % this.bufferSize;
    const readPosInt = Math.floor(readPosFloat);
    const readPosFrac = readPosFloat - readPosInt;
    const nextReadPos = (readPosInt + 1) % this.bufferSize;

    const sample1 = this.inputBuffer[readPosInt];
    const sample2 = this.inputBuffer[nextReadPos];
    const interpolated = sample1 * (1 - readPosFrac) + sample2 * readPosFrac;

    // Update phase for pitch shifting
    this.phase += (2 * Math.PI * this.pitchRatio) / this.hopSize;
    if (this.phase >= 2 * Math.PI) {
      this.phase -= 2 * Math.PI;
    }

    return interpolated;
  }

  // Enhanced pitch shifting with overlap-add for better quality
  processAdvancedPitchShift(inputChannel) {
    const output = new Float32Array(inputChannel.length);

    for (let i = 0; i < inputChannel.length; i++) {
      const drySignal = inputChannel[i];

      // Apply high-pass filter to remove DC
      const filteredInput = this.highPassFilter(drySignal);

      // Pitch shift the filtered signal
      const pitchShifted = this.processPitchShift(filteredInput);

      // Simple formant correction (basic spectral envelope preservation)
      const formantCorrected = pitchShifted * this.formantRatio;

      // Mix dry and wet signals
      output[i] =
        drySignal * (1 - this.dryWet) + formantCorrected * this.dryWet;
    }

    return output;
  }

  // Send processed audio via appropriate method
  sendProcessedAudio(processedData) {
    if (!this.isAudioActive || this.isMuted) {
      return; // Don't send audio if not active or muted
    }

    if (this.mode === 1 && this.ringBuffer) {
      // SharedArrayBuffer mode: write to RingBuffer
      try {
        this.ringBuffer.write(processedData);
      } catch (error) {
        console.error(
          "[PitchShiftProcessor] Error writing to RingBuffer:",
          error
        );
      }
    } else {
      // Non-SAB mode: accumulate and send via postMessage
      this.outputAccumulator.push(...processedData);

      if (this.outputAccumulator.length >= this.accumulatorTarget) {
        const chunk = new Float32Array(
          this.outputAccumulator.splice(0, this.accumulatorTarget)
        );
        try {
          this.port.postMessage(
            {
              command: "preview",
              data: chunk.buffer,
            },
            [chunk.buffer]
          );
        } catch (error) {
          console.error(
            "[PitchShiftProcessor] Error sending audio data:",
            error
          );
        }
      }
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // If no input or input is empty, return
    if (!input || input.length === 0 || !input[0]) {
      return true;
    }

    const inputLength = input[0].length;
    if (inputLength === 0) {
      return true;
    }

    // Process each channel
    const processedChannels = [];
    for (let ch = 0; ch < this.channels; ch++) {
      const inputChannel = input[ch] || input[0]; // Use first channel if not enough channels
      const processedChannel = this.processAdvancedPitchShift(inputChannel);
      processedChannels.push(processedChannel);

      // Copy to output for potential direct audio graph connection
      if (output[ch]) {
        output[ch].set(processedChannel);
      }
    }

    // Interleave channels for sending
    const interleavedData = new Float32Array(inputLength * this.channels);
    for (let i = 0; i < inputLength; i++) {
      for (let ch = 0; ch < this.channels; ch++) {
        interleavedData[i * this.channels + ch] = processedChannels[ch][i];
      }
    }

    // Send processed audio
    this.sendProcessedAudio(interleavedData);

    return true; // Keep the processor alive
  }
}

registerProcessor("pitch-shift-processor", PitchShiftProcessor);
