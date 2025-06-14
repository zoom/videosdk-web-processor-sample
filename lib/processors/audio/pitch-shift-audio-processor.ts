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

      // 缓冲区管理状态
    isBufferReady: boolean;
    minBufferFill: number;
    positionCheckCounter: number;
    
    // 延迟监控
    lastLatencyReport: number;
    processingStartTime: number;

  constructor(port: MessagePort, options: any) {
    super(port, options);

    // 原有参数
    this.bufferSize = 48000; // 1 second buffer (48kHz sampling rate) - 增大缓冲区
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;
    this.readPos = this.bufferSize / 4; // 初始读取位置设置为缓冲区的1/4，提供足够的前瞻
    this.pitchRatio = 1.8; // Tone ratio (1.0 is original sound)
    this.formantRatio = 0; // Formant ratio
    this.dryWet = 0; // Dry/Wet mix ratio

    // 高通滤波器参数 (减小alpha值减少噪音)
    this.hpf = {
      prevIn: 0,
      prevOut: 0,
      alpha: 0.95, // 更温和的高通滤波
    };

    // 新增：输出缓冲区管理
    this.sampleRate = 48000;
    this.outputBufferSize = Math.floor(this.sampleRate * 0.05); // 50ms 缓冲区，减少延迟
    this.outputBuffer = new Float32Array(this.outputBufferSize);
    this.outputWritePos = 0;
    this.isTransmitting = false;
    this.transmitInterval = Math.floor(this.sampleRate * 0.01); // 10ms 传输间隔，减少延迟
    this.lastTransmitTime = 0;

    // 平滑处理缓冲区
    this.smoothingSize = 32; // 减小平滑窗口大小避免过度平滑
    this.smoothingBuffer = new Float32Array(this.smoothingSize);
    this.smoothingIndex = 0;

    // 缓冲区管理状态
          this.isBufferReady = false;
      this.minBufferFill = this.bufferSize / 8; // 减小预热要求，减少延迟和重复音频
      this.positionCheckCounter = 0;
      
      // 延迟监控初始化
      this.lastLatencyReport = 0;
      this.processingStartTime = 0;

    this.port.onmessage = (event) => {
      const command = event.data.command;
      if (command === "update-pitch-shift-config") {
        const oldPitchRatio = this.pitchRatio;
        this.pitchRatio = event.data.data.pitchRatio;
        this.formantRatio = event.data.data.formantRatio;
        this.dryWet = event.data.data.dryWet;

        console.log(
          `[PitchShift] Config updated: pitch ${oldPitchRatio} → ${this.pitchRatio}, formant: ${this.formantRatio}, dryWet: ${this.dryWet}`
        );

        // 检查是否跨越了pitch > 1的边界
        const wasAboveOne = oldPitchRatio > 1.0;
        const isAboveOne = this.pitchRatio > 1.0;

        if (wasAboveOne !== isAboveOne) {
          console.log(
            `[PitchShift] Pitch boundary crossed (${
              wasAboveOne ? ">1" : "<=1"
            } → ${isAboveOne ? ">1" : "<=1"}), adjusting strategy`
          );
          this.resetBufferPositions();
        } else {
          // 参数变化时只重置检查计数器
          this.positionCheckCounter = 0;
        }
      } else if (command === "start-transmission") {
        this.isTransmitting = true;
        this.outputWritePos = 0;
        this.lastTransmitTime = 0;
        this.resetBufferPositions(); // 开始时重置位置
        console.log(
          "[PitchShift] Started audio transmission - AudioWorklet will be muted, only main thread playback"
        );
      } else if (command === "stop-transmission") {
        this.isTransmitting = false;
        console.log(
          "[PitchShift] Stopped audio transmission - AudioWorklet direct output resumed"
        );
      } else if (command === "start-preview") {
        // 开始预览播放
        this.isTransmitting = true;
        this.resetBufferPositions(); // 开始预览时重置位置
        console.log(
          "[PitchShift] Preview playback started - AudioWorklet muted, main thread active"
        );
      } else if (command === "stop-preview") {
        // 停止预览播放
        this.isTransmitting = false;
        console.log(
          "[PitchShift] Preview playback stopped - AudioWorklet direct output resumed"
        );
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

  // 新增：数据传输到主线程
  transmitAudioData(forceTransmit: boolean = false): void {
    if (!this.isTransmitting) return;

    const currentTime = this.lastTransmitTime + 128; // 假设每次处理128个样本
    const shouldTransmit =
      forceTransmit ||
      currentTime - this.lastTransmitTime >= this.transmitInterval;

    if (shouldTransmit && this.outputWritePos > 0) {
      try {
        // 创建要传输的数据副本
        const dataToTransmit = new Float32Array(this.outputWritePos);
        dataToTransmit.set(this.outputBuffer.subarray(0, this.outputWritePos));

        // 传输数据到主线程 - 使用preview命令
        this.port.postMessage({
          command: "preview",
          audioData: dataToTransmit,
          sampleRate: this.sampleRate,
          timestamp: currentTime,
          bufferSize: this.outputWritePos,
        });

        // 重置输出缓冲区
        this.outputWritePos = 0;
        this.lastTransmitTime = currentTime;
      } catch (error) {
        console.error("[PitchShift] Error transmitting audio data:", error);
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

  // 改进：针对pitch > 1的特殊位置管理
  manageReadWritePositions(): boolean {
    // 智能检查频率：根据pitch ratio和距离动态调整
    this.positionCheckCounter++;
    let checkInterval = 48; // 默认检查间隔
    
    if (this.pitchRatio > 2.0) {
      checkInterval = 16; // 高pitch时非常频繁
    } else if (this.pitchRatio > 1.5) {
      checkInterval = 24; // 中pitch时较频繁
    } else if (this.pitchRatio > 1.2) {
      checkInterval = 32; // 稍高pitch时适度频繁
    }
    
    if (this.positionCheckCounter < checkInterval) {
      return true;
    }
    this.positionCheckCounter = 0;

    // 计算读写位置之间的距离
    let distance = this.writePos - this.readPos;
    if (distance < 0) {
      distance += this.bufferSize;
    }

    // 智能安全距离：平衡延迟和稳定性
    let baseSafeDistance = 3072; // 适中的基础安全距离

    if (this.pitchRatio > 1.0) {
      // 针对不同pitch范围的分段策略
      if (this.pitchRatio <= 1.5) {
        // 低pitch: 优先低延迟
        baseSafeDistance += (this.pitchRatio - 1.0) * 2048;
      } else if (this.pitchRatio <= 2.5) {
        // 中pitch: 平衡延迟和稳定性
        baseSafeDistance += 1024 + (this.pitchRatio - 1.5) * 3072;
      } else {
        // 高pitch: 优先稳定性
        baseSafeDistance += 4096 + (this.pitchRatio - 2.5) * 4096;
      }
    }

    const minDistance = Math.min(baseSafeDistance, this.bufferSize / 6); // 限制最大距离

    // 检查是否需要调整位置
    if (distance < minDistance) {
      console.warn(
        `[PitchShift] Position collision detected (distance: ${distance}, required: ${minDistance}, pitch: ${this.pitchRatio})`
      );

      if (this.pitchRatio > 1.0) {
        // pitch > 1时，强制调整读取位置，确保有足够的缓冲区数据
        const safeReadPos =
          (this.writePos - minDistance + this.bufferSize) % this.bufferSize;
        console.log(
          `[PitchShift] Adjusting readPos from ${this.readPos} to ${safeReadPos} for pitch ${this.pitchRatio}`
        );
        this.readPos = safeReadPos;
      } else {
        // pitch <= 1时，输出静音等待更多数据
        return false;
      }
    }

    return true; // 位置安全，继续正常处理
  }

  // 改进：针对不同pitch ratio的智能重置
  resetBufferPositions(): void {
    console.log(`[PitchShift] Smart reset for pitch ratio: ${this.pitchRatio}`);

    // 重置必要的状态
    this.positionCheckCounter = 0;

    if (this.pitchRatio > 1.0) {
      // pitch > 1时需要更谨慎的位置管理
      console.log(
        `[PitchShift] Pitch > 1.0 detected, applying safe position strategy`
      );

      // 智能安全距离策略：与位置检查逻辑保持一致
      let safeDistance = 3072;
      
      if (this.pitchRatio <= 1.5) {
        safeDistance += (this.pitchRatio - 1.0) * 2048;
      } else if (this.pitchRatio <= 2.5) {
        safeDistance += 1024 + (this.pitchRatio - 1.5) * 3072;
      } else {
        safeDistance += 4096 + (this.pitchRatio - 2.5) * 4096;
      }
      
      safeDistance = Math.min(safeDistance, this.bufferSize / 6);
      
      this.readPos =
        (this.writePos - safeDistance + this.bufferSize) % this.bufferSize;

      // 智能预热策略：高pitch需要更多预热
      this.isBufferReady = false;
      if (this.pitchRatio > 2.0) {
        this.minBufferFill = Math.min(this.bufferSize / 12, safeDistance * 0.8); // 高pitch多预热
      } else {
        this.minBufferFill = Math.min(this.bufferSize / 16, safeDistance * 0.6); // 低pitch快速启动
      }

              console.log(
          `[PitchShift] Reset positions: writePos=${this.writePos}, readPos=${this.readPos}, safeDistance=${safeDistance}, minBufferFill=${this.minBufferFill}`
        );
    } else {
      // pitch <= 1时保持当前位置，只重置状态
      console.log(`[PitchShift] Pitch <= 1.0, minimal reset`);
      if (!this.isBufferReady) {
        this.isBufferReady = false;
      }
    }

    // 重置滤波器状态
    this.hpf.prevIn = 0;
    this.hpf.prevOut = 0;

    // 重置平滑滤波器（避免参数突变）
    this.smoothingIndex = 0;
  }

  process(
    inputs: Array<Array<Float32Array>>,
    outputs: Array<Array<Float32Array>>
  ) {
    const input = inputs[0];
    const output = outputs[0];

    if (input.length === 0 || !input[0]) {
      return true;
    }

    const inputChannel = input[0];
    const outputChannel = output[0];
    const frameLength = inputChannel.length;

    // 检查是否为旁路模式（原声输出）
    const isBypassMode =
      Math.abs(this.pitchRatio - 1.0) < 0.01 && this.dryWet < 0.01;

    if (isBypassMode) {
      // 旁路模式：根据传输状态决定输出方式
      for (let i = 0; i < frameLength; i++) {
        const cleanSample = this.validateAndFixSample(inputChannel[i]);

        if (this.isTransmitting) {
          // 传输模式：只发送到主线程，AudioWorklet不直接输出
          outputChannel[i] = 0; // 静音直接输出
          if (this.outputWritePos < this.outputBufferSize) {
            this.outputBuffer[this.outputWritePos] = cleanSample;
            this.outputWritePos++;
          }
        } else {
          // 非传输模式：直接通过AudioWorklet输出
          outputChannel[i] = cleanSample;
        }
      }
    } else {
      // 正常处理模式
      // 先写入输入数据到环形缓冲区
      for (let i = 0; i < frameLength; i++) {
        this.buffer[this.writePos] = inputChannel[i];
        this.writePos = (this.writePos + 1) % this.bufferSize;
      }

      // 检查缓冲区是否准备就绪
      if (!this.isBufferReady) {
        const filled =
          this.writePos >= this.minBufferFill
            ? this.writePos
            : this.writePos + this.bufferSize;
        if (filled >= this.minBufferFill) {
          this.isBufferReady = true;
          console.log(
            `[PitchShift] Buffer ready (filled: ${filled}/${this.bufferSize}, pitch: ${this.pitchRatio})`
          );
        } else {
          // 缓冲区未准备好，输出静音
          outputChannel.fill(0);
          return true;
        }
      }

      // 检查读写位置（减少频率）
      const positionOk = this.manageReadWritePositions();

      // 处理每个输出样本
      for (let i = 0; i < frameLength; i++) {
        let processedSample = 0;

        if (positionOk || this.positionCheckCounter > 0) {
          // 位置正常或刚检查过，进行正常处理
          let readPos = this.readPos % this.bufferSize;
          if (readPos < 0) readPos += this.bufferSize;

          // 线性插值
          const intPos = Math.floor(readPos);
          const frac = readPos - intPos;
          const nextPos = (intPos + 1) % this.bufferSize;

          // 安全读取
          const sampleA = this.buffer[intPos] || 0;
          const sampleB = this.buffer[nextPos] || 0;
          const raw = sampleA * (1 - frac) + sampleB * frac;

          if (this.dryWet < 0.01) {
            processedSample = raw;
          } else {
            const filtered =
              raw - this.hpf.prevIn + this.hpf.alpha * this.hpf.prevOut;
            this.hpf.prevIn = raw;
            this.hpf.prevOut = filtered;
            processedSample = filtered * this.dryWet + raw * (1 - this.dryWet);
          }

          // 智能步进控制：平衡速度和稳定性
          let actualStep = this.pitchRatio;

          if (this.pitchRatio > 1.0) {
            // 计算当前距离
            const currentDistance = (this.writePos - this.readPos + this.bufferSize) % this.bufferSize;
            
            // 动态步进调整：距离越小，步进越保守
            if (this.pitchRatio > 1.8) {
              // 高pitch时的保守策略
              if (currentDistance < this.bufferSize * 0.2) {
                // 距离很小时，采用非常保守的步进
                actualStep = this.pitchRatio * 0.8;
              } else if (currentDistance < this.bufferSize * 0.3) {
                // 距离较小时，适度保守
                actualStep = this.pitchRatio * 0.9;
              }
              // 距离足够时，使用正常步进
            }
            
            // 防止重复读取的基本检查
            const nextReadPos = this.readPos + actualStep;
            const currentIntPos = Math.floor(this.readPos);
            const nextIntPos = Math.floor(nextReadPos % this.bufferSize);

            if (nextIntPos === currentIntPos) {
              actualStep = Math.ceil(this.readPos) - this.readPos + 0.1;
            }
          } else {
            // pitch <= 1时保持原有逻辑
            actualStep = Math.max(actualStep, 0.1); // 确保最小步进
          }

          this.readPos += actualStep;

          // 环绕处理
          if (this.readPos >= this.bufferSize) {
            this.readPos -= this.bufferSize;
          }
          if (this.readPos < 0) {
            this.readPos += this.bufferSize;
          }
        } else {
          // 位置有问题，输出静音避免噪音
          processedSample = 0;
        }

        // 质量检查和平滑
        processedSample = this.validateAndFixSample(processedSample);
        if (this.dryWet > 0.01 && processedSample !== 0) {
          processedSample = this.applySmoothingFilter(processedSample);
        }

        // 根据传输状态决定输出方式，避免双重播放
        if (this.isTransmitting) {
          // 传输模式：只发送到主线程播放
          outputChannel[i] = 0; // AudioWorklet静音输出
          if (this.outputWritePos < this.outputBufferSize) {
            this.outputBuffer[this.outputWritePos] = processedSample;
            this.outputWritePos++;
          }
        } else {
          // 非传输模式：直接通过AudioWorklet输出
          outputChannel[i] = processedSample;
        }
      }
    }

          // 延迟监控（每秒报告一次）
      const currentTime = Date.now();
      if (currentTime - this.lastLatencyReport > 1000) {
        const bufferLatency = (this.outputWritePos / this.sampleRate) * 1000; // ms
        const distance = (this.writePos - this.readPos + this.bufferSize) % this.bufferSize;
        const ringBufferLatency = (distance / this.sampleRate) * 1000; // ms
        
        // 计算当前的安全距离（用于诊断）
        let currentSafeDistance = 3072;
        if (this.pitchRatio <= 1.5) {
          currentSafeDistance += (this.pitchRatio - 1.0) * 2048;
        } else if (this.pitchRatio <= 2.5) {
          currentSafeDistance += 1024 + (this.pitchRatio - 1.5) * 3072;
        } else {
          currentSafeDistance += 4096 + (this.pitchRatio - 2.5) * 4096;
        }
        const safeDistanceMs = (currentSafeDistance / this.sampleRate) * 1000;
        
        console.log(`[PitchShift] Latency Report - Pitch: ${this.pitchRatio.toFixed(1)}, Output: ${bufferLatency.toFixed(1)}ms, Ring: ${ringBufferLatency.toFixed(1)}ms, Safe: ${safeDistanceMs.toFixed(1)}ms`);
        this.lastLatencyReport = currentTime;
      }
      
      // 传输音频数据到主线程
      this.transmitAudioData();
      
      // 更积极的传输策略，减少延迟
      if (this.outputWritePos >= this.outputBufferSize * 0.4) { // 40%时就传输
        this.transmitAudioData(true);
      }

    return true;
  }
}

registerProcessor("pitch-shift-audio-processor", PitchShiftProcessor);
