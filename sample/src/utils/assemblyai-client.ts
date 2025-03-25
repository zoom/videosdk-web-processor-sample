import { RealtimeTranscriber } from 'assemblyai/streaming';

export class AssemblyAIClient {
  private realtimeTranscriber: RealtimeTranscriber = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getToken() {
    const response = await fetch("http://localhost:8000/token");
    const data = await response.json();

    if (data.error) {
      alert(data.error);
    }

    return data.token;
  }

  async connect(onMessage: (text: string) => void) {
    try {
      this.realtimeTranscriber = new RealtimeTranscriber({
        token: await this.getToken(),
        sampleRate: 16_000,
      });

      const texts: { [key: number]: string } = {};
      this.realtimeTranscriber.on("transcript", (message: { audio_start: number; text: string }) => {
        let msg = "";
        texts[message.audio_start] = message.text;
        const keys = Object.keys(texts).map(Number);
        keys.sort((a, b) => a - b);
        for (const key of keys) {
          if (texts[key]) {
            msg += ` ${texts[key]}`;
          }
        }
        onMessage(msg);
      });
      
      await this.realtimeTranscriber.connect();
    } catch (err) {
      console.error("AssemblyAI connection error:", err);
      throw err;
    }
  }

  sendAudio(audioData: ArrayBuffer) {
    if (this.realtimeTranscriber) {
      const buffer = new Uint8Array(audioData);
      this.realtimeTranscriber.sendAudio(buffer);
    } else {
      console.warn('Attempted to send audio, but transcriber is not connected.');
    }
  }

  async disconnect() {
    if (this.realtimeTranscriber) {
      console.log('Closing real-time transcription connection...');
      await this.realtimeTranscriber.close();
      this.realtimeTranscriber = null;
    }
  }
}
