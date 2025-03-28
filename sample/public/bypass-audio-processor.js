// class BypassAudioProcessor extends AudioProcessor {
//   onInit() {
//     console.log('init bypass processor');
//   }
//   onUninit() {
//     console.log('uninit bypass processor');
//   }
//   process(inputs, outputs) {
//     const input = inputs[0];
//     const output = outputs[0];

//     if (input.length > 0) {
//       for (let channel = 0; channel < output.length; ++channel) {
//         output[channel].set(input[channel]);
//       }
//     }

//     return true;
//   }
// }

// registerProcessor("bypass-audio-processor", BypassAudioProcessor);

class BypassAudioProcessor extends AudioProcessor {
  constructor(port, options) {
    super(port, options);
    this.port.onmessage = (event) => {
      const { cmd, data } = event.data;
      console.log(`onmessage() cmd:${cmd}, data:${data}`);
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0 || !input[0]) {
      console.warn("No valid input data, clearing output");
      output.forEach(channel => channel.fill(0)); // Ensure output is silent
      return true;
    }

    const channelCount = Math.min(input.length, output.length);
    for (let channel = 0; channel < channelCount; ++channel) {
      if (input[channel] && output[channel]) {
        // Ensure data range is within [-1, 1]
        for (let i = 0; i < input[channel].length; i++) {
          output[channel][i] = Math.max(-1.0, Math.min(1.0, input[channel][i]));
        }
      }
    }

    // Only send when data is valid
    if (input[0].some(value => Math.abs(value) > 0.01)) {
      const copiedData = new Float32Array(input[0]); // Avoid modifying input directly
      this.port.postMessage({
        type: 'processedAudio',
        audioData: copiedData
      }, [copiedData.buffer]);  // Transfer ArrayBuffer
    }

    return true;
  }
}

registerProcessor('bypass-audio-processor', BypassAudioProcessor);
