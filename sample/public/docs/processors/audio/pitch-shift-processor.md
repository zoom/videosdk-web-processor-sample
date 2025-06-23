# Pitch Shift Audio Processor

The **Pitch Shift Audio Processor** allows you to change the pitch of your voice in real-time during audio calls. Perfect for voice effects, entertainment, and creative applications.

## Introduction

This processor transforms your voice by adjusting the pitch ratio while maintaining audio quality. It features:

- 🎵 **Real-time pitch shifting** - Instant voice transformation
- 🎛️ **Simple controls** - Easy-to-use pitch ratio slider
- ⚡ **Low latency** - Minimal delay for smooth conversation
- 🔊 **High quality** - Professional audio processing

The processor supports pitch ratios from 0.25x (very low) to 2.0x (very high), with 1.0x being your natural voice.

## Quick Start

### Create and Add Processor

```javascript
// Create the processor
const processor = stream.createProcessor({
  url: '/pitch-shift-audio-processor.js',
  name: 'pitch-shift-audio-processor',
  type: 'audio'
});

// Add to audio stream
await stream.addProcessor(processor);
```

### Remove Processor
```javascript
stream.removeProcessor(processor);
```

## Configuration

### Pitch Ratio Settings

The main control parameter is the **pitch ratio**:

| Ratio | Effect | Use Case |
|-------|--------|----------|
| 0.25x | Very deep voice | Dramatic effect |
| 0.5x | Deep voice | Male voice effect |
| 1.0x | Normal voice | No change |
| 1.5x | Higher voice | Light effect |
| 2.0x | Very high voice | Chipmunk effect |

### Fixed Parameters

These parameters are automatically set and don't need adjustment:

- **`formantRatio`**: Always 0 (disabled)
- **`dryWet`**: Always 0.0 (dry signal only)

## Examples

### Voice Effects

#### Chipmunk Voice
```javascript
processor.port.postMessage({
  command: 'update-pitch-shift-config',
  data: {
    pitchRatio: 2.0,    // Maximum high pitch
    formantRatio: 0,
    dryWet: 0.0
  }
});
```

#### Deep Voice
```javascript
processor.port.postMessage({
  command: 'update-pitch-shift-config',
  data: {
    pitchRatio: 0.5,    // Half the original pitch
    formantRatio: 0,
    dryWet: 0.0
  }
});
```

#### Slight Voice Change
```javascript
processor.port.postMessage({
  command: 'update-pitch-shift-config',
  data: {
    pitchRatio: 1.2,    // Slightly higher
    formantRatio: 0,
    dryWet: 0.0
  }
});
```

## Source Code

```javascript
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

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
  constructor(port: MessagePort, options: any) {
    super(port, options);
    this.bufferSize = 11025; // 1 second buffer (44.1kHz sampling rate)
    this.buffer = new Float32Array(this.bufferSize);
    this.writePos = 0;
    this.readPos = 0.0;
    // Parameter configuration
    this.pitchRatio = 1.8; // Tone ratio (1.0 is original sound)
    this.formantRatio = 0; // Formant ratio
    this.dryWet = 0; // // Dry/Wet mix ratio
    // High-pass filter parameters (simple implementation)
    this.hpf = {
      prevIn: 0,
      prevOut: 0,
      alpha: 0.86
    };
    this.port.onmessage = (event) => {
      const { pitchRatio, formantRatio, dryWet, command } = event.data;
      if (command === 'update-pitch-shift-config') {
        this.pitchRatio = pitchRatio;
        this.formantRatio = formantRatio;
        this.dryWet = dryWet;
      }
    };
  }
  process(inputs: Array<Array<Float32Array>>, outputs: Array<Array<Float32Array>>) {
    const input = inputs[0];
    const output = outputs[0];
    if (input.length === 0 || !input[0]) {
      return true;
    }
    const inputChannel = input[0];
    const outputChannel = output[0];
    // Write input to ring buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.writePos] = inputChannel[i];
      this.writePos = (this.writePos + 1) % this.bufferSize;
    }
    // Process each output sample
    for (let i = 0; i < outputChannel.length; i++) {
      // Calculate current read position
      let readPos = this.readPos % this.bufferSize;
      if (readPos < 0) readPos += this.bufferSize;
      // Linear interpolation
      const intPos = Math.floor(readPos);
      const frac = readPos - intPos;
      const nextPos = (intPos + 1) % this.bufferSize;
      // Raw signal
      const raw = this.buffer[intPos] * (1 - frac) + this.buffer[nextPos] * frac;
      // High-pass filter
      const filtered = raw - this.hpf.prevIn + this.hpf.alpha * this.hpf.prevOut;
      this.hpf.prevIn = raw;
      this.hpf.prevOut = filtered;
      // Dry/Wet mix
      outputChannel[i] = filtered * this.dryWet + raw * (1 - this.dryWet);
      // Update read position (apply pitch ratio)
      this.readPos += this.pitchRatio;
      // Auto wrap-around handling
      if (this.readPos >= this.bufferSize) {
        this.readPos -= this.bufferSize;
        this.writePos = 0; // Reset write position to keep in sync
      }
    }
    return true;
  }
}

registerProcessor('pitch-shift-audio-processor', PitchShiftProcessor);
```

### Key Features

- **Ring Buffer**: Circular buffer for continuous audio processing
- **Linear Interpolation**: Smooth sample interpolation for quality
- **Real-time Updates**: Dynamic pitch ratio changes
- **Low Latency**: Optimized for real-time performance

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 76+ | ✅ Full | Recommended |
| Firefox 76+ | ✅ Full | Works well |
| Safari 14+ | ⚠️ Limited | Audio Worklet support varies |
| Edge 79+ | ✅ Full | Chromium-based |

### Requirements

- **Audio Worklets**: Required for real-time processing
- **Web Audio API**: Core audio processing support
- **Secure Context**: HTTPS required for audio access

### Performance

- **CPU Usage**: ~2-5% on modern devices
- **Latency**: ~5-15ms typical
- **Memory**: ~1-2MB per processor instance