class PitchShiftProcessor extends AudioProcessor {
    pitchRatio: number;
    bufferSize: number;
    buffer: Float32Array;
    writePos: number;
    readPos: number;
    formantRatio: number;
    dryWet: number;
    hpf: {
      prevIn: number;
      prevOut: number;
      alpha: number;
    };
    
    // 新增：数据传输和缓冲管理
    outputBuffer: Float32Array;
    outputBufferSize: number;
    outputWritePos: number;
    sampleRate: number;
    isTransmitting: boolean;
    transmitInterval: number;
    lastTransmitTime: number;
    smoothingBuffer: Float32Array;
    smoothingSize: number;
    smoothingIndex: number;
    
    // 缓冲区状态管理
    samplesProcessed: number;
    minReadDelay: number;
    
    constructor(port: MessagePort, options: any) {
      super(port, options);
      
      // 原有参数 - 增大缓冲区以支持高pitch ratio
      this.bufferSize = 48000; // 1秒缓冲区，为高音调提供更多空间
      this.buffer = new Float32Array(this.bufferSize);
      this.writePos = 0;
      this.readPos = 0.0;
      this.pitchRatio = 1.0; // Tone ratio (1.0 is original sound)
      this.formantRatio = 0; // Formant ratio
      this.dryWet = 0.0; // Dry/Wet mix ratio
      
      // 高通滤波器参数 (减小alpha值减少噪音)
      this.hpf = {
        prevIn: 0,
        prevOut: 0,
        alpha: 0.95 // 更温和的高通滤波
      };
      
      // 新增：输出缓冲区管理
      this.sampleRate = 48000;
      this.outputBufferSize = Math.floor(this.sampleRate * 0.05); // 减小到50ms以减少延迟
      this.outputBuffer = new Float32Array(this.outputBufferSize);
      this.outputWritePos = 0;
      this.isTransmitting = false;
      this.transmitInterval = Math.floor(this.sampleRate * 0.01); // 减小到10ms传输间隔
      this.lastTransmitTime = 0;
      
      // 缓冲区状态管理
      this.samplesProcessed = 0;
      this.minReadDelay = Math.floor(this.sampleRate * 0.1); // 最小100ms延迟
      
      // 平滑处理缓冲区
      this.smoothingSize = 32; // 减小平滑窗口大小避免过度平滑
      this.smoothingBuffer = new Float32Array(this.smoothingSize);
      this.smoothingIndex = 0;
      
      this.port.onmessage = (event) => {
        const command = event.data.command;
        if (command === 'update-pitch-shift-config') {
          this.pitchRatio = event.data.data.pitchRatio;
          this.formantRatio = event.data.data.formantRatio;
          this.dryWet = event.data.data.dryWet;
        } else if (command === 'start-transmission' || command === 'start-preview') {
          this.isTransmitting = true;
          console.log(`[PitchShift] Started audio transmission/preview.`);
        } else if (command === 'stop-transmission' || command === 'stop-preview') {
          this.isTransmitting = false;
          console.log(`[PitchShift] Stopped audio transmission/preview.`);
        }
      };
    }
    
    // 新增：应用平滑处理，减少噪音
    applySmoothingFilter(sample: number): number {
      // 将当前样本添加到平滑缓冲区
      const bufferIndex = this.smoothingIndex % this.smoothingSize;
      this.smoothingBuffer[bufferIndex] = sample;
      this.smoothingIndex++;
      
      // 计算移动平均值（仅使用最近的几个样本）
      let sum = 0;
      let count = 0;
      const windowSize = Math.min(this.smoothingSize, this.smoothingIndex);
      const actualWindow = Math.min(8, windowSize); // 限制窗口大小为8，避免过度平滑
      
      for (let i = 0; i < actualWindow; i++) {
        const idx = (bufferIndex - i + this.smoothingSize) % this.smoothingSize;
        sum += this.smoothingBuffer[idx];
        count++;
      }
      
      return count > 0 ? sum / count : sample;
    }
    
    // 新增：数据传输到主线程（改进的传输策略）
    transmitAudioData(forceTransmit: boolean = false): void {
      if (!this.isTransmitting) return;
      
      // 根据pitch ratio动态调整传输间隔
      const adaptiveInterval = Math.max(
        Math.floor(this.sampleRate * 0.005), // 最小5ms
        Math.floor(this.transmitInterval / Math.max(1, this.pitchRatio * 0.5))
      );
      
      const currentTime = this.samplesProcessed;
      const shouldTransmit = forceTransmit || 
        (currentTime - this.lastTransmitTime >= adaptiveInterval) ||
        (this.outputWritePos >= this.outputBufferSize * 0.6); // 60%满时传输
      
      if (shouldTransmit && this.outputWritePos > 0) {
        try {
          // 创建要传输的数据副本
          const dataToTransmit = new Float32Array(this.outputWritePos);
          dataToTransmit.set(this.outputBuffer.subarray(0, this.outputWritePos));
          
          // 传输数据到主线程 - 包含pitch ratio信息
          this.port.postMessage({
            command: 'preview',
            audioData: dataToTransmit,
            sampleRate: this.sampleRate,
            timestamp: currentTime,
            bufferSize: this.outputWritePos,
            pitchRatio: this.pitchRatio // 传递pitch ratio用于主线程优化
          });
          
          // 重置输出缓冲区
          this.outputWritePos = 0;
          this.lastTransmitTime = currentTime;
        } catch (error) {
          console.error('[PitchShift] Error transmitting audio data:', error);
        }
      }
    }
    
    // 新增：音频质量检查和修复
    validateAndFixSample(sample: number): number {
      // 检查NaN和无穷大
      if (!isFinite(sample)) {
        return 0;
      }
      
      // 限制幅度范围 [-1, 1]
      return Math.max(-1, Math.min(1, sample));
    }

    process(inputs: Array<Array<Float32Array>>, outputs: Array<Array<Float32Array>>) {
      const input = inputs[0];
      const output = outputs[0];
      
      if (input.length === 0 || !input[0]) {
        return true;
      }
      
      const inputChannel = input[0];
      const outputChannel = output[0];
      const frameLength = inputChannel.length;
      
      // 检查是否为旁路模式（原声输出）
      const isBypassMode = (Math.abs(this.pitchRatio - 1.0) < 0.01) && (this.dryWet < 0.01);
      
      if (isBypassMode) {
        // 旁路模式：直接输出原始音频，无任何处理
        for (let i = 0; i < frameLength; i++) {
          const cleanSample = this.validateAndFixSample(inputChannel[i]);
          outputChannel[i] = cleanSample;
          
          // 存储到输出缓冲区用于传输
          if (this.isTransmitting && this.outputWritePos < this.outputBufferSize) {
            this.outputBuffer[this.outputWritePos] = cleanSample;
            this.outputWritePos++;
          }
        }
      } else {
        // 正常处理模式
        // 写入输入数据到环形缓冲区
        for (let i = 0; i < frameLength; i++) {
          this.buffer[this.writePos] = inputChannel[i];
          this.writePos = (this.writePos + 1) % this.bufferSize;
        }
        
        // 处理每个输出样本
        for (let i = 0; i < frameLength; i++) {
          // 确保读取指针和写入指针之间有安全距离
          const readToWriteDist = (this.writePos - this.readPos + this.bufferSize) % this.bufferSize;
          const minSafeDistance = 128; // 最小安全距离（样本数）

          if (this.pitchRatio > 1.0 && readToWriteDist < minSafeDistance) {
            // 当 pitch ratio > 1 时，读取速度快于写入
            // 如果距离太近，则将读取位置重置到写入位置后方一个安全距离
            // 这是为了防止读取到尚未写入或不完整的数据
            this.readPos = (this.writePos - minSafeDistance + this.bufferSize) % this.bufferSize;
          }

          // 计算当前读取位置
          let readPos = this.readPos % this.bufferSize;
          if (readPos < 0) readPos += this.bufferSize;
          
          // 检查是否需要等待更多数据
          const currentWritePos = this.writePos;
          const availableData = (currentWritePos - readPos + this.bufferSize) % this.bufferSize;
          
          let processedSample;
          
          if (availableData < 2) {
            // 数据不足，输出静音
            processedSample = 0;
          } else {
            // 高质量线性插值
            const intPos = Math.floor(readPos);
            const frac = readPos - intPos;
            const nextPos = (intPos + 1) % this.bufferSize;
            
            // 原始信号插值
            const raw = this.buffer[intPos] * (1 - frac) + this.buffer[nextPos] * frac;
            
            if (this.dryWet < 0.01) {
              // 完全干声：跳过滤波处理
              processedSample = raw;
            } else {
              // 应用高通滤波（仅在湿声时）
              const filtered = raw - this.hpf.prevIn + this.hpf.alpha * this.hpf.prevOut;
              this.hpf.prevIn = raw;
              this.hpf.prevOut = filtered;
              
              // 干湿混合
              processedSample = filtered * this.dryWet + raw * (1 - this.dryWet);
            }
            
            // 音频质量检查和修复
            processedSample = this.validateAndFixSample(processedSample);
            
            // 仅在需要时应用轻微平滑滤波
            if (this.dryWet > 0.01 && this.pitchRatio > 1.5) {
              processedSample = this.applySmoothingFilter(processedSample);
            }
          }
          
          // 输出到AudioWorklet
          outputChannel[i] = processedSample;
          
          // 存储到输出缓冲区用于传输
          if (this.isTransmitting && this.outputWritePos < this.outputBufferSize) {
            this.outputBuffer[this.outputWritePos] = processedSample;
            this.outputWritePos++;
          }
          
          // 更新读取位置（应用变调比率）
          this.readPos += this.pitchRatio;
          
          // 自动环绕处理
          if (this.readPos >= this.bufferSize) {
            this.readPos -= this.bufferSize;
          }
        }
      }
      
      // 更新处理样本计数
      this.samplesProcessed += frameLength;
      
      // 传输音频数据到主线程（使用改进的自适应传输策略）
      this.transmitAudioData();
      
      return true;
    }
}

registerProcessor('pitch-shift-audio-processor', PitchShiftProcessor);
  
  