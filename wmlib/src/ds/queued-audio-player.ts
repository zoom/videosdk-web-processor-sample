export class QueuedAudioPlayer {
    private audioContext: AudioContext;
    private scriptNode: ScriptProcessorNode;
    private audioQueue: Float32Array[] = [];
    private isPlaying = false;
    private sampleRate: number;
    private channelCount: number;
  
    /**
     * @param sampleRate        The audio context sample rate (e.g. 48000).
     * @param channelCount      Number of channels (default: 1).
     */
    constructor(sampleRate: number, channelCount = 1) {
      this.sampleRate = sampleRate;
      this.channelCount = channelCount;
  
      // Create AudioContext with the specified sampleRate
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate,
      });
  
      // Use a buffer size of 4096 for a good balance of latency and stability
      this.scriptNode = this.audioContext.createScriptProcessor(
        4096,
        this.channelCount,
        this.channelCount
      );
  
      // Bind the onaudioprocess callback
      this.scriptNode.onaudioprocess = this._processAudio.bind(this);
    }
  
    /**
     * Internal method to process audio. Feeds data from the queue to the output.
     */
    private _processAudio(event: AudioProcessingEvent): void {
      const outputBuffer = event.outputBuffer;
  
      for (let ch = 0; ch < this.channelCount; ch++) {
        const outputData = outputBuffer.getChannelData(ch);
  
        if (this.audioQueue.length > 0) {
          const dataChunk = this.audioQueue.shift()!;
          // Copy at most outputData.length samples
          outputData.set(dataChunk.subarray(0, outputData.length));
        } else {
          // If we run out of data, output silence to prevent glitches
          outputData.fill(0);
        }
      }
    }
  
    /**
     * Adds a new chunk of audio data from the worklet to the queue.
     * @param audioChunk  A Float32Array containing interleaved PCM for all channels.
     */
    public addChunk(audioChunk: Float32Array): void {
      this.audioQueue.push(audioChunk);
    }
  
    /**
     * Starts playback by connecting the ScriptProcessorNode to the destination.
     */
    public start(): void {
      if (!this.isPlaying) {
        this.scriptNode.connect(this.audioContext.destination);
        this.isPlaying = true;
        console.log('QueuedAudioPlayer started.');
      }
    }
  
    /**
     * Stops playback and clears the queue.
     */
    public stop(): void {
      if (this.isPlaying) {
        this.scriptNode.disconnect();
        this.audioQueue = [];
        this.isPlaying = false;
        console.log('QueuedAudioPlayer stopped.');
      }
    }
  }