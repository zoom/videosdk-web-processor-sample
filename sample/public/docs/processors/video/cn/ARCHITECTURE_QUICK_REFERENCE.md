# 实时录制架构 - 快速参考

## 🎯 核心概念

### 三层架构

```
┌─────────────────────────────────────────┐
│  VideoSDK Stream (VideoFrames)          │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Worker: 编码 + 分段                     │
│  VideoEncoder → MediaBunny → Segments   │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│  Main Thread: 上传 + 播放                │
│  Upload → Server                        │
│  Play → MediaSource → Video Element     │
└─────────────────────────────────────────┘
```

---

## 📁 核心文件

| 文件 | 职责 | 运行环境 |
|------|------|----------|
| `lib/processors/video/VideoLocalRecordingRealtime.ts` | 编码和分段 | Worker |
| `sample/src/components/parameters/VideoLocalRecordingRealtime.tsx` | UI控制 | Main Thread |
| `sample/src/utils/RealtimeVideoRecorder.ts` | 播放管理 | Main Thread |

---

## 🔄 数据流

### 简化版

```
VideoFrame (30fps)
    ↓
VideoEncoder (VP8/VP9)
    ↓
MediaBunny (封装WebM)
    ↓
Segment (10秒一个)
    ↓
postMessage (零拷贝)
    ↓
Main Thread
    ├→ Upload (POST)
    └→ Play (MediaSource)
```

### 详细版

```
1. 录制启动
   User → Main Thread → Worker
   
2. 帧捕获循环 (30fps)
   VideoFrame → VideoEncoder.encode()
   
3. 编码输出
   EncodedChunk → MediaBunny.add()
   
4. 分段时机 (每10秒)
   Timer → needsSegmentSplit = true
   
5. Keyframe检测
   if (chunk.type === 'key' && needsSegmentSplit)
   
6. 创建Segment
   MediaBunny.finalize() → ArrayBuffer
   
7. 发送到主线程
   postMessage({ type: 'segment', data }, [data])
   
8. 主线程处理
   Blob → Upload + Play + Store
```

---

## ⚙️ 关键参数

### 编码配置

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| width | 1280 | 分辨率宽度 |
| height | 720 | 分辨率高度 |
| framerate | 30 | 帧率（fps） |
| bitrate | 2_000_000 | 码率（2 Mbps） |
| codec | 'vp8' | 编码器 |
| segmentDuration | 10 | 分段时长（秒） |

### Keyframe策略

```typescript
// 每1秒生成一个keyframe（30帧）
const keyFrame = frameCount % 30 === 0;
videoEncoder.encode(clonedFrame, { keyFrame });
```

---

## 🎬 使用流程

### 1. 初始化

```typescript
const processor = stream.createProcessor({
  url: '/video-local-recording-realtime.js',
  name: 'video-local-recording-realtime',
  type: 'video',
});

await stream.addProcessor(processor);
```

### 2. 开始录制

```typescript
processor.port.postMessage({
  command: 'start',
  config: {
    width: 1280,
    height: 720,
    framerate: 30,
    bitrate: 2_000_000,
    codec: 'vp8',
    segmentDuration: 10,
  },
});
```

### 3. 处理Segments

```typescript
processor.port.onmessage = async (event) => {
  if (event.data.type === 'segment') {
    const { data, segmentIndex } = event.data;
    const blob = new Blob([data], { type: 'video/webm' });
    
    // 上传
    await uploadSegment(blob, segmentIndex);
    
    // 播放
    await recorder.playSegment(blob);
    
    // 存储
    saveSegment(blob);
  }
};
```

### 4. 停止录制

```typescript
processor.port.postMessage({ command: 'stop' });
```

---

## 🔑 核心技术

### 1. Segment分段

**为什么？**
- ✅ 实时传输（不等整个录制完成）
- ✅ 失败恢复（单个segment失败不影响其他）
- ✅ 实时播放（边录边播）
- ✅ 内存友好（不需要缓存整个录制）

**如何实现？**
```typescript
// 定时触发
setInterval(() => {
  needsSegmentSplit = true;
}, 10000); // 10秒

// Keyframe对齐
if (needsSegmentSplit && chunk.type === 'key') {
  createSegment();
}
```

### 2. MediaSource播放

**为什么？**
- ✅ 累积播放（多个segments连续播放）
- ✅ Seek支持（可以拖动进度条）
- ✅ 实时更新（新segment立即可播）

**如何实现？**
```typescript
// 初始化
const mediaSource = new MediaSource();
videoElement.src = URL.createObjectURL(mediaSource);

// 添加segment
sourceBuffer.appendBuffer(segmentData);

// 自动播放
sourceBuffer.addEventListener('updateend', () => {
  if (videoElement.paused) {
    videoElement.play();
  }
});
```

### 3. 零拷贝传输

**为什么？**
- ✅ 性能（无内存拷贝开销）
- ✅ 实时性（传输速度快）

**如何实现？**
```typescript
// Worker发送（transferable）
port.postMessage(
  { type: 'segment', data: buffer },
  [buffer] // ← 转移所有权
);

// Main Thread接收
// buffer已经transfer，不需要拷贝
const blob = new Blob([data]);
```

---

## 📊 性能指标

### 延迟分析

| 阶段 | 延迟 | 说明 |
|------|------|------|
| 编码 | ~3ms/frame | VideoEncoder硬件加速 |
| 封装 | ~50ms/segment | MediaBunny封装10秒数据 |
| 传输 | <1ms | Worker → Main Thread |
| 上传 | ~100-500ms | 取决于网络和segment大小 |
| 播放 | ~100ms | SourceBuffer添加延迟 |
| **总计** | **~1-2秒** | **从录制到播放的端到端延迟** |

### 资源占用

| 资源 | 占用 | 说明 |
|------|------|------|
| CPU | 5-10% | 硬件加速编码 |
| 内存 | <20MB | 最多3个segment在内存 |
| 网络 | 2 Mbps | 码率决定 |
| 存储 | ~15MB/min | 2Mbps × 60s ÷ 8 |

---

## 🐛 调试清单

### 录制不工作
```
□ 检查processor是否加载
□ 检查Worker是否收到start命令
□ 检查VideoEncoder是否初始化
□ 检查Console有无错误
```

### Segment无法播放
```
□ 检查segment是否从keyframe开始
□ 检查是否有decoder config
□ 检查MIME type是否支持
□ 检查segment文件大小是否正常
```

### 播放卡顿
```
□ 检查SourceBuffer.updating状态
□ 检查是否处理updateend事件
□ 检查网络上传是否阻塞主线程
□ 检查是否有内存泄漏
```

### 上传失败
```
□ 检查服务器是否运行
□ 检查uploadUrl是否正确
□ 检查CORS配置
□ 检查网络连接
```

---

## 🔍 日志关键点

### Worker端
```javascript
// 应该看到这些日志
console.log('Starting video recording with config:', config);
console.log('VideoEncoder configured');
console.log('MediaBunny output started');
console.log('Creating segment at requested keyframe');
console.log(`Segment ${segmentIndex} sent: ${size} bytes`);
```

### Main Thread端
```javascript
// 应该看到这些日志
console.log('VideoLocalRecordingRealtime processor loaded');
console.log('Received segment:', segmentIndex);
console.log('Uploading segment to server');
console.log('Playing segment');
console.log('Appended segment to SourceBuffer');
```

---

## 📈 监控指标

### 实时指标
- 帧率：30 fps
- 码率：2 Mbps
- Segment大小：~2.5 MB (10秒)
- 上传速度：取决于网络
- 播放延迟：1-2秒

### 累积指标
- 总segment数：时长(秒) ÷ 10
- 总数据量：时长(秒) × 码率(bps) ÷ 8
- 成功率：成功segments ÷ 总segments

---

## 🎯 最佳实践

### 1. Segment时长选择
- **短segment (5秒)**：更实时，更多开销
- **中segment (10秒)**：平衡，推荐
- **长segment (30秒)**：更高效，延迟大

### 2. Keyframe间隔
- **密集 (每秒)**：segment更灵活，码率增加
- **中等 (每秒)**：推荐
- **稀疏 (每2秒)**：码率低，分段延迟大

### 3. 上传策略
- **同步上传**：简单，但可能阻塞
- **异步上传**：推荐，不阻塞录制
- **批量上传**：网络不稳定时使用

### 4. 播放策略
- **实时播放**：使用MediaSource
- **完整播放**：等待所有segments
- **离线播放**：合并所有segments

---

## 📚 参考链接

### Web APIs
- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [MediaSource API](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource)
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

### Libraries
- [MediaBunny](https://github.com/ThaUnknown/mediabunny) - WebM封装
- [Zoom Video SDK](https://developers.zoom.us/docs/video-sdk/)

### 相关文档
- `REALTIME_RECORDING_ARCHITECTURE.md` - 详细架构文档
- `VIDEO_LOCAL_RECORDING_README.md` - 原始录制文档

---

**快速上手：**
1. 阅读本文档了解核心概念
2. 查看代码中的注释了解实现细节
3. 运行demo体验实时录制
4. 查看详细架构文档深入了解

**问题排查：**
1. 检查Console日志
2. 参考调试清单
3. 查看详细架构文档的"常见问题"章节

🚀 **准备好开始了吗？** 运行 `npm run dev` 启动demo！

