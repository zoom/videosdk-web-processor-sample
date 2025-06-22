# Local Recording Audio Processor

A local audio recording processor that can record microphone audio and output it as PCM format raw audio data.

## Quick Start

### Step 1: Create Processor

```javascript
const processor = stream.createProcessor({
  url: '/local_recording_processor.js',
  name: 'local_recording_audio_processor',
  type: 'audio'
});

await stream.addProcessor(processor);
```

### Step 2: Start Recording

```javascript
processor.port.postMessage({
  command: 'start',
  config: {
    sampleRate: 48000,    // Sample rate
    numChannels: 2,       // Number of channels (1=mono, 2=stereo)
    audioFormat: 'pcm'    // Output format
  }
});
```

### Step 3: Stop Recording and Get Data

```javascript
// Stop recording
processor.port.postMessage({
  command: 'stop'
});

// Listen for recording results
processor.port.onmessage = (event) => {
  const { type, buffer, errno } = event.data;
  
  if (type === 'encoding' && errno === 0) {
    console.log('Recording completed, PCM data size:', buffer.byteLength);
    // Process PCM audio data
    handlePCMData(buffer);
  }
};
```

## Complete Example

```javascript
class SimpleAudioRecorder {
  constructor() {
    this.processor = null;
    this.isRecording = false;
  }
  
  async init(stream) {
    this.processor = stream.createProcessor({
      url: '/local_recording_processor.js',
      name: 'local_recording_audio_processor',
      type: 'audio'
    });
    
    this.processor.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    await stream.addProcessor(this.processor);
  }
  
  startRecording() {
    this.processor.port.postMessage({
      command: 'start',
      config: {
        sampleRate: 48000,
        numChannels: 2,
        audioFormat: 'pcm'
      }
    });
    this.isRecording = true;
    console.log('Recording started...');
  }
  
  stopRecording() {
    this.processor.port.postMessage({
      command: 'stop'
    });
    this.isRecording = false;
    console.log('Recording stopped...');
  }
  
  handleMessage(data) {
    switch (data.type) {
      case 'status':
        console.log('Status:', data.message);
        break;
        
      case 'encoding':
        if (data.errno === 0) {
          console.log('Recording successful, data size:', data.buffer.byteLength);
          this.savePCMFile(data.buffer);
        } else {
          console.error('Recording failed, error code:', data.errno);
        }
        break;
        
      case 'error':
        console.error('Recording error:', data.message);
        break;
    }
  }
  
  savePCMFile(buffer) {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording_${Date.now()}.pcm`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
}

// Usage example
const recorder = new SimpleAudioRecorder();

// Get microphone permission and initialize
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(async (stream) => {
    await recorder.init(stream);
    
    // Start recording
    recorder.startRecording();
    
    // Stop after 10 seconds
    setTimeout(() => {
      recorder.stopRecording();
    }, 10000);
  })
  .catch(console.error);
```

## Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| sampleRate | 48000 | Sample rate, common values: 48000 (professional), 44100 (CD quality), 22050 (voice) |
| numChannels | 2 | Number of channels, 1=mono, 2=stereo |
| audioFormat | 'pcm' | Output format, fixed as PCM |

## Event Types

| Event Type | Description |
|------------|-------------|
| status | Recording status messages |
| processing | Real-time audio data |
| encoding | Recording completed, contains PCM data |
| error | Error messages |

## Error Codes

| Error Code | Description |
|------------|-------------|
| -1 | No recorded data |
| -2 | Invalid sample rate |
| -3 | Invalid number of channels |
| -4 | Incomplete audio data |
| -5 | No sample data |

## Source Code

The processor is implemented as an AudioWorklet processor that extends the base `AudioProcessor` class:

```javascript
import * as lame from "@breezystack/lamejs";

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
    this.audioFormat = "wav";

    this.port.onmessage = (event) => {
      const { command, config } = event.data;
      if (command === "start") {
        console.log(`start to record audio data! config: ${JSON.stringify(config)}`);
        this.isRecording = true;
        this.recordedData = [];
        if (config) {
          this.sampleRate = config.sampleRate;
          this.numChannels = config.numChannels || 2;
          this.audioFormat = config.audioFormat || "wav";
        } else {
          this.sampleRate = this.#DEFAULT_SAMPLE_RATE;
          this.numChannels = 2;
          this.audioFormat = "wav";
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

        this.#encodeAndSendData(this.audioFormat);
      }
    };
  }

  onInit() {
    console.log(`local recording audio processor init`);
  }

  onUninit() {
    console.log(`local recording audio processor uninit`);
    this.isRecording = false;
    this.recordedData = [];
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
    if (numOfInputChannels === 0 || !inputChannels[0] || inputChannels[0].length === 0) {
      console.warn(`first input channel is empty, no data!`);
      return true;
    }

    // write inputs to outputs (pass-through)
    const outputChannels = outputs[0];
    for (let ch = 0; ch < inputChannels.length; ch++) {
      outputChannels[ch].set(inputChannels[ch]);
    }

    // Store audio data for recording
    const channelsToStore = Math.min(numOfInputChannels, this.numChannels);
    const currentBlockOfChannels = [];

    for (let i = 0; i < channelsToStore; i++) {
      if (inputChannels[i] && inputChannels[i].length > 0) {
        currentBlockOfChannels.push(inputChannels[i].slice());
      } else {
        const firstChannelLength = inputChannels[0] && inputChannels[0].length > 0 
          ? inputChannels[0].length : 128;
        currentBlockOfChannels.push(new Float32Array(firstChannelLength));
      }
    }

    if (currentBlockOfChannels.length > 0) {
      this.recordedData.push(currentBlockOfChannels);
    }

    return true;
  }

  #encodeAndSendData(audioFormat) {
    if (this.recordedData.length === 0) {
      this.port.postMessage({
        type: "error",
        message: "no recorded data to encode",
      });
      return;
    }

    let encodedResult = { errno: 0, buffer: null };

    try {
      if (audioFormat === "wav") {
        encodedResult = this.#encodeWAV();
      } else if (audioFormat === "mp3") {
        encodedResult = this.#encodeMP3();
      } else if (audioFormat === "pcm") {
        encodedResult = this.#encodePCM();
      }

      this.port.postMessage({
        type: "encoding",
        audioFormat: this.audioFormat,
        errno: encodedResult.errno,
        buffer: encodedResult.buffer,
      }, [encodedResult.buffer]);
    } catch (error) {
      this.port.postMessage({
        type: "error",
        message: "failed to encode audio data",
      });
      console.error(`failed to encode audio data: ${error}`);
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

  #encodeMP3() {
    if (this.recordedData.length === 0) {
      console.error("no data to encode!");
      return {
        errno: this.#ENC_ERR_NO_ENCODE_DATA,
        buffer: null,
      };
    }

    if (this.sampleRate <= 0) {
      console.error(`invalid sample rate! sampleRate:${this.sampleRate}`);
      return {
        errno: this.#ENC_ERR_NO_ENCODE_DATA,
        buffer: null,
      };
    }

    if (this.numChannels <= 0) {
      console.error(
        `invalid number of channels! numChannels:${this.numChannels}`
      );
      return {
        errno: this.#ENC_ERR_BAD_NUM_CHANNELS,
        buffer: null,
      };
    }

    // 1.calculate samples per channel
    let samplesPerChannel = 0;
    for (const block of this.recordedData) {
      if (block && block[0]) {
        samplesPerChannel += block[0].length;
      }
    }

    if (samplesPerChannel <= 0) {
      console.error(`no sample data!`);
      return {
        errno: this.#ENC_ERR_NO_SAMPLE_DATA,
        buffer: null,
      };
    }

    const totalSamples = samplesPerChannel * this.numChannels;
    const interleaved = new Float32Array(totalSamples);
    const channels = Array.from(
      { length: this.numChannels },
      () => new Float32Array(samplesPerChannel)
    );
    for (let ch = 0; ch < this.numChannels; ch++) {
      let offset = 0;
      for (const block of this.recordedData) {
        if (block && block[ch]) {
          channels[ch].set(block[ch], offset);
          offset += block[ch].length;
        }
      }
    }

    let w = 0;
    for (let i = 0; i < samplesPerChannel; i++) {
      for (let ch = 0; ch < this.numChannels; ch++) {
        interleaved[w++] = channels[ch][i];
      }
    }

    function floatTo16BitPcmNoOffset(input) {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return output;
    }

    const kbps = 128;
    const mp3Encoder = new lame.Mp3Encoder(
      this.numChannels,
      this.sampleRate,
      kbps
    );
    const maxSamples = 1152;
    const mp3Chunks = [];

    if (this.numChannels === 1) {
      const pcm16 = floatTo16BitPcmNoOffset(interleaved);
      for (let i = 0; i < pcm16.length; i += maxSamples) {
        const slice = pcm16.subarray(i, i + maxSamples);
        const mp3buf = mp3Encoder.encodeBuffer(slice);
        if (mp3buf.length > 0) {
          mp3Chunks.push(mp3buf);
        }
      }
    } else {
      // multiple channels
      const pcm16 = floatTo16BitPcmNoOffset(interleaved);
      const left = [],
        right = [];
      for (let i = 0; i < pcm16.length; i += 2) {
        left.push(pcm16[i]);
        right.push(pcm16[i + 1]);
      }

      for (let i = 0; i < left.length; i += maxSamples) {
        const leftSlice = left.slice(i, i + maxSamples);
        const rightSlice = right.slice(i, i + maxSamples);
        const mp3buf = mp3Encoder.encodeBuffer(leftSlice, rightSlice);
        if (mp3buf.length > 0) {
          mp3Chunks.push(mp3buf);
        }
      }
    }

    // flush
    const flushBuf = mp3Encoder.flush();
    if (flushBuf.length > 0) {
      mp3Chunks.push(flushBuf);
    }

    const totalLength = mp3Chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of mp3Chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      errno: 0,
      buffer: buffer.buffer,
    };
  }

  #encodePCM() {
    if (this.recordedData.length === 0) {
      console.error("no data to encode!");
      return {
        errno: this.#ENC_ERR_NO_ENCODE_DATA,
        buffer: null,
      };
    }

    if (this.sampleRate <= 0) {
      console.error(`invalid sample rate! sampleRate:${this.sampleRate}`);
      return {
        errno: this.#ENC_ERR_NO_ENCODE_DATA,
        buffer: null,
      };
    }

    if (this.numChannels <= 0) {
      console.error(
        `invalid number of channels! numChannels:${this.numChannels}`
      );
      return {
        errno: this.#ENC_ERR_BAD_NUM_CHANNELS,
        buffer: null,
      };
    }

    // 1. calculate total samples
    const samplesPerChannel = this.recordedData.reduce((sum, block) => {
      return sum + (block[0]?.length || 0);
    }, 0);

    if (samplesPerChannel <= 0) {
      console.error(`no samples to encode!`);
      return {
        errno: this.#ENC_ERR_NO_SAMPLE_DATA,
        buffer: null,
      };
    }

    // 2. flatten the recorded data
    const flatChannels = Array.from(
      { length: this.numChannels },
      () => new Float32Array(samplesPerChannel)
    );

    let offset = 0;
    for (const block of this.recordedData) {
      const blockLen = block[0]?.length || 0;
      for (let ch = 0; ch < this.numChannels; ch++) {
        const buf = block[ch] || new Float32Array(blockLen);
        flatChannels[ch].set(buf, offset);
      }
      offset += blockLen;
    }

    // 3. interleave the channels
    const totalSamples = samplesPerChannel * this.numChannels;
    const interleaved = new Float32Array(totalSamples);
    for (let i = 0; i < samplesPerChannel; i++) {
      for (let ch = 0; ch < this.numChannels; ch++) {
        interleaved[i * this.numChannels + ch] = flatChannels[ch][i];
      }
    }

    // 4. 32-bit PCM encoding
    const bytesPerSample = 4;
    const pcmBuffer = new ArrayBuffer(totalSamples * bytesPerSample);
    const view = new DataView(pcmBuffer);
    for (let i = 0; i < interleaved.length; i++) {
      view.setFloat32(i * bytesPerSample, interleaved[i], true);
    }

    return {
      errno: 0,
      buffer: pcmBuffer,
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

registerProcessor("local_recording_audio_processor", LocalRecordingAudioProcessor);
```

## Important Notes

1. **Browser Permissions**: Requires user authorization for microphone access
2. **HTTPS Requirement**: HTTPS protocol required in production environments
3. **File Size**: PCM files are large, approximately 11MB per minute for stereo 48kHz
4. **Browser Support**: Requires modern browsers with AudioWorklet support

## Common Issues

**Q: No sound in recording?**
A: Check microphone permissions and device connections

**Q: File too large?**
A: Reduce sample rate or use mono recording

**Q: How to play PCM files?**
A: PCM is raw data, needs conversion to WAV or other formats for playback