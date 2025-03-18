import { RealtimeTranscriber } from 'assemblyai/streaming';

export class AssemblyAIClient {
  private realtimeTranscriber: RealtimeTranscriber = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async connect(onMessage: (text: string) => void) {
    try {
        this.realtimeTranscriber.current = new RealtimeTranscriber({
            token: this.apiKey,
            sampleRate: 16_000,
          });
    } catch (err) {
      console.error('AssemblyAI connection error:', err);
      throw err;
    }
  }

  sendAudio(audioData: ArrayBuffer) {
    // if (this.transcriber) {
    //   const buffer = new Uint8Array(audioData);
    //   this.transcriber.sendAudio(buffer);
    // } else {
    //   console.warn('Attempted to send audio, but transcriber is not connected.');
    // }
  }

  async disconnect() {
    // if (this.transcriber) {
    //   console.log('Closing real-time transcription connection...');
    //   await this.transcriber.close();
    //   this.transcriber = null;
    // }
  }
}
