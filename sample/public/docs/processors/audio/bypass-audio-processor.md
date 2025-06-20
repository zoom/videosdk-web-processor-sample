# Bypass Audio Processor

A simple pass-through audio processor that demonstrates the basic structure of audio processing without modifying the audio stream. Perfect for learning and as a foundation for custom audio processors.

## Overview

The **Bypass Audio Processor** is designed as a:

- 🎯 **Learning tool** for understanding audio processor architecture
- 🔧 **Template** for building custom audio processors  
- 🧪 **Testing component** for audio pipeline validation
- 📊 **Debugging aid** for audio stream analysis

## Features

### Core Capabilities

- **Zero-latency** audio pass-through
- **Full audio fidelity** preservation
- **Multi-channel support** (mono, stereo, surround)
- **Sample rate flexibility** (8kHz to 192kHz)
- **Format compatibility** (PCM, Float32)

### Technical Specifications

| Specification | Value | Notes |
|---------------|--------|-------|
| Latency | < 1ms | Theoretical minimum |
| CPU Usage | ~0.1% | Minimal overhead |
| Memory | ~10KB | Base footprint |
| Max Channels | 32 | System dependent |
| Bit Depth | 16/24/32-bit | Auto-detected |

## Quick Start

### Basic Implementation

```javascript
import { ZoomVideo } from '@zoom/videosdk';

// Create audio stream
const stream = ZoomVideo.createAudioStream();

// Add bypass processor
const processor = stream.createProcessor({
  url: '/bypass-audio-processor.js',
  name: 'bypass-audio-processor', 
  type: 'audio',
  options: {
    debug: false,
    enableMetrics: true
  }
});

await stream.addProcessor(processor);
await stream.startAudio();
```

### Advanced Usage

```javascript
// Monitor audio metrics
processor.port.addEventListener('message', (event) => {
  if (event.data.type === 'metrics') {
    console.log('Audio Level:', event.data.level);
    console.log('Sample Rate:', event.data.sampleRate);
    console.log('Channel Count:', event.data.channels);
  }
});
```

## Configuration Options

### Available Parameters

- `debug` (boolean): Enable debug logging
- `enableMetrics` (boolean): Report audio metrics
- `bufferSize` (number): Processing buffer size
- `sampleRate` (number): Force specific sample rate

### Example Configuration

```javascript
const options = {
  debug: true,
  enableMetrics: true,
  bufferSize: 1024,
  // sampleRate: 48000  // Auto-detect by default
};
```

## Use Cases

### 1. Pipeline Testing

> Test your audio pipeline without any processing effects

```javascript
// Verify audio flow
const testProcessor = stream.createProcessor({
  url: '/bypass-audio-processor.js',
  name: 'pipeline-test',
  type: 'audio'
});
```

### 2. Performance Baseline

Measure baseline performance before adding complex processors:

- Establish latency benchmarks
- Monitor CPU usage patterns  
- Test memory allocation
- Validate audio quality

### 3. Development Template

Use as starting point for custom processors:

```javascript
// Custom processor based on bypass
class CustomAudioProcessor extends BypassAudioProcessor {
  processAudio(inputBuffer, outputBuffer) {
    // Add your custom processing here
    super.processAudio(inputBuffer, outputBuffer);
  }
}
```

## Audio Processing Flow

The processor follows this simple flow:

1. **Receive** audio input buffer
2. **Validate** buffer properties  
3. **Copy** input to output (unchanged)
4. **Report** metrics (if enabled)
5. **Return** processed buffer

```javascript
// Simplified processing logic
function processAudioFrame(input, output) {
  // Direct copy - no processing
  output.copyFrom(input);
  
  // Optional: collect metrics
  if (enableMetrics) {
    reportAudioLevel(calculateLevel(input));
  }
}
```

## Troubleshooting

### Common Issues

**No audio output:**
- Check processor is properly added to stream
- Verify audio permissions granted
- Ensure input device is connected

**High CPU usage:**
- Reduce buffer size if possible
- Disable metrics reporting
- Check for browser performance issues

**Audio dropouts:**
- Increase buffer size
- Check network stability
- Monitor system resource usage

### Debug Mode

Enable detailed logging:

```javascript
const processor = stream.createProcessor({
  url: '/bypass-audio-processor.js',
  name: 'bypass-debug',
  type: 'audio',
  options: { debug: true }
});
```

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Recommended |
| Firefox | ✅ Full | Good performance |
| Safari | ⚠️ Limited | Some restrictions |
| Edge | ✅ Full | Chrome-based |

---

## Next Steps

After testing with the bypass processor:

1. **Explore** other audio processors
2. **Build** custom processing logic
3. **Optimize** for your use case
4. **Deploy** to production

## Resources

- [Audio Processor API](https://developers.zoom.us/docs/video-sdk/web/audio-processors/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Sample Code Repository](https://github.com/zoom/videosdk-samples) 