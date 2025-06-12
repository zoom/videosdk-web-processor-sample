/**
 * 主线程音频播放管理器
 * 专门负责接收来自pitch-shift-audio-processor的音频数据并进行实时播放
 */
export class PitchShiftAudioManager {
  private workletNode: AudioWorkletNode | null = null;
  private processorPort: MessagePort | null = null;
  private playbackContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  
  // 数据缓冲管理
  private audioDataQueue: Float32Array[] = [];
  private isPlaying: boolean = false;
  private sampleRate: number = 48000;
  private maxQueueSize: number = 25; // 合理的队列上限，控制延迟
  
  // 播放调度
  private isBuffering: boolean = true;
  private minBufferSize: number = 2048; // 减小最小缓冲大小以减少延迟
  private playbackScheduler: number | null = null;
  private nextPlayTime: number = 0; // 用于无缝播放调度
  
  // 音频质量控制
  private lastValidSample: number = 0;
  private fadeInOut: boolean = false; // 禁用淡入淡出，避免实时流的噪音
  
  // 自适应延迟控制
  private targetQueueLength: number = 3; // 目标队列长度
  private lastPitchRatio: number = 1.0;
  
  constructor() {}

  /**
   * 初始化播放管理器（不需要加载processor，只创建播放上下文）
   */
  async initialize(sampleRate: number = 48000): Promise<void> {
    try {
      this.sampleRate = sampleRate;
      
      // 创建独立的播放上下文
      this.playbackContext = new AudioContext({
        sampleRate: this.sampleRate,
        latencyHint: 'playback'
      });
      
      console.log('[PitchShift] Playback manager initialized');
    } catch (error) {
      console.error('[PitchShift] Failed to initialize playback manager:', error);
      throw error;
    }
  }

  /**
   * 连接到已存在的AudioWorkletNode来接收音频数据
   */
  connectToWorkletNode(workletNode: AudioWorkletNode): void {
    this.workletNode = workletNode;
    
    // 监听处理器消息
    this.workletNode.port.onmessage = (event) => {
      this.handleProcessorMessage(event.data);
    };
    
    console.log('[PitchShift] Connected to existing worklet node');
  }

  /**
   * 处理从AudioWorklet传来的消息
   */
  private handleProcessorMessage(data: any): void {
    if (data.command === 'preview') {
      // 更新pitch ratio信息
      if (data.pitchRatio !== undefined) {
        this.lastPitchRatio = data.pitchRatio;
        // 根据pitch ratio调整目标队列长度
        this.updateTargetQueueLength(data.pitchRatio);
      }
      
      // 处理预览播放命令
      this.enqueueAudioData(data.audioData, data.sampleRate, data.timestamp);
    } else if (data.type === 'processed-audio-data') {
      // 兼容旧的消息格式
      this.enqueueAudioData(data.audioData, data.sampleRate, data.timestamp);
    }
  }

  /**
   * 公开方法：处理外部传入的处理器消息
   */
  public handleExternalMessage(data: any): void {
    this.handleProcessorMessage(data);
  }

  /**
   * 连接到外部处理器端口
   */
  connectToProcessorPort(port: MessagePort): void {
    this.processorPort = port;
    
    // 监听处理器消息
    this.processorPort.onmessage = (event) => {
      this.handleProcessorMessage(event.data);
    };
    
    console.log('[PitchShift] Connected to processor port');
  }

  /**
   * 根据pitch ratio更新目标队列长度
   */
  private updateTargetQueueLength(pitchRatio: number): void {
    // 高pitch ratio需要更少的缓冲以减少延迟
    if (pitchRatio >= 2.0) {
      this.targetQueueLength = 2;
    } else if (pitchRatio >= 1.5) {
      this.targetQueueLength = 3;
    } else if (pitchRatio <= 0.5) {
      this.targetQueueLength = 6; // 低pitch ratio需要更多缓冲
    } else {
      this.targetQueueLength = 4;
    }
  }

  /**
   * 将音频数据加入队列
   */
  private enqueueAudioData(audioData: Float32Array, sampleRate: number, timestamp: number): void {
    try {
      // 检查队列大小，如果超过上限则丢弃最旧的数据以控制延迟
      if (this.audioDataQueue.length >= this.maxQueueSize) {
        console.warn(`[PitchShift] Audio queue is full (size: ${this.audioDataQueue.length}). Dropping oldest buffer to reduce latency.`);
        this.audioDataQueue.shift(); 
      }
      
      // 验证和修复音频数据
      const validatedData = this.validateAudioData(audioData);
      this.audioDataQueue.push(validatedData);
      
      // 更新采样率（如果需要）
      if (sampleRate && sampleRate !== this.sampleRate) {
        this.sampleRate = sampleRate;
      }
      
      // 自动开始播放（如果缓冲足够）
      if (!this.isPlaying && this.shouldStartPlayback()) {
        this.startPlayback();
      }
    } catch (error) {
      console.error('[PitchShift] Error enqueueing audio data:', error);
    }
  }

  /**
   * 验证和修复音频数据（简化版本，减少处理）
   */
  private validateAudioData(data: Float32Array): Float32Array {
    const validatedData = new Float32Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      let sample = data[i];
      
      // 仅检查NaN和无穷大
      if (!isFinite(sample)) {
        sample = 0; // 使用静音替代无效样本
      }
      
      // 轻微限制幅度范围，避免削波
      sample = Math.max(-0.98, Math.min(0.98, sample));
      
      validatedData[i] = sample;
    }
    
    return validatedData;
  }

  /**
   * 判断是否应该开始播放
   */
  private shouldStartPlayback(): boolean {
    const totalSamples = this.audioDataQueue.reduce((sum, data) => sum + data.length, 0);
    return totalSamples >= this.minBufferSize;
  }

  /**
   * 开始播放处理后的音频
   */
  async startPlayback(): Promise<void> {
    if (!this.playbackContext || this.isPlaying) {
      return;
    }

    try {
      this.isPlaying = true;
      this.isBuffering = false;
      this.nextPlayTime = this.playbackContext.currentTime; // 初始化播放时间
      
      console.log('[PitchShift] Starting audio playback');
      this.scheduleNextBuffer();
    } catch (error) {
      console.error('[PitchShift] Error starting playback:', error);
      this.isPlaying = false;
    }
  }

  /**
   * 调度下一个音频缓冲区
   */
  private scheduleNextBuffer(): void {
    if (!this.isPlaying || !this.playbackContext) {
      return;
    }

    try {
      // 从队列中获取音频数据
      const audioData = this.dequeueAudioData();
      if (!audioData || audioData.length === 0) {
        // 没有数据时等待并重试
        this.playbackScheduler = window.setTimeout(() => this.scheduleNextBuffer(), 10);
        return;
      }

      // 创建音频缓冲区
      const buffer = this.playbackContext.createBuffer(1, audioData.length, this.sampleRate);
      const channelData = buffer.getChannelData(0);
      channelData.set(audioData);

      // 创建源节点
      const source = this.playbackContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.playbackContext.destination);

      // 设置播放结束回调
      source.onended = () => {
        if (this.isPlaying) {
          this.scheduleNextBuffer();
        }
      };

      // 使用精确的调度时间来无缝播放
      const playTime = Math.max(this.playbackContext.currentTime, this.nextPlayTime);
      source.start(playTime);
      this.nextPlayTime = playTime + buffer.duration; // 更新下一个播放时间

      this.sourceNode = source;
    } catch (error) {
      console.error('[PitchShift] Error scheduling buffer:', error);
      // 发生错误时重试
      this.playbackScheduler = window.setTimeout(() => this.scheduleNextBuffer(), 50);
    }
  }

  /**
   * 从队列中获取音频数据
   */
  private dequeueAudioData(): Float32Array | null {
    if (this.audioDataQueue.length === 0) {
      return null;
    }
    // 一次只处理一个缓冲区，确保稳定性
    return this.audioDataQueue.shift() || null;
  }

  /**
   * 停止播放
   */
  stopPlayback(): void {
    this.isPlaying = false;
    
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (error) {
        // 忽略已经停止的节点错误
      }
      this.sourceNode = null;
    }
    
    if (this.playbackScheduler) {
      clearTimeout(this.playbackScheduler);
      this.playbackScheduler = null;
    }
    
    // 清空队列
    this.audioDataQueue = [];
    
    console.log('[PitchShift] Playback stopped');
  }

  /**
   * 开始变调处理和传输
   */
  startPitchShift(): void {
    const port = this.processorPort || this.workletNode?.port;
    if (port) {
      port.postMessage({ command: 'start-transmission' });
      console.log('[PitchShift] Started pitch shift transmission');
    }
  }

  /**
   * 停止变调处理和传输
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
   * 开始预览播放
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
   * 停止预览播放
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
   * 更新变调参数
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
   * 获取播放状态
   */
  isPlaybackActive(): boolean {
    return this.isPlaying;
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { queueLength: number; totalSamples: number } {
    const totalSamples = this.audioDataQueue.reduce((sum, data) => sum + data.length, 0);
    return {
      queueLength: this.audioDataQueue.length,
      totalSamples
    };
  }

  /**
   * 清理资源
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