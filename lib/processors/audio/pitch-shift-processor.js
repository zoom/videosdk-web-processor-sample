/**
 * Direct Audio Graph Pitch Shift Processor
 * Works as a pure audio node: input -> process -> output
 */
class PitchShiftProcessor extends AudioProcessor {
  constructor() {
    super();

    // Pitch shifting parameters
    this.pitchRatio = 1.5; // 1.0 = no change, 2.0 = one octave up, 0.5 = one octave down
    this.formantRatio = 1.2; // Formant preservation
    this.dryWet = 0.7; // 0.0 = dry (original), 1.0 = wet (processed)
    this.isEnabled = true; // Enable/disable processing

    // Pitch shifting algorithm state
    this.bufferSize = 8192; // Circular buffer size
    this.inputBuffer = new Float32Array(this.bufferSize);
    this.writePos = 0;
    this.readPos = 0;

    // High-pass filter for DC removal
    this.hpFilter = {
      x1: 0,
      y1: 0,
      alpha: 0.995, // High-pass cutoff around 7.5 Hz at 48kHz
    };

    // Message handling from main thread
    this.port.onmessage = (event) => {
      const { command, data } = event.data;
      this.handleMessage(command, data);
    };

    console.log("[PitchShiftProcessor] Initialized as direct audio node");
  }

  handleMessage(command, data) {
    switch (command) {
      case "update-config":
        if (data.pitchRatio !== undefined) {
          this.pitchRatio = Math.max(0.25, Math.min(4.0, data.pitchRatio));
        }
        if (data.formantRatio !== undefined) {
          this.formantRatio = Math.max(0.25, Math.min(4.0, data.formantRatio));
        }
        if (data.dryWet !== undefined) {
          this.dryWet = Math.max(0.0, Math.min(1.0, data.dryWet));
        }
        console.log(
          `[PitchShiftProcessor] Config updated: pitch=${this.pitchRatio.toFixed(
            2
          )}, formant=${this.formantRatio.toFixed(
            2
          )}, dryWet=${this.dryWet.toFixed(2)}`
        );
        break;

      case "set-enabled":
        this.isEnabled = data.enabled !== undefined ? data.enabled : true;
        console.log(
          `[PitchShiftProcessor] Processing ${
            this.isEnabled ? "enabled" : "disabled"
          }`
        );
        break;

      default:
        console.warn(`[PitchShiftProcessor] Unknown command: ${command}`);
    }
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

    // Calculate read position with pitch shift
    this.readPos += this.pitchRatio;
    if (this.readPos >= this.bufferSize) {
      this.readPos -= this.bufferSize;
    }

    // Linear interpolation for fractional read position
    const readPosInt = Math.floor(this.readPos);
    const readPosFrac = this.readPos - readPosInt;
    const nextReadPos = (readPosInt + 1) % this.bufferSize;

    const sample1 = this.inputBuffer[readPosInt] || 0;
    const sample2 = this.inputBuffer[nextReadPos] || 0;
    const interpolated = sample1 * (1 - readPosFrac) + sample2 * readPosFrac;

    return interpolated;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // If no input or output, return
    if (!input || !output || input.length === 0 || output.length === 0) {
      return true;
    }

    const inputLength = input[0] ? input[0].length : 0;
    if (inputLength === 0) {
      return true;
    }

    // Process each channel
    for (let channel = 0; channel < output.length; channel++) {
      const inputChannel =
        input[channel] || input[0] || new Float32Array(inputLength);
      const outputChannel = output[channel];

      if (!outputChannel) continue;

      for (let i = 0; i < inputLength; i++) {
        const inputSample = inputChannel[i] || 0;

        if (!this.isEnabled) {
          // Bypass: direct copy input to output
          outputChannel[i] = inputSample;
          continue;
        }

        // Apply high-pass filter to remove DC
        const filteredInput = this.highPassFilter(inputSample);

        // Apply pitch shifting
        const pitchShifted = this.processPitchShift(filteredInput);

        // Simple formant correction (basic spectral envelope preservation)
        const formantCorrected = pitchShifted * this.formantRatio;

        // Mix dry and wet signals
        const drySignal = inputSample;
        const wetSignal = formantCorrected;
        const mixedSignal =
          drySignal * (1 - this.dryWet) + wetSignal * this.dryWet;

        outputChannel[i] = mixedSignal;
      }
    }

    return true; // Keep the processor alive
  }

  static get parameterDescriptors() {
    return [];
  }
}

registerProcessor("pitch-shift-processor", PitchShiftProcessor);
