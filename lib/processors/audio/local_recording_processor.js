class LocalRecordingAudioProcessor extends AudioProcessor {
  constructor(port, options) {
    super(port, options);
    this.recordedData = []; // save the audio recording data
    this.isRecording = false;
    this.sampleRate = 0;
    this.numChannels = 1; // default is 1, it will be updated with main thread

    this.port.onmessage = (event) => {
      const { command, config } = event.data;
      if (command === "start") {
        this.isRecording = true;
        this.recordedData = [];
        if (config) {
          this.sampleRate = config.sampleRate || currentTime;
          this.numChannels = config.numChannels || 1;
        }

        this.port.postMessage({
          type: "status",
          message: "local recording is started...",
        });
      } else if (command === "stop") {
        this.isRecording = false;
        this.port.postMessage({
            type: 'status',
            message: 'local recording is stopped...'
        });
    };
  }

  onInit() {}

  onUninit() {}

  process(inputs, outputs, parameters) {
    return true;
  }
}

registerProcessor(
  "local_recording_audio_processor",
  LocalRecordingAudioProcessor
);
