import { AssemblyAIClient } from "./assemblyai-client";

let assemblyClient: AssemblyAIClient | null = null;

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent) => {
  const { cmd, data } = event.data;

  switch (cmd) {
    case "init":
      if (data.apiKey) {
        try {
          assemblyClient = new AssemblyAIClient(data.apiKey);
          await assemblyClient.connect((text: string) => {
            // Send transcription results back to the main thread
            self.postMessage({
              cmd: "transcription_result",
              text,
            });
          });

          self.postMessage({ cmd: "initialized" });
        } catch (err: any) {
          self.postMessage({
            cmd: "error",
            error: err.message || "Failed to initialize transcription service",
          });
        }
      }
      break;

    case "process_audio":
      if (assemblyClient) {
        const timestamp = event.data.timestamp;
        if (timestamp) {
          console.log(`Processing audio chunk with timestamp: ${timestamp}`);
        }
        
        try {
          assemblyClient.sendAudio(data);
        } catch (err) {
          console.error("Error sending audio data:", err);
          self.postMessage({
            cmd: "error",
            error: "Failed to process audio data"
          });
        }
      }
      break;

    case "stop":
      if (assemblyClient) {
        try {
          await assemblyClient.disconnect();
          assemblyClient = null;
          self.postMessage({ cmd: "stopped" });
        } catch (err: any) {
          self.postMessage({
            cmd: "error",
            error: err.message || "Error stopping transcription service",
          });
        }
      }
      break;
  }
};

// Let the main thread know the worker is ready
self.postMessage({ cmd: "worker_ready" });
