/**
 * Main thread audio playback manager
 * Responsible for receiving audio data from pitch-shift-audio-processor and playing it in real-time
 */
export class PitchShiftAudioManager {
  private workletNode: AudioWorkletNode | null = null;
  private processorPort: MessagePort | null = null;
  private playbackContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  
  // data buffer management
  private audioDataQueue: Float32Array[] = [];
  private isPlaying: boolean = false;
  private sampleRate: number = 48000;
  private maxQueueSize: number = 50; // maximum buffer queue size
  
  // playback scheduling - low latency optimization
  private isBuffering: boolean = true;
  private minBufferSize: number = 1024; // further reduce buffer size, ultra-low latency
  private playbackScheduler: number | null = null;
  
  // audio quality control
  private lastValidSample: number = 0;
  private fadeInOut: boolean = false; // disable fade in/out, avoid noise in real-time stream
  
  constructor() {}

  /**
   * Initialize playback manager (no need to load processor, only create playback context)
   */
  async initialize(sampleRate: number = 48000): Promise<void> {
    try {
      this.sampleRate = sampleRate;
      
      // create low latency playback context
      this.playbackContext = new AudioContext({
        sampleRate: this.sampleRate,
        latencyHint: 'interactive' // use lowest latency mode
      });
      
      console.log('[PitchShift] Playback manager initialized');
    } catch (error) {
      console.error('[PitchShift] Failed to initialize playback manager:', error);
      throw error;
    }
  }

  /**
   * Connect to an existing AudioWorkletNode to receive audio data
   */
  connectToWorkletNode(workletNode: AudioWorkletNode): void {
    this.workletNode = workletNode;
    
    // listen to processor messages
    this.workletNode.port.onmessage = (event) => {
      this.handleProcessorMessage(event.data);
    };
    
    console.log('[PitchShift] Connected to existing worklet node');
  }

  /**
   * Handle messages from the AudioWorklet
   */
  private handleProcessorMessage(data: any): void {
    if (data.command === 'preview') {
      // handle preview playback command
      console.log('[PitchShift] Received preview command with audio data');
      this.enqueueAudioData(data.audioData, data.sampleRate, data.timestamp);
    } else if (data.type === 'processed-audio-data') {
      // handle old message format
      this.enqueueAudioData(data.audioData, data.sampleRate, data.timestamp);
    }
  }

  /**
   * Public method: handle external processor messages
   */
  public handleExternalMessage(data: any): void {
    this.handleProcessorMessage(data);
  }

  /**
   * Connect to external processor port
   */
  connectToProcessorPort(port: MessagePort): void {
    this.processorPort = port;
    
    // listen to processor messages
    this.processorPort.onmessage = (event) => {
      this.handleProcessorMessage(event.data);
    };
    
    console.log('[PitchShift] Connected to processor port');
  }

  /**
   * Add audio data to the queue
   */
  private enqueueAudioData(audioData: Float32Array, sampleRate: number, timestamp: number): void {
    try {
      // check queue size, prevent memory overflow
      if (this.audioDataQueue.length >= this.maxQueueSize) {
        console.warn('[PitchShift] Audio queue overflow, dropping oldest data');
        this.audioDataQueue.shift(); // remove oldest data
      }
      
      // validate and fix audio data
      const validatedData = this.validateAudioData(audioData);
      this.audioDataQueue.push(validatedData);
      
      // update sample rate (if needed)
      if (sampleRate && sampleRate !== this.sampleRate) {
        this.sampleRate = sampleRate;
      }
      
      // automatically start playback (if buffer is enough)
      if (!this.isPlaying && this.shouldStartPlayback()) {
        this.startPlayback();
      }
    } catch (error) {
      console.error('[PitchShift] Error enqueueing audio data:', error);
    }
  }

  /**
   * Validate and fix audio data (simplified version, reduce processing)
   */
  private validateAudioData(data: Float32Array): Float32Array {
    const validatedData = new Float32Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      let sample = data[i];
      
      // only check NaN and infinity
      if (!isFinite(sample)) {
        sample = 0; // use silence instead of invalid samples
      }
      
      // slightly limit amplitude range, avoid clipping
      sample = Math.max(-0.98, Math.min(0.98, sample));
      
      validatedData[i] = sample;
    }
    
    return validatedData;
  }

  /**
   * Check if playback should start
   */
  private shouldStartPlayback(): boolean {
    const totalSamples = this.audioDataQueue.reduce((sum, data) => sum + data.length, 0);
    return totalSamples >= this.minBufferSize;
  }

  /**
   * Start playing processed audio
   */
  async startPlayback(): Promise<void> {
    if (!this.playbackContext || this.isPlaying) {
      return;
    }

    try {
      this.isPlaying = true;
      this.isBuffering = false;
      
      console.log('[PitchShift] Starting audio playback');
      this.scheduleNextBuffer();
    } catch (error) {
      console.error('[PitchShift] Error starting playback:', error);
      this.isPlaying = false;
    }
  }

  /**
   * Schedule the next audio buffer
   */
  private scheduleNextBuffer(): void {
    if (!this.isPlaying || !this.playbackContext) {
      return;
    }

    try {
      // get audio data from the queue
      const audioData = this.dequeueAudioData();
      if (!audioData || audioData.length === 0) {
        // wait and retry if no data
        this.playbackScheduler = window.setTimeout(() => this.scheduleNextBuffer(), 10);
        return;
      }

      // create audio buffer
      const buffer = this.playbackContext.createBuffer(1, audioData.length, this.sampleRate);
      const channelData = buffer.getChannelData(0);
      channelData.set(audioData);

      // create source node
      const source = this.playbackContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.playbackContext.destination);

      // set playback end callback
      source.onended = () => {
        if (this.isPlaying) {
          this.scheduleNextBuffer();
        }
      };

      // immediately play, minimum delay
      const playTime = this.playbackContext.currentTime; // remove extra delay
      source.start(playTime);

      this.sourceNode = source;
    } catch (error) {
      console.error('[PitchShift] Error scheduling buffer:', error);
      // retry if error occurs
      this.playbackScheduler = window.setTimeout(() => this.scheduleNextBuffer(), 50);
    }
  }

  /**
   * Get audio data from the queue
   */
  private dequeueAudioData(): Float32Array | null {
    if (this.audioDataQueue.length === 0) {
      return null;
    }

    // reduce merging count to avoid delay and quality issues
    const maxCombine = Math.min(1, this.audioDataQueue.length); // don't merge, play single buffer
    const combinedLength = this.audioDataQueue.slice(0, maxCombine)
      .reduce((sum, data) => sum + data.length, 0);

    const combinedData = new Float32Array(combinedLength);
    let offset = 0;

    for (let i = 0; i < maxCombine; i++) {
      const data = this.audioDataQueue.shift();
      if (data) {
        combinedData.set(data, offset);
        offset += data.length;
      }
    }

    return combinedData;
  }

  /**
   * Stop playback
   */
  stopPlayback(): void {
    this.isPlaying = false;
    
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (error) {
        // ignore error if node is already stopped
      }
      this.sourceNode = null;
    }
    
    if (this.playbackScheduler) {
      clearTimeout(this.playbackScheduler);
      this.playbackScheduler = null;
    }
    
    // clear queue
    this.audioDataQueue = [];
    
    console.log('[PitchShift] Playback stopped');
  }

  /**
   * Start pitch shift processing and transmission
   */
  startPitchShift(): void {
    const port = this.processorPort || this.workletNode?.port;
    if (port) {
      port.postMessage({ command: 'start-transmission' });
      console.log('[PitchShift] Started pitch shift transmission');
    }
  }

  /**
   * Stop pitch shift processing and transmission
   */
  stopPitchShift(): void {
    const port = this.processorPort || this.workletNode?.port;
    if (port) {
      port.postMessage({ command: 'stop-transmission' });
    }
    this.stopPlayback();
    console.log('[PitchShift] Stopped pitch shift transmission');
  }

  /**
   * Start preview playback
   */
  startPreview(): void {
    const port = this.processorPort || this.workletNode?.port;
    if (port) {
      port.postMessage({ command: 'start-preview' });
    }
    console.log('[PitchShift] Starting preview playback');
    this.startPlayback();
  }

  /**
   * Stop preview playback
   */
  stopPreview(): void {
    const port = this.processorPort || this.workletNode?.port;
    if (port) {
      port.postMessage({ command: 'stop-preview' });
    }
    console.log('[PitchShift] Stopping preview playback');
    this.stopPlayback();
  }

  /**
   * Update pitch shift parameters
   */
  updatePitchShiftConfig(pitchRatio: number, formantRatio: number = 0, dryWet: number = 0): void {
    const port = this.processorPort || this.workletNode?.port;
    if (port) {
      port.postMessage({
        command: 'update-pitch-shift-config',
        data: {
          pitchRatio,
          formantRatio,
          dryWet
        }
      });
      console.log(`[PitchShift] Updated config: pitch=${pitchRatio}, formant=${formantRatio}, dryWet=${dryWet}`);
    }
  }

  /**
   * Get playback status
   */
  isPlaybackActive(): boolean {
    return this.isPlaying;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { queueLength: number; totalSamples: number } {
    const totalSamples = this.audioDataQueue.reduce((sum, data) => sum + data.length, 0);
    return {
      queueLength: this.audioDataQueue.length,
      totalSamples
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopPitchShift();
    
    if (this.playbackContext && this.playbackContext.state !== 'closed') {
      this.playbackContext.close();
    }
    
    this.workletNode = null;
    this.processorPort = null;
    this.playbackContext = null;
    this.audioDataQueue = [];
    
    console.log('[PitchShift] Audio manager cleaned up');
  }
} 