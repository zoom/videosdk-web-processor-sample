# Video Local Recording Processor

## 📹 概述

Video Local Recording 是一个基于 WebCodecs API 的视频本地录制处理器，可以在浏览器中实时录制视频流，并将其编码为 WebM 格式。该处理器完全在客户端运行，不需要服务器端支持。

## ✨ 特性

- ✅ **实时视频编码**：使用 VideoEncoder API 进行硬件加速编码
- ✅ **多种编码格式**：支持 VP8 和 VP9 编码器
- ✅ **可配置参数**：分辨率、帧率、码率完全可定制
- ✅ **WebM 容器**：使用 webm-muxer 封装为标准 WebM 文件
- ✅ **透传模式**：录制时不影响视频流的正常显示
- ✅ **内存优化**：队列管理防止内存溢出
- ✅ **完整元数据**：包含帧数、时长、码率等详细信息

## 🎯 技术架构

```
┌─────────────────────────────────────────────┐
│ 主线程 (Main Thread)                         │
│  ├─ React UI 组件                            │
│  ├─ 控制录制开始/停止                        │
│  └─ 接收并处理编码后的视频                  │
└─────────────────────────────────────────────┘
                    ↕ MessagePort
┌─────────────────────────────────────────────┐
│ Worker 线程 (VideoProcessor)                 │
│  ├─ processFrame() 收集 VideoFrame          │
│  ├─ VideoEncoder 编码为 VP8/VP9             │
│  ├─ Muxer 封装为 WebM 容器                   │
│  └─ 发送完整视频文件回主线程                │
└─────────────────────────────────────────────┘
```

## 📦 已实现的文件

### 1. 核心处理器
- **`lib/processors/video/VideoLocalRecording.ts`**
  - VideoProcessor 的实现
  - 使用 WebCodecs API 进行视频编码
  - 使用 webm-muxer 封装 WebM 容器
  - 完整的错误处理和状态管理

### 2. UI 组件
- **`sample/src/components/parameters/VideoLocalRecording.tsx`**
  - React 用户界面组件
  - 录制控制（开始/停止）
  - 视频预览和播放
  - 参数配置界面
  - 下载和上传功能

### 3. 配置文件
- **`sample/src/config/processor/video.ts`**
  - 处理器配置注册
  - 使用文档和示例代码

## 🚀 使用方法

### 1. 构建处理器

在 `lib` 目录下构建处理器：

```bash
cd lib
npm install webm-muxer  # 如果还没安装
npm run build
```

这会生成 `lib/dist/video-local-recording.js` 文件。

### 2. 复制到 public 目录

```bash
cp lib/dist/video-local-recording.js sample/public/
```

### 3. 在应用中使用

```typescript
import { Stream, Processor } from '@zoom/videosdk';

// 创建处理器
const processor: Processor = stream.createProcessor({
  url: '/video-local-recording.js',
  name: 'video-local-recording',
  type: 'video',
  options: {},
});

// 添加到视频流
await stream.addProcessor(processor);

// 开始录制
processor.port.postMessage({
  command: 'start',
  config: {
    width: 1280,
    height: 720,
    framerate: 30,
    bitrate: 2_000_000, // 2 Mbps
    codec: 'vp8',
    maxDuration: 300, // 5 minutes
  },
});

// 停止录制
processor.port.postMessage({
  command: 'stop',
});

// 监听录制完成事件
processor.port.onmessage = (event) => {
  if (event.data.type === 'encoding') {
    const videoBuffer = event.data.buffer;
    const metadata = event.data.metadata;
    
    // 创建下载链接
    const blob = new Blob([videoBuffer], { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    // ... 处理视频
  }
};
```

## ⚙️ 配置选项

### 分辨率选项
- **480p**: 854x480 (小文件，适合移动设备)
- **720p**: 1280x720 (推荐，平衡质量和文件大小)
- **1080p**: 1920x1080 (高质量，文件较大)

### 帧率选项
- **15 fps**: 最小帧率，适合静态内容
- **24 fps**: 电影标准帧率
- **30 fps**: 推荐，标准视频帧率
- **60 fps**: 高帧率，适合动作内容

### 码率建议
| 分辨率 | 30fps | 60fps |
|--------|-------|-------|
| 480p   | 1 Mbps | 1.5 Mbps |
| 720p   | 2 Mbps | 4 Mbps |
| 1080p  | 4 Mbps | 8 Mbps |

### 编码器对比
| 编码器 | 优点 | 缺点 |
|--------|------|------|
| VP8    | 编码快速，兼容性好 | 压缩效率较低 |
| VP9    | 压缩效率高，文件更小 | 编码速度慢 |

## 📊 返回的元数据

```typescript
interface VideoRecordingMetadata {
  frameCount: number;    // 录制的总帧数
  duration: number;      // 录制时长（秒）
  fileSize: number;      // 文件大小（字节）
  width: number;         // 视频宽度
  height: number;        // 视频高度
  framerate: number;     // 帧率
  bitrate: number;       // 实际平均码率（bps）
  timestamp: number;     // 录制开始时间戳
}
```

## 🔧 MessagePort 通信协议

### 主线程 → Worker

**开始录制**
```javascript
processor.port.postMessage({
  command: 'start',
  config: {
    width: 1280,
    height: 720,
    framerate: 30,
    bitrate: 2000000,
    codec: 'vp8',
    maxDuration: 300,
  }
});
```

**停止录制**
```javascript
processor.port.postMessage({
  command: 'stop'
});
```

**更新配置**
```javascript
processor.port.postMessage({
  command: 'updateConfig',
  config: {
    bitrate: 3000000,
  }
});
```

### Worker → 主线程

**状态消息**
```javascript
{
  type: 'status',
  message: 'Recording started',
  config: { ... }
}
```

**错误消息**
```javascript
{
  type: 'error',
  message: 'Encoder error: ...'
}
```

**编码完成**
```javascript
{
  type: 'encoding',
  videoFormat: 'webm',
  codec: 'vp8',
  buffer: ArrayBuffer,
  metadata: {
    frameCount: 900,
    duration: 30.0,
    fileSize: 7500000,
    width: 1280,
    height: 720,
    framerate: 30,
    bitrate: 2000000,
    timestamp: 1234567890
  }
}
```

## 🌐 浏览器兼容性

### 支持的浏览器
- ✅ **Chrome 94+** (完全支持)
- ✅ **Edge 94+** (完全支持)
- ✅ **Opera 80+** (完全支持)

### 不支持的浏览器
- ❌ **Firefox** (不支持 VideoEncoder API)
- ❌ **Safari** (不支持 VideoEncoder API)
- ❌ **旧版本浏览器**

### 兼容性检测

```typescript
function isSupportVideoRecording() {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined'
  );
}

if (!isSupportVideoRecording()) {
  alert('Your browser does not support video recording. Please use Chrome or Edge.');
}
```

## 🎨 UI 界面功能

### 录制控制
- 📹 开始/停止录制按钮
- ⏱️ 实时录制时长显示
- 🔴 录制状态指示器

### 视频预览
- 🎬 录制完成后的视频预览
- ▶️ 播放/暂停控制
- 📊 视频元数据显示

### 参数配置
- 🎞️ 分辨率选择 (480p/720p/1080p)
- 🎥 帧率设置 (15/24/30/60 fps)
- 📈 码率调整 (0.5-10 Mbps)
- 🔧 编码器选择 (VP8/VP9)
- ⏰ 最大时长限制

### 文件操作
- 💾 下载录制的视频
- 📤 上传到服务器
- 🔄 自动上传功能

## 🔍 实现细节

### 帧处理流程

```typescript
async processFrame(input: VideoFrame, output: OffscreenCanvas) {
  // 1. 透传视频到输出（不影响显示）
  const ctx = output.getContext('2d');
  if (ctx) {
    ctx.drawImage(input, 0, 0, output.width, output.height);
  }

  // 2. 如果正在录制，克隆帧并编码
  if (this.isRecording && this.videoEncoder) {
    const clonedFrame = new VideoFrame(input, {
      timestamp: this.frameCount * (1_000_000 / this.config.framerate),
    });
    
    const keyFrame = this.frameCount % 30 === 0;
    this.videoEncoder.encode(clonedFrame, { keyFrame });
    clonedFrame.close();
    this.frameCount++;
  }

  return true;
}
```

### 内存管理

- **队列大小检查**：防止编码器队列溢出
```typescript
if (this.videoEncoder.encodeQueueSize < 10) {
  this.videoEncoder.encode(clonedFrame, { keyFrame });
} else {
  console.warn('Encoder queue is full, dropping frame');
}
```

- **及时关闭帧**：避免内存泄漏
```typescript
clonedFrame.close();
```

- **Transferable Objects**：使用零拷贝传输
```typescript
this.port.postMessage({...}, [buffer]);
```

### 关键帧策略

每 30 帧插入一个关键帧（I-frame），确保：
- 可以从任意位置开始播放
- 支持视频编辑和切割
- 在网络传输中更可靠

```typescript
const keyFrame = this.frameCount % 30 === 0;
```

## 🐛 常见问题

### 1. 浏览器不支持
**问题**：提示 "VideoEncoder is not supported"
**解决**：使用 Chrome 94+ 或 Edge 94+

### 2. 编码失败
**问题**：编码过程中出错
**解决**：
- 检查编码器配置是否支持
- 降低分辨率或码率
- 尝试切换编码器 (VP8 → VP9)

### 3. 文件过大
**问题**：录制的文件太大
**解决**：
- 降低分辨率 (1080p → 720p)
- 降低码率
- 使用 VP9 编码器（更高压缩率）

### 4. 帧率不稳定
**问题**：录制的视频卡顿
**解决**：
- 降低帧率 (60fps → 30fps)
- 降低分辨率
- 关闭其他占用 CPU 的应用

### 5. 内存占用高
**问题**：长时间录制内存增长
**解决**：
- 设置 `maxDuration` 限制录制时长
- 分段录制
- 及时下载并清空录制数据

## 📈 性能优化建议

### 1. 推荐配置
- **日常使用**: 720p @ 30fps, 2 Mbps, VP8
- **高质量**: 1080p @ 30fps, 4 Mbps, VP9
- **低带宽**: 480p @ 24fps, 1 Mbps, VP8

### 2. 编码参数
```typescript
{
  latencyMode: 'quality', // 质量优先
  // or
  latencyMode: 'realtime', // 速度优先
}
```

### 3. 监控指标
```typescript
console.log('Encoder queue size:', this.videoEncoder.encodeQueueSize);
console.log('Frame rate:', this.frameCount / duration);
console.log('Average bitrate:', fileSize * 8 / duration);
```

## 🔐 安全注意事项

1. **仅客户端录制**：视频不会自动上传到服务器
2. **用户权限**：需要用户明确同意才能录制
3. **HTTPS 要求**：生产环境必须使用 HTTPS
4. **存储限制**：浏览器内存有限，长时间录制可能失败

## 🎓 扩展功能建议

### 1. 音频录制
结合 `LocalRecordingAudioProcessor` 实现音视频同步录制

### 2. 实时预览
在录制过程中显示实时预览画面

### 3. 断点续传
支持暂停和恢复录制

### 4. 云端存储
自动上传到云存储服务 (S3, OSS 等)

### 5. 多轨录制
同时录制多个角度或多个参与者

## 📚 参考资料

- [WebCodecs API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [VideoEncoder - W3C](https://www.w3.org/TR/webcodecs/#videoencoder-interface)
- [webm-muxer - NPM](https://www.npmjs.com/package/webm-muxer)
- [WebM Container Format](https://www.webmproject.org/docs/container/)
- [VP8/VP9 Codec](https://www.webmproject.org/vp9/)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

与项目主仓库保持一致。

---

**创建日期**: 2025-10-28  
**作者**: Zoom Video SDK Team  
**版本**: 1.0.0

