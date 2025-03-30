class AudioClassificationProcessor extends AudioProcessor {
  constructor(port, options) {
    super(port, options);
    this.port.onmessage = (event) => {
      const { cmd } = event.data;
      if (cmd === "start_classification") {
        this.isClassifying = true;
      } else if (cmd === "stop_classification") {
        this.isClassifying = false;
      }
    };
    this.isClassifying = false;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0 || !input[0]) {
      console.warn("No valid input data, clearing output");
      output.forEach((channel) => channel.fill(0));
      return true;
    }

    // Pass through audio
    const channelCount = Math.min(input.length, output.length);
    for (let channel = 0; channel < channelCount; ++channel) {
      if (input[channel] && output[channel]) {
        output[channel].set(input[channel]);
      }
    }

    // Send audio data for classification if enabled
    if (this.isClassifying && input[0]) {
      // Create a copy of the audio data to avoid modifying the input
      const audioData = new Float32Array(input[0]);
      this.port.postMessage(
        {
          cmd: "audio_data",
          audioData: audioData,
        },
        [audioData.buffer]
      );
    }

    return true;
  }
}

registerProcessor(
  "audio-classification-processor",
  AudioClassificationProcessor
);
