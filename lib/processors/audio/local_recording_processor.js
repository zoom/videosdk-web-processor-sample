class LocalRecordingAudioProcessor extends AudioProcessor {
  #DEFAULT_SAMPLE_RATE = 48000;
  #ENC_ERR_NO_ENCODE_DATA = -1;
  #ENC_ERR_BAD_SAMPLE_RATE = -2;
  #ENC_ERR_BAD_NUM_CHANNELS = -3;
  #ENC_ERR_AUDIO_DATA_INCOMPLETE = -4;
  #ENC_ERR_NO_SAMPLE_DATA = -5;

  constructor(port, options) {
    super(port, options);
    this.recordedData = []; // save the audio recording data
    this.isRecording = false;
    this.sampleRate = 0;
    this.numChannels = 0; // default is 0, it will be updated with main thread

    this.port.onmessage = (event) => {
      const { command, config } = event.data;
      if (command === "start") {
        console.log(
          `start to record audio data! config: ${JSON.stringify(config)}`
        );
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

        this.#encodeAndSendData();
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
      } else {
        console.warn(`processor: channel ${i} expected but no data found!`);
        if (i < numOfInputChannels && inputChannels[i]) {
          console.warn(`channel ${i} is empty, but has data`);
        } else {
          const firstChannelLength =
            inputChannels[0] && inputChannels[0].length > 0
              ? inputChannels[0].length
              : 128;
          currentBlockOfChannels.push(new Float32Array(firstChannelLength));
        }
      }
    }

    if (currentBlockOfChannels.length > 0) {
      if (currentBlockOfChannels.length === this.numChannels) {
        this.recordedData.push(currentBlockOfChannels);
      } else if (
        currentBlockOfChannels.length < this.numChannels &&
        currentBlockOfChannels.length > 0
      ) {
        // it happens when input channels are filled with silence data
        while (currentBlockOfChannels.length < this.numChannels) {
          const firstChannelLength =
            currentBlockOfChannels[0] && currentBlockOfChannels[0].length > 0
              ? currentBlockOfChannels[0].length
              : inputChannels[0] && inputChannels[0].length > 0
              ? inputChannels[0].length
              : 128;
          currentBlockOfChannels.push(new Float32Array(firstChannelLength));
        }
        this.recordedData.push(currentBlockOfChannels);
      } else if (currentBlockOfChannels.length > this.numChannels) {
        this.recordedData.push(
          currentBlockOfChannels.slice(0, this.numChannels)
        );
      }
    }

    return true;
  }

  #encodeAndSendData() {
    if (this.recordedData.length === 0) {
      this.port.postMessage({
        type: "error",
        message: "no recorded data to encode",
      });
      return;
    }

    if (this.sampleRate <= 0 || this.numChannels <= 0) {
      this.port.postMessage({
        type: "error",
        message: "invalid sample rate",
      });
      return;
    }

    try {
      const wavArrayBuffer = this.#encodeWAV();
      if (wavArrayBuffer.errno !== 0 || !wavArrayBuffer.buffer) {
        this.port.postMessage({
          type: "error",
          message: "failed to encode wav data",
        });
        return;
      }

      this.port.postMessage(
        {
          type: "encodedRecordingData",
          buffer: wavArrayBuffer.buffer,
        },
        [wavArrayBuffer.buffer]
      );
    } catch (error) {
      this.port.postMessage({
        type: "error",
        message: "failed to encode wav data",
      });
      console.error(`failed to encode wav data: ${error}`);
    } finally {
      this.recordedData = [];
    }
  }

  #encodeWAV() {
    if (this.recordedData.length === 0) {
      console.error(`no data to encode!`);
      return {
        errno: this.#ENC_ERR_NO_ENCODE_DATA,
        buffer: null,
      };
    }

    if (this.sampleRate <= 0) {
      console.error(`invalid sample rate: ${this.sampleRate}`);
      return {
        errno: this.#ENC_ERR_BAD_SAMPLE_RATE,
        buffer: null,
      };
    }

    if (this.numChannels <= 0) {
      console.error(`invalid number of channels: ${this.numChannels}`);
      return {
        errno: this.#ENC_ERR_BAD_NUM_CHANNELS,
        buffer: null,
      };
    }

    // 1. to calculate how many samples of each channel
    let samplesPerChannel = 0;
    if (
      this.recordedData.length > 0 &&
      this.recordedData[0].length > 0 &&
      this.recordedData[0][0]
    ) {
      for (const block of this.recordedData) {
        if (block && block[0]) {
          samplesPerChannel += block[0].length;
        }
      }
    } else {
      return {
        errno: this.#ENC_ERR_AUDIO_DATA_INCOMPLETE,
        buffer: null,
      };
    }

    if (samplesPerChannel <= 0) {
      console.error(`no samples to encode!`);
      return {
        errno: this.#ENC_ERR_NO_SAMPLE_DATA,
        buffer: null,
      };
    }

    // 2. create a buffer to store the encoded data
    const totalInterleavedSamples = samplesPerChannel * this.numChannels;
    const interleavedSamples = new Float32Array(totalInterleavedSamples);

    // 3. interleave the audio data
    const fullChannelData = [];
    for (let ch = 0; ch < this.numChannels; ch++) {
      const channelBuffer = new Float32Array(samplesPerChannel);
      let channelWriteOffset = 0;
      for (const block of this.recordedData) {
        if (block && block[ch] && block[ch].length > 0) {
          channelBuffer.set(block[ch], channelWriteOffset);
          channelWriteOffset += block[ch].length;
        }
      }
      fullChannelData.push(channelBuffer);
    }

    // 4. interleave the audio data
    let interleavedWriteOffset = 0;
    for (let s = 0; s < samplesPerChannel; s++) {
      for (let ch = 0; ch < this.numChannels; ch++) {
        if (fullChannelData[ch]) {
          interleavedSamples[interleavedWriteOffset++] = fullChannelData[ch][s];
        } else {
          interleavedSamples[interleavedWriteOffset++] = 0.0;
        }
      }
    }

    const bitDepth = 16;
    const bytesPerSamples = bitDepth / 8;
    const blockAlign = this.numChannels * bytesPerSamples;
    const byteRate = this.sampleRate * blockAlign;
    const dataSize = interleavedSamples.length * bytesPerSamples;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    this.#writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    this.#writeString(view, 8, "WAVE");
    this.#writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, this.numChannels, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    this.#writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);
    this.#floatTo16BitPCM(view, 44, interleavedSamples);

    return {
      errno: 0,
      buffer: buffer,
    };
  }

  #floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }

  #writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

registerProcessor(
  "local_recording_audio_processor",
  LocalRecordingAudioProcessor
);
