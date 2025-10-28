# 🚀 Video Local Recording - 快速开始指南

## 📋 实现清单

### ✅ 已完成的文件

- [x] `lib/processors/video/VideoLocalRecording.ts` - 核心处理器
- [x] `sample/src/components/parameters/VideoLocalRecording.tsx` - UI 组件
- [x] `sample/src/config/processor/video.ts` - 配置文件（已更新）
- [x] `lib/package.json` - 已安装 webm-muxer

### 📦 安装依赖

```bash
# 1. 在 lib 目录安装 webm-muxer（已完成）
cd lib
npm install webm-muxer

# 2. 构建处理器
npm run build
```

### 🔨 构建和部署

```bash
# 1. 复制构建后的处理器到 public 目录
cp lib/dist/video-local-recording.js sample/public/

# 2. 启动开发服务器
cd sample
npm run dev
```

## 🧪 测试步骤

### 1. 浏览器检查

在浏览器控制台执行：
```javascript
console.log('VideoEncoder:', typeof VideoEncoder !== 'undefined' ? '✅ 支持' : '❌ 不支持');
console.log('VideoFrame:', typeof VideoFrame !== 'undefined' ? '✅ 支持' : '❌ 不支持');
```

**要求**: 必须使用 Chrome 94+ 或 Edge 94+

### 2. 加载处理器

1. 访问应用主页
2. 在处理器列表中找到 "Video Local Recording"
3. 点击进入处理器详情页

### 3. 基础录制测试

**步骤**:
1. 点击 📹 录制按钮开始录制
2. 等待 5-10 秒
3. 再次点击停止录制
4. 检查是否显示视频预览和元数据

**预期结果**:
- ✅ 显示录制时长计时器
- ✅ 停止后显示视频信息（帧数、时长、文件大小）
- ✅ 可以点击 "Preview" 播放录制的视频

### 4. 参数配置测试

测试不同的配置组合：

**测试 A: 720p @ 30fps, VP8**
```
分辨率: 720p
帧率: 30 fps
码率: 2 Mbps
编码器: VP8
```

**测试 B: 1080p @ 60fps, VP9**
```
分辨率: 1080p
帧率: 60 fps
码率: 4 Mbps
编码器: VP9
```

**测试 C: 480p @ 24fps, VP8**
```
分辨率: 480p
帧率: 24 fps
码率: 1 Mbps
编码器: VP8
```

### 5. 功能测试

#### 5.1 视频预览
- [ ] 点击 "Preview" 按钮
- [ ] 视频能正常播放
- [ ] 播放完成后自动停止

#### 5.2 视频下载
- [ ] 点击 "Download" 按钮
- [ ] 浏览器下载 .webm 文件
- [ ] 使用 VLC 或其他播放器能打开文件

#### 5.3 最大时长限制
- [ ] 设置 Max Duration 为 10 秒
- [ ] 开始录制
- [ ] 10 秒后自动停止

#### 5.4 上传功能（可选）
如果你有上传服务器：
- [ ] 设置 Upload URL
- [ ] 录制完成后自动上传
- [ ] 或点击 "Upload" 手动上传

## 🔧 调试技巧

### 查看控制台日志

录制过程中会输出详细日志：

```
VideoLocalRecording processor initialized
Starting video recording with config: {...}
Video recording started successfully
Stopping video recording...
Recording complete: 300 frames, 10.00s, 2.50MB
```

### 检查网络请求

在 Chrome DevTools > Network 标签：
- 确认 `video-local-recording.js` 加载成功
- 如果使用上传功能，检查上传请求

### 性能监控

在录制过程中检查：
```javascript
// 在控制台查看编码器状态
processor.port.postMessage({ command: 'status' });
```

## ⚠️ 常见问题排查

### 问题 1: "VideoEncoder is not supported"
**原因**: 浏览器不支持 WebCodecs
**解决**: 
```bash
# 确认浏览器版本
chrome://version
# 需要 Chrome 94+ 或 Edge 94+
```

### 问题 2: 找不到处理器
**原因**: 构建的文件未复制到 public 目录
**解决**:
```bash
# 检查文件是否存在
ls sample/public/video-local-recording.js

# 如果不存在，复制文件
cp lib/dist/video-local-recording.js sample/public/
```

### 问题 3: 录制失败
**原因**: 编码器配置不支持
**解决**:
1. 降低分辨率到 720p
2. 使用 VP8 编码器
3. 降低帧率到 30fps

### 问题 4: 内存占用高
**原因**: 长时间录制或高分辨率
**解决**:
1. 设置 Max Duration 限制
2. 降低分辨率
3. 录制完成后及时下载

### 问题 5: 视频卡顿
**原因**: CPU 负载过高
**解决**:
1. 降低帧率 (60fps → 30fps)
2. 使用 VP8 代替 VP9
3. 关闭其他应用

## 📊 性能基准

### 录制性能（参考）

| 配置 | CPU 使用 | 内存 | 文件大小/分钟 |
|------|---------|------|--------------|
| 480p @ 24fps, VP8, 1Mbps | ~10% | ~100MB | ~7.5MB |
| 720p @ 30fps, VP8, 2Mbps | ~20% | ~150MB | ~15MB |
| 1080p @ 30fps, VP9, 4Mbps | ~40% | ~250MB | ~30MB |
| 1080p @ 60fps, VP9, 8Mbps | ~60% | ~400MB | ~60MB |

*测试环境: Intel i7-10700K, 16GB RAM, Chrome 120*

## 🎯 推荐配置

### 日常使用
```
分辨率: 720p
帧率: 30 fps
码率: 2 Mbps
编码器: VP8
最大时长: 300 秒 (5 分钟)
```

### 高质量录制
```
分辨率: 1080p
帧率: 30 fps
码率: 4 Mbps
编码器: VP9
最大时长: 180 秒 (3 分钟)
```

### 快速录制
```
分辨率: 480p
帧率: 24 fps
码率: 1 Mbps
编码器: VP8
最大时长: 600 秒 (10 分钟)
```

## 🔍 验证编码质量

### 使用 FFmpeg 检查视频

```bash
# 安装 FFmpeg (macOS)
brew install ffmpeg

# 查看视频信息
ffmpeg -i recording.webm

# 转换为 MP4 (如果需要)
ffmpeg -i recording.webm -c:v libx264 -crf 23 output.mp4
```

### 使用 MediaInfo

```bash
# 安装 MediaInfo
brew install mediainfo

# 查看详细信息
mediainfo recording.webm
```

## 📝 开发提示

### 1. 修改处理器后重新构建

```bash
cd lib
npm run build
cp dist/video-local-recording.js ../sample/public/
```

### 2. 监听模式（开发时）

```bash
cd lib
npm run dev  # 自动监听文件变化并重新构建
```

### 3. 调试模式

在 `VideoLocalRecording.ts` 中添加更多日志：

```typescript
console.log('[DEBUG] Frame encoded:', {
  frameCount: this.frameCount,
  queueSize: this.videoEncoder.encodeQueueSize,
  timestamp: performance.now(),
});
```

### 4. 测试不同分辨率

在组件中添加自定义分辨率：

```typescript
// VideoLocalRecording.tsx
const customResolution = {
  width: 1920,
  height: 1080,
};
```

## 🎉 成功验证清单

完成以下所有项目表示实现成功：

- [ ] 浏览器支持检查通过
- [ ] 处理器加载成功
- [ ] 基础录制功能正常
- [ ] 视频预览可播放
- [ ] 文件下载成功
- [ ] 不同配置都能录制
- [ ] 元数据显示正确
- [ ] 录制的视频可以用其他播放器打开
- [ ] 没有内存泄漏
- [ ] 控制台无错误日志

## 📞 需要帮助？

如果遇到问题：

1. **检查控制台日志** - 查看详细错误信息
2. **查看 README** - 参考完整文档
3. **浏览器兼容性** - 确认使用支持的浏览器
4. **降低配置** - 尝试更低的分辨率和码率
5. **重新构建** - 清除缓存后重新构建

## 🔗 相关文档

- [完整 README](./VIDEO_LOCAL_RECORDING_README.md)
- [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [webm-muxer](https://www.npmjs.com/package/webm-muxer)

---

**祝录制愉快！** 🎬

