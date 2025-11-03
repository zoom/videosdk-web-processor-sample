# MediaRecorder vs WebCodecs 方案对比

## 📋 什么是MediaRecorder？

**MediaRecorder API** 是浏览器提供的原生录制API，可以直接从`MediaStream`录制音视频。

### 基本用法

```typescript
// 1. 获取MediaStream（从摄像头、屏幕、或Canvas）
const stream = canvas.captureStream(30); // 或 getUserMedia()

// 2. 创建MediaRecorder
const recorder = new MediaRecorder(stream, {
  mimeType: 'video/webm;codecs=vp8',
  videoBitsPerSecond: 2_000_000, // 2 Mbps
});

// 3. 监听数据事件
recorder.ondataavailable = (event) => {
  const chunk = event.data; // Blob
  // 处理chunk：上传/保存/播放
};

// 4. 开始录制（100ms一个chunk）
recorder.start(100); // timeslice

// 5. 停止录制
recorder.stop();
```

### 关键特点

✅ **简单易用** - 几行代码即可录制  
✅ **浏览器原生** - 无需外部依赖  
✅ **自动编码** - 不需要手动调用VideoEncoder  
✅ **自动封装** - 直接输出WebM/MP4  
✅ **实时chunk** - 支持timeslice实时输出  

❌ **主线程Only** - 无法在Worker中使用  
❌ **控制有限** - 无法精确控制每一帧  
❌ **黑盒操作** - 无法访问中间编码数据  

---

## 🏗️ 当前方案（WebCodecs + MediaBunny）

### 架构图

```
┌─────────────────────────────────────────────────┐
│                WORKER THREAD                    │
│                                                 │
│  VideoFrame → VideoEncoder → EncodedChunk      │
│                                  ↓              │
│                          MediaBunny Muxer      │
│                                  ↓              │
│                          WebM Segment          │
│                                  ↓              │
│                    postMessage (transfer)      │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│              MAIN THREAD                        │
│                                                 │
│  Segment → Upload + Play + Store               │
└─────────────────────────────────────────────────┘
```

### 核心代码

```typescript
// Worker端 - lib/processors/video/VideoLocalRecordingRealtime.ts

// 1. 初始化VideoEncoder
this.videoEncoder = new VideoEncoder({
  output: async (chunk, metadata) => {
    // 手动处理每个编码帧
    await this.videoSource.add(chunk, metadata);
  },
  error: (error) => { ... }
});

// 2. 配置编码器
this.videoEncoder.configure({
  codec: 'vp8',
  width: 1280,
  height: 720,
  bitrate: 2_000_000,
  framerate: 30,
});

// 3. 编码VideoFrame
processFrame(input: VideoFrame, output: OffscreenCanvas) {
  this.videoEncoder.encode(clonedFrame, { keyFrame });
}

// 4. 使用MediaBunny封装成WebM
this.output = new Output({
  format: new WebMOutputFormat(),
  target: this.outputTarget,
});
await this.output.start();

// 5. 创建segment
await this.output.finalize();
const buffer = this.outputTarget.buffer;
this.port.postMessage({ type: 'segment', segment: buffer }, [buffer]);
```

### 优势

✅ **Worker支持** - 编码在Worker线程，不阻塞UI  
✅ **精确控制** - 可以控制每一帧的编码参数  
✅ **灵活分段** - 精确控制segment边界（keyframe对齐）  
✅ **性能更好** - Worker并行处理，主线程无负担  
✅ **内存可控** - 可以精确管理buffer  

⚠️ **复杂度高** - 需要手动处理编码、封装  
⚠️ **依赖外部库** - 需要MediaBunny做muxing  

---

## 🔄 如果使用MediaRecorder的方案

### 架构图

```
┌─────────────────────────────────────────────────┐
│                WORKER THREAD                    │
│                                                 │
│  VideoFrame → ImageBitmap                      │
│                    ↓                            │
│           postMessage (transfer)               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│              MAIN THREAD                        │
│                                                 │
│  ImageBitmap → Canvas → MediaStream            │
│                           ↓                     │
│                    MediaRecorder               │
│                           ↓                     │
│                      Chunks (Blob)             │
│                           ↓                     │
│              Upload + Play + Store             │
└─────────────────────────────────────────────────┘
```

### 实现代码

```typescript
// Worker端 - 简化版
class VideoStreamingProcessor extends VideoProcessor {
  async processFrame(input: VideoFrame, output: OffscreenCanvas) {
    // 创建ImageBitmap
    const bitmap = await createImageBitmap(input);
    
    // 发送到主线程
    this.port.postMessage({
      type: 'frame',
      bitmap: bitmap
    }, [bitmap]); // 零拷贝
  }
}

// Main Thread端 - 使用MediaRecorder
class MainThreadRecorder {
  setup() {
    // 创建Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    
    // 获取Stream
    const stream = canvas.captureStream(30);
    
    // 创建MediaRecorder
    this.recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp8',
      videoBitsPerSecond: 2_000_000,
    });
    
    // 处理chunks
    this.recorder.ondataavailable = (event) => {
      const chunk = event.data;
      this.uploadChunk(chunk);  // 上传
      this.playChunk(chunk);    // 播放
    };
    
    // 开始录制（1秒一个chunk）
    this.recorder.start(1000);
  }
  
  // 接收Worker的帧
  onFrame(bitmap: ImageBitmap) {
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
  }
}
```

### 这个方案的优缺点

✅ **代码简单** - 不需要手动编码和封装  
✅ **无需MediaBunny** - MediaRecorder自动封装WebM  
✅ **浏览器兼容好** - 更多浏览器支持  

❌ **主线程负担** - 编码在主线程，可能阻塞UI  
❌ **控制受限** - 无法精确控制keyframe位置  
❌ **分段不精确** - timeslice不保证keyframe对齐  
❌ **性能较差** - Canvas绘制 + MediaRecorder编码都在主线程  

---

## 📊 详细对比表

| 特性 | 当前方案（WebCodecs） | MediaRecorder方案 |
|------|---------------------|-------------------|
| **运行线程** | Worker | Main Thread |
| **UI阻塞** | ✅ 无阻塞 | ⚠️ 可能阻塞 |
| **编码控制** | ✅ 完全控制 | ❌ 黑盒 |
| **Keyframe控制** | ✅ 精确控制 | ❌ 无法控制 |
| **Segment对齐** | ✅ Keyframe对齐 | ❌ 时间对齐（不可靠） |
| **代码复杂度** | ⚠️ 复杂 | ✅ 简单 |
| **外部依赖** | ⚠️ MediaBunny | ✅ 无 |
| **性能** | ✅ 优秀 | ⚠️ 一般 |
| **内存控制** | ✅ 精确 | ⚠️ 有限 |
| **浏览器支持** | ⚠️ Chrome/Edge | ✅ 广泛 |
| **Segment质量** | ✅ 独立可播 | ⚠️ 可能有问题 |

---

## 🎯 MediaRecorder在当前方案中的作用

### 1. **作为降级方案（Fallback）**

```typescript
async startRecording() {
  // 检查WebCodecs支持
  if (typeof VideoEncoder === 'undefined') {
    console.warn('WebCodecs not supported, using MediaRecorder fallback');
    return this.startMediaRecorderMode();
  }
  
  // 使用WebCodecs（当前方案）
  return this.startWebCodecsMode();
}
```

**使用场景：**
- 旧版浏览器不支持WebCodecs
- Firefox等浏览器（WebCodecs支持有限）
- 需要更广泛的浏览器兼容性

### 2. **简化原型开发**

```typescript
// 快速原型 - 使用MediaRecorder
class QuickPrototype {
  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      this.uploadChunk(e.data);
    };
    recorder.start(1000);
  }
}

// 然后再优化为WebCodecs方案
```

### 3. **屏幕录制场景**

```typescript
// 屏幕录制特别适合MediaRecorder
async startScreenRecording() {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { mediaSource: 'screen' }
  });
  
  // MediaRecorder可以直接录制屏幕流
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 5_000_000,
  });
  
  recorder.start(1000);
}
```

**为什么适合？**
- 屏幕内容变化较少，适合编码
- 不需要逐帧处理
- MediaRecorder直接接收displayMedia stream

### 4. **混合方案：WebCodecs + MediaRecorder**

```typescript
class HybridRecorder {
  async startRecording(source: 'camera' | 'screen') {
    if (source === 'camera') {
      // 摄像头：使用WebCodecs（更好的控制）
      return this.startWebCodecsRecording();
    } else {
      // 屏幕：使用MediaRecorder（更简单）
      return this.startMediaRecorderRecording();
    }
  }
}
```

---

## 🔍 实际使用建议

### 当前方案（WebCodecs）适合：

✅ **高质量会议录制**
- 需要精确控制编码参数
- 需要可靠的segment分段
- 对性能要求高

✅ **实时流媒体**
- 需要Worker处理减少主线程负担
- 需要精确的keyframe对齐
- 需要segment独立可播放

✅ **大规模部署**
- Chrome/Edge为主要目标浏览器
- 对录制质量有高要求
- 需要复杂的后处理流程

### MediaRecorder方案适合：

✅ **快速原型**
- 需要快速验证想法
- 代码简洁优先
- 不需要精确控制

✅ **屏幕录制**
- 录制屏幕内容
- 简单的教程录制
- 不需要复杂处理

✅ **浏览器兼容优先**
- 需要支持Firefox/Safari
- 对WebCodecs支持不确定
- 降级方案

✅ **短视频录制**
- < 5分钟的短视频
- 不需要分段
- 简单上传即可

---

## 💡 在当前架构中整合MediaRecorder

### 方案A：作为降级选项

```typescript
// RealtimeVideoRecorder.ts 已经实现了这个

class RealtimeVideoRecorder {
  // WebCodecs主方案
  async startChunkRecording(config) {
    // 当前的Worker + WebCodecs方案
  }
  
  // MediaRecorder降级方案
  async startMediaRecorder(config) {
    // 如果WebCodecs不可用，使用这个
    this.canvas = document.createElement('canvas');
    this.stream = this.canvas.captureStream(30);
    this.recorder = new MediaRecorder(this.stream, {...});
    this.recorder.start(1000);
  }
}

// 使用时自动选择
async startRecording() {
  if (typeof VideoEncoder !== 'undefined') {
    await recorder.startChunkRecording(config);
  } else {
    await recorder.startMediaRecorder(config);
  }
}
```

### 方案B：双轨录制（备份）

```typescript
// 同时使用两种方案
class DualRecorder {
  async startRecording() {
    // 主方案：WebCodecs（高质量）
    this.startWebCodecsRecording();
    
    // 备份方案：MediaRecorder（保险）
    if (this.enableBackup) {
      this.startMediaRecorderBackup();
    }
  }
}

// 如果WebCodecs出现问题，至少有MediaRecorder的备份
```

### 方案C：场景自适应

```typescript
class AdaptiveRecorder {
  async startRecording(scenario: string) {
    switch(scenario) {
      case 'high-quality-meeting':
        // 使用WebCodecs
        return this.startWebCodecsRecording();
        
      case 'quick-screen-record':
        // 使用MediaRecorder
        return this.startMediaRecorderRecording();
        
      case 'legacy-browser':
        // 降级到MediaRecorder
        return this.startMediaRecorderRecording();
    }
  }
}
```

---

## 🎬 总结

### MediaRecorder的定位

在您当前的架构中，**MediaRecorder应该作为：**

1. ✅ **降级方案** - 当WebCodecs不可用时使用
2. ✅ **快速原型** - 开发初期验证想法
3. ✅ **特殊场景** - 屏幕录制等简单场景
4. ⚠️ **不应替代** - WebCodecs方案更适合您的需求

### 推荐策略

```typescript
// 优先级顺序
1. WebCodecs + MediaBunny (当前方案) - 生产环境主方案
   ↓ 如果不支持
2. MediaRecorder (降级方案) - 兼容性保证
   ↓ 如果都不支持
3. 提示用户升级浏览器
```

### 代码示例

```typescript
export class SmartRecorder {
  async start() {
    // 1. 尝试WebCodecs（最优）
    if (this.isWebCodecsSupported()) {
      console.log('✅ Using WebCodecs (best quality)');
      return this.startWebCodecsRecording();
    }
    
    // 2. 降级到MediaRecorder
    if (this.isMediaRecorderSupported()) {
      console.warn('⚠️ Using MediaRecorder (fallback)');
      return this.startMediaRecorderRecording();
    }
    
    // 3. 不支持
    throw new Error('❌ Recording not supported in this browser');
  }
  
  isWebCodecsSupported() {
    return typeof VideoEncoder !== 'undefined';
  }
  
  isMediaRecorderSupported() {
    return typeof MediaRecorder !== 'undefined';
  }
}
```

---

**结论：** MediaRecorder是一个很好的补充和降级方案，但对于您的**实时录制+分段+上传**需求，**WebCodecs方案更优**。MediaRecorder应该保留作为兼容性保障。🎯

---

**最后更新：** 2025年11月3日  
**推荐方案：** WebCodecs (主) + MediaRecorder (降级)

