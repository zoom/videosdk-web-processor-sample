# Pitch Shift Audio Processor

The **Pitch Shift Audio Processor** allows you to modify the pitch of audio in real-time without changing the playback speed[^1]. This processor is perfect for voice modulation, musical effects, and creative audio processing.

---

## Table of Contents

This document covers all aspects of the Pitch Shift Audio Processor implementation and usage.

## Overview

The Pitch Shift processor uses advanced digital signal processing algorithms to:

- 🎵 **Change pitch** without affecting tempo
- 🎙️ **Real-time processing** with minimal latency  
- 🔧 **Configurable parameters** for fine-tuning
- 🎚️ **Professional quality** audio output

### Key Features

| Feature | Description | Performance Impact |
|---------|-------------|-------------------|
| **PSOLA Algorithm** | Pitch Synchronous Overlap and Add | Low CPU usage |
| **Phase Vocoder** | Frequency domain processing | Medium CPU usage |
| **Harmonic Preservation** | Maintains audio quality | Minimal artifacts |
| **Real-time Buffer** | Low-latency processing | ~5ms delay |

## Quick Start

### Installation

```bash
# Install dependencies
npm install @zoom/videosdk

# Optional: Audio worklet polyfill for older browsers
npm install audio-worklet-polyfill
```

### Basic Setup

```javascript
import { ZoomVideo } from '@zoom/videosdk';

// Create audio stream
const stream = ZoomVideo.createAudioStream();

// Configure pitch shift processor
const processor = stream.createProcessor({
  url: '/pitch-shift-audio-processor.js',
  name: 'pitch-shift-processor',
  type: 'audio',
  options: {
    pitchShift: 2,      // Semitones (-12 to +12)
    algorithm: 'psola', // 'psola' or 'phase-vocoder'
    quality: 'high',    // 'low', 'medium', 'high'
    preserveFormants: true
  }
});

// Apply processor
await stream.addProcessor(processor);
await stream.startAudio();
```

## Configuration Parameters

### Core Settings

- **`pitchShift`** (number): Pitch adjustment in semitones
  - Range: -12 to +12 semitones
  - Default: 0 (no change)
  - Example: `+7` = perfect fifth up

- **`algorithm`** (string): Processing algorithm
  - `'psola'`: Time-domain algorithm (faster)
  - `'phase-vocoder'`: Frequency-domain algorithm (higher quality)

- **`quality`** (string): Processing quality vs performance
  - `'low'`: Fast processing, basic quality
  - `'medium'`: Balanced performance/quality
  - `'high'`: Best quality, higher CPU usage

### Advanced Options

```javascript
const advancedOptions = {
  pitchShift: 5,
  algorithm: 'phase-vocoder',
  quality: 'high',
  
  // Advanced parameters
  preserveFormants: true,     // Maintain voice characteristics
  windowSize: 2048,          // FFT window size (power of 2)
  overlapFactor: 4,          // Overlap between frames
  smoothing: 0.8,            // Pitch smoothing factor
  
  // Real-time options
  bufferSize: 512,           // Processing buffer size
  lookahead: 256,            // Lookahead samples
  
  // Quality tweaks
  antiAlias: true,           // Anti-aliasing filter
  normalize: false           // Output normalization
};
```

## Usage Examples

### Voice Effects

#### Chipmunk Voice

```javascript
const chipmunkProcessor = stream.createProcessor({
  url: '/pitch-shift-audio-processor.js',
  name: 'chipmunk-voice',
  type: 'audio',
  options: {
    pitchShift: +8,           // 8 semitones up
    algorithm: 'psola',
    quality: 'medium',
    preserveFormants: false   // Allow voice character change
  }
});
```

#### Deep Voice

```javascript 
const deepVoiceProcessor = stream.createProcessor({
  url: '/pitch-shift-audio-processor.js',
  name: 'deep-voice',
  type: 'audio',
  options: {
    pitchShift: -5,           // 5 semitones down
    algorithm: 'phase-vocoder',
    quality: 'high',
    preserveFormants: true    // Keep natural voice
  }
});
```

### Musical Applications

> **Note**: For musical applications, consider using the phase vocoder algorithm for better harmonic preservation.

#### Harmony Generator

Create simple harmonies by running multiple processors:

```javascript
// Main voice (unchanged)
const mainVoice = stream.createProcessor({
  url: '/pitch-shift-audio-processor.js',
  name: 'main-voice',
  options: { pitchShift: 0 }
});

// Third harmony (+4 semitones)
const harmonyThird = stream.createProcessor({
  url: '/pitch-shift-audio-processor.js', 
  name: 'harmony-third',
  options: { 
    pitchShift: +4,
    algorithm: 'phase-vocoder',
    quality: 'high'
  }
});

// Fifth harmony (+7 semitones)  
const harmonyFifth = stream.createProcessor({
  url: '/pitch-shift-audio-processor.js',
  name: 'harmony-fifth', 
  options: { 
    pitchShift: +7,
    algorithm: 'phase-vocoder',
    quality: 'high'
  }
});
```

## Algorithm Comparison

### PSOLA (Pitch Synchronous Overlap and Add)

**Advantages:**
- ✅ Lower CPU usage
- ✅ Minimal latency
- ✅ Good for voice processing
- ✅ Simpler implementation

**Disadvantages:**
- ❌ Can introduce artifacts with large shifts
- ❌ Less suitable for complex audio
- ❌ Limited frequency resolution

### Phase Vocoder

**Advantages:**  
- ✅ Higher quality output
- ✅ Better for musical content
- ✅ Handles complex audio well
- ✅ Precise frequency control

**Disadvantages:**
- ❌ Higher CPU usage  
- ❌ Increased latency
- ❌ More complex processing
- ❌ Requires larger buffers

## Performance Optimization

### CPU Usage Guidelines

| Quality Setting | CPU Usage | Recommended Use Case |
|----------------|-----------|---------------------|
| Low | ~2-5% | Real-time voice chat |
| Medium | ~5-10% | Streaming applications |  
| High | ~10-20% | Professional recording |

### Memory Usage

- **Buffer Size**: Larger buffers = more memory but better quality
- **Window Size**: Affects both memory and processing quality
- **Multiple Instances**: Each processor uses ~1-5MB RAM

### Optimization Tips

1. **Use appropriate quality settings**

```javascript
   // For real-time voice chat
   options: { quality: 'low', algorithm: 'psola' }
   
   // For music streaming
   options: { quality: 'high', algorithm: 'phase-vocoder' }
```

2. **Batch parameter updates**
```javascript
   // Avoid frequent updates
   processor.port.postMessage({
     cmd: 'update_options',
     data: { 
       pitchShift: newPitch,
       quality: newQuality 
     }
   });
```

3. **Monitor performance**
```javascript
   // Enable performance monitoring
   processor.port.addEventListener('message', (event) => {
     if (event.data.type === 'performance') {
       console.log('CPU Usage:', event.data.cpuUsage);
       console.log('Processing Time:', event.data.processingTime);
     }
   });
```

## Interactive Controls

### React Component Example

```jsx
import React, { useState, useRef } from 'react';

function PitchShiftControls() {
  const [pitchShift, setPitchShift] = useState(0);
  const [algorithm, setAlgorithm] = useState('psola');
  const [quality, setQuality] = useState('medium');
  const processorRef = useRef(null);

  const updateProcessor = (newOptions) => {
    if (processorRef.current) {
      processorRef.current.port.postMessage({
        cmd: 'update_options',
        data: newOptions
      });
    }
  };

  return (
    <div className="pitch-controls">
      {/* Pitch Slider */}
      <div className="control-group">
        <label>Pitch Shift: {pitchShift} semitones</label>
        <input
          type="range"
          min="-12"
          max="12"
          step="1"
          value={pitchShift}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            setPitchShift(value);
            updateProcessor({ pitchShift: value });
          }}
        />
      </div>

      {/* Algorithm Selection */}
      <div className="control-group">
        <label>Algorithm:</label>
        <select 
          value={algorithm}
          onChange={(e) => {
            setAlgorithm(e.target.value);
            updateProcessor({ algorithm: e.target.value });
          }}
        >
          <option value="psola">PSOLA (Fast)</option>
          <option value="phase-vocoder">Phase Vocoder (Quality)</option>
        </select>
      </div>

      {/* Quality Setting */}
      <div className="control-group">
        <label>Quality:</label>
        <select
          value={quality}
          onChange={(e) => {
            setQuality(e.target.value);
            updateProcessor({ quality: e.target.value });
          }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {/* Preset Buttons */}
      <div className="preset-buttons">
        <button onClick={() => updateProcessor({ pitchShift: 0 })}>
          Normal Voice
        </button>
        <button onClick={() => updateProcessor({ pitchShift: +8 })}>
          Chipmunk
        </button>
        <button onClick={() => updateProcessor({ pitchShift: -5 })}>
          Deep Voice
        </button>
      </div>
    </div>
  );
}
```

## Keyboard Shortcuts

Use these keyboard shortcuts for quick adjustments:

- [[Ctrl]] + [[↑]] / [[↓]]: Adjust pitch by 1 semitone
- [[Ctrl]] + [[Shift]] + [[↑]] / [[↓]]: Adjust pitch by 1 octave  
- [[Ctrl]] + [[0]]: Reset to normal pitch
- [[Ctrl]] + [[Q]]: Toggle quality (low/medium/high)
- [[Ctrl]] + [[A]]: Toggle algorithm (PSOLA/Phase Vocoder)

## Mathematical Foundation

The pitch shift process involves complex mathematical operations:

### PSOLA Algorithm

The PSOLA method works by:
1. Detecting pitch periods in the audio signal
2. Extracting individual pitch cycles  
3. Resampling cycles to change pitch
4. Overlapping and adding modified cycles

**Formula**: $f_{out} = f_{in} \times 2^{semitones/12}$

Where:
- $f_{out}$ = output frequency
- $f_{in}$ = input frequency  
- $semitones$ = pitch shift amount

### Phase Vocoder

The phase vocoder uses Short-Time Fourier Transform (STFT):

1. **Analysis**: $X(k,m) = \sum_{n=0}^{N-1} x(n+mH) w(n) e^{-j2\pi kn/N}$
2. **Modification**: Adjust frequency bins
3. **Synthesis**: Inverse STFT to reconstruct audio

## Troubleshooting

### Common Issues

**Audio artifacts or "robotic" sound:**
- Try increasing quality setting
- Switch to phase vocoder algorithm  
- Reduce pitch shift amount
- Increase window size for phase vocoder

**High CPU usage:**
- Lower quality setting
- Use PSOLA algorithm
- Reduce buffer size
- Disable formant preservation

**Latency issues:**
- Reduce buffer sizes
- Use PSOLA algorithm
- Minimize other processing
- Check audio driver settings

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `PITCH_RANGE_ERROR` | Pitch shift out of range | Use values between -12 and +12 |
| `ALGORITHM_NOT_SUPPORTED` | Invalid algorithm | Use 'psola' or 'phase-vocoder' |
| `BUFFER_UNDERRUN` | Processing too slow | Increase buffer size or lower quality |
| `INITIALIZATION_FAILED` | Processor setup failed | Check browser audio support |

### Debug Information

Enable debug mode for detailed information:

```javascript
const processor = stream.createProcessor({
  url: '/pitch-shift-audio-processor.js',
  name: 'pitch-shift-debug',
  type: 'audio',
  options: {
    pitchShift: 5,
    debug: true,
    logLevel: 'verbose'
  }
});

processor.port.addEventListener('message', (event) => {
  if (event.data.type === 'debug') {
    console.log('Debug Info:', event.data);
  }
});
```

## Browser Support

| Browser | PSOLA | Phase Vocoder | Audio Worklets | Notes |
|---------|--------|---------------|----------------|--------|
| Chrome 76+ | ✅ | ✅ | ✅ | Full support |
| Firefox 76+ | ✅ | ✅ | ✅ | Full support |
| Safari 14+ | ✅ | ⚠️ | ⚠️ | Limited worklet support |
| Edge 79+ | ✅ | ✅ | ✅ | Chromium-based |

## Performance Benchmarks

### Latency Measurements

| Configuration | Latency | CPU Usage | Quality Score |
|---------------|---------|-----------|---------------|
| PSOLA Low | 2-5ms | 2% | 7/10 |
| PSOLA Medium | 5-10ms | 4% | 8/10 |
| PSOLA High | 10-15ms | 6% | 8.5/10 |
| Phase Vocoder Low | 15-25ms | 8% | 8/10 |
| Phase Vocoder Medium | 25-40ms | 15% | 9/10 |
| Phase Vocoder High | 40-60ms | 25% | 9.5/10 |

---

## References and Resources

For more information about pitch shifting algorithms:

- 📚 [Digital Audio Signal Processing](https://example.com/dsp-book)
- 🎓 [PSOLA Algorithm Paper](https://example.com/psola-paper)
- 🔬 [Phase Vocoder Theory](https://example.com/phase-vocoder)
- 💻 [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

### Community Resources

- 💬 [Audio Processing Forum](https://example.com/audio-forum)
- 🎮 [Interactive Demo](https://example.com/pitch-demo)
- 📖 [Tutorial Series](https://example.com/tutorials)
- 🛠️ [Source Code Examples](https://github.com/example/pitch-shift)

---

[^1]: Pitch shifting changes the fundamental frequency of audio without affecting the playback speed, unlike simple time-stretching which affects both pitch and tempo simultaneously.

**Last Updated**: December 2024  
**Version**: 2.1.0  
**Author**: Audio Processing Team 