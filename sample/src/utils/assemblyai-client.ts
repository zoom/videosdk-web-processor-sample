import { RealtimeTranscriber } from 'assemblyai/streaming';

export class AssemblyAIClient {
  private realtimeTranscriber: RealtimeTranscriber = null;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getToken() {
    const response = await fetch(`http://localhost:8000/token?apiKey=${encodeURIComponent(this.apiKey)}`);
    const data = await response.json();

    if (data.error) {
      console.error(`AssemblyAI getToken error: ${data.error}`);
    }

    return data.token;
  }

  async connect(onMessage: (text: string) => void) {
    try {
      this.realtimeTranscriber = new RealtimeTranscriber({
        token: await this.getToken(),
        sampleRate: 16_000,
      });

      
      this.realtimeTranscriber.on('error', event => {
        console.error(event);
        this.realtimeTranscriber.close();
        this.realtimeTranscriber = null;
      });

      this.realtimeTranscriber.on('close', (code, reason) => {
        console.log(`Connection closed: ${code} ${reason}`);
        this.realtimeTranscriber = null;
      });

      const texts: { [key: number]: string } = {};
      const cleanupInterval = setInterval(() => {
        const now = Date.now();
        const oldKeys = Object.keys(texts).map(Number).filter(key => (now - key) > 30000);
        oldKeys.forEach(key => delete texts[key]);
      }, 30000);
      
      this.realtimeTranscriber.on('close', () => {
        clearInterval(cleanupInterval);
      });
      
      this.realtimeTranscriber.on("transcript", (message: { audio_start: number; text: string }) => {
        let msg = "";
        console.log("message:", message);
        texts[message.audio_start] = message.text;
        
        const keys = Object.keys(texts).map(Number)
          .filter(key => key > message.audio_start - 10000)
          .sort((a, b) => a - b);
          
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
