import { AssemblyAIClient } from '../src/utils/assemblyai-client';

class TextToSpeechProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.assemblyClient = null;
    this.active = false;

    this.port.postMessage({
      cmd: 'processor_ready'
    });

    this.port.onmessage = (event) => {
      const { cmd, data } = event.data;
      console.log(`audio processor recv: ${JSON.stringify(event.data)}`);

      switch (cmd) {
        case 'process_audio':
          if (this.assemblyClient && this.active) {
            this.assemblyClient.sendAudio(data);
          }
          break;

        case 'start_transcription':
          this.active = true;
          if (data.apiKey) {
            this.assemblyClient = new AssemblyAIClient(data.apiKey);
            this.assemblyClient.connect((text) => {
              this.port.postMessage({ cmd: 'transcription_result', text });
            }).then(() => {
              this.port.postMessage({ cmd: 'initialized' });
            }).catch((err) => {
              this.port.postMessage({ cmd: 'error', error: err.message });
            });
          }
          break;

        case 'stop_transcription':
          this.active = false;
          if (this.assemblyClient) {
            this.assemblyClient.disconnect();
            this.assemblyClient = null;
          }
          break;

        case 'update_settings':
          if (data.apiKey && this.active) {
            if (this.assemblyClient) {
              this.assemblyClient.disconnect();
            }
            this.assemblyClient = new AssemblyAIClient(data.apiKey);
            this.assemblyClient.connect((text) => {
              this.port.postMessage({ cmd: 'transcription_result', text });
            }).catch((err) => {
              this.port.postMessage({ cmd: 'error', error: err.message });
            });
          }
          break;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    for (let channel = 0; channel < input.length; channel++) {
      output[channel].set(input[channel]);
    }

    if (this.active && this.assemblyClient && input[0]) {
      this.assemblyClient.sendAudio(input[0].buffer);
    }

    return true;
  }
}

registerProcessor('text-to-speech-processor', TextToSpeechProcessor);
