class LocalRecordingAudioProcessor extends AudioProcessor {
  #DEFAULT_SAMPLE_RATE = 48000;
  constructor(port, options) {
    super(port, options);
    this.recordedData = []; // save the audio recording data
    this.isRecording = false;
    this.sampleRate = 0;
    this.numChannels = 0; // default is 0, it will be updated with main thread

    this.port.onmessage = (event) => {
      const { command, config } = event.data;
      if (command === "start") {
        this.isRecording = true;
        this.recordedData = [];
        if (config) {
          this.sampleRate = config.sampleRate;
          this.numChannels = config.numChannels || 2;
        } else {
          this.sampleRate = this.#DEFAULT_SAMPLE_RATE;
          this.numChannels = 2;
        }

        this.port.postMessage({
          type: "status",
          message: "local recording is started...",
        });
      } else if (command === "stop") {
        this.isRecording = false;
        this.port.postMessage({
          type: "status",
          message: "local recording is stopped...",
        });

        // TODO: encode the audio data and sent it to the main thread
        // _encodeAndSendData();
      }
    };
  }

  onInit() {
    console.log(`local recording audio processor init`);
  }

  onUninit() {
    console.log(`local recording audio processor uninit`);
  }

  process(inputs, outputs, parameters) {
    if (!this.isRecording || this.numChannels === 0) {
      return true;
    }

    const inputChannels = inputs[0]; // get first input port channels
    if (!inputChannels || inputChannels.length === 0) {
      console.warn(`no input channels`);
      return true;
    }

    const numOfInputChannels = inputChannels.length;
    if (
      numOfInputChannels === 0 ||
      !inputChannels[0] ||
      inputChannels[0].length === 0
    ) {
      console.warn(`first input channel is empty, no data!`);
      return true;
    }

    const channelsToStore = Math.min(numOfInputChannels, this.numChannels);
    const currentBlockOfChannels = [];

    for (let i = 0; i < channelsToStore; i++) {
      if (inputChannels[i] && inputChannels[i].length > 0) {
        currentBlockOfChannels.push(inputChannels[i].slice());
      }
    }

    return true;
  }
}

registerProcessor(
  "local_recording_audio_processor",
  LocalRecordingAudioProcessor
);
