# Theme Demo

This is a demonstration of the markdown theme system with **dynamic code theme switching**. When you select different themes, the code snippets will automatically use appropriate syntax highlighting themes:

- **Light themes** use light code themes (like GitHub)
- **Dark themes** use dark code themes (like Dracula)  
- **Colorful themes** use vibrant code themes (like Synthwave84)

## JavaScript Example

```javascript
// Local Recording Audio Processor Example
class LocalRecordingAudioProcessor extends AudioProcessor {
  constructor(port, options) {
    super(port, options);
    this.recordedData = [];
    this.isRecording = false;
    this.sampleRate = 48000;
    this.numChannels = 2;
    this.audioFormat = "wav";
  }

  process(inputs, outputs, parameters) {
    if (!this.isRecording || this.numChannels === 0) {
      return true;
    }

    const inputChannels = inputs[0];
    const outputChannels = outputs[0];
    
    // Pass-through audio
    for (let ch = 0; ch < inputChannels.length; ch++) {
      outputChannels[ch].set(inputChannels[ch]);
    }

    // Store audio data for recording
    if (inputChannels[0] && inputChannels[0].length > 0) {
      const audioData = new Float32Array(inputChannels[0]);
      this.recordedData.push([audioData]);
    }

    return true;
  }
}

registerProcessor("local_recording_audio_processor", LocalRecordingAudioProcessor);
```

## Python Example

```python
# Audio processing with Python
import numpy as np
from scipy.signal import butter, filtfilt

class AudioProcessor:
    def __init__(self, sample_rate=48000):
        self.sample_rate = sample_rate
        self.buffer = []
    
    def apply_filter(self, data, cutoff_freq=1000):
        """Apply a low-pass filter to audio data"""
        nyquist = self.sample_rate / 2
        normal_cutoff = cutoff_freq / nyquist
        b, a = butter(6, normal_cutoff, btype='low', analog=False)
        filtered_data = filtfilt(b, a, data)
        return filtered_data
    
    def process_chunk(self, audio_chunk):
        """Process a chunk of audio data"""
        # Apply noise reduction
        filtered = self.apply_filter(audio_chunk)
        
        # Normalize audio levels
        max_val = np.max(np.abs(filtered))
        if max_val > 0:
            normalized = filtered / max_val
        else:
            normalized = filtered
            
        return normalized

# Usage example
processor = AudioProcessor(sample_rate=48000)
processed_audio = processor.process_chunk(raw_audio_data)
```

## CSS Styling

```css
/* Theme-aware styling for markdown content */
.markdown-content {
  --primary-color: #3b82f6;
  --background-color: #ffffff;
  --text-color: #374151;
  --border-color: #e5e7eb;
}

.markdown-content.dark-theme {
  --primary-color: #60a5fa;
  --background-color: #111827;
  --text-color: #d1d5db;
  --border-color: #374151;
}

.code-block {
  background: var(--background-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  overflow-x: auto;
}

.syntax-highlight {
  transition: all 0.3s ease;
}

/* Responsive design */
@media (max-width: 768px) {
  .code-block {
    font-size: 12px;
    padding: 12px;
  }
}
```

## HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Audio Processor Demo</title>
    <style>
        .processor-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .waveform {
            width: 100%;
            height: 200px;
            background: #000;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="processor-container">
        <h1>Local Recording Processor</h1>
        
        <div class="controls">
            <button id="startBtn">Start Recording</button>
            <button id="stopBtn">Stop Recording</button>
            <button id="playBtn">Play</button>
            <button id="downloadBtn">Download</button>
        </div>
        
        <canvas class="waveform" id="waveform"></canvas>
        
        <div class="parameters">
            <label>Sample Rate:
                <select id="sampleRate">
                    <option value="44100">44.1 kHz</option>
                    <option value="48000" selected>48 kHz</option>
                    <option value="96000">96 kHz</option>
                </select>
            </label>
            
            <label>Format:
                <select id="format">
                    <option value="wav">WAV</option>
                    <option value="mp3">MP3</option>
                    <option value="pcm">PCM</option>
                </select>
            </label>
        </div>
    </div>
    
    <script src="audio-processor.js"></script>
</body>
</html>
```

## JSON Configuration

```json
{
  "processorConfig": {
    "name": "local-recording-processor",
    "version": "1.0.0",
    "description": "Real-time audio recording with multiple format support",
    "parameters": {
      "sampleRate": {
        "type": "number",
        "default": 48000,
        "options": [44100, 48000, 96000],
        "description": "Audio sample rate in Hz"
      },
      "numChannels": {
        "type": "number", 
        "default": 2,
        "min": 1,
        "max": 8,
        "description": "Number of audio channels"
      },
      "audioFormat": {
        "type": "string",
        "default": "wav",
        "options": ["wav", "mp3", "pcm"],
        "description": "Output audio format"
      },
      "volumeThreshold": {
        "type": "number",
        "default": 0.1,
        "min": 0.0,
        "max": 1.0,
        "step": 0.01,
        "description": "Minimum volume threshold for recording"
      }
    },
    "features": [
      "Real-time recording",
      "Multiple formats (WAV/MP3/PCM)",
      "Configurable sample rate", 
      "Multi-channel support"
    ],
    "compatibility": {
      "browsers": ["Chrome", "Firefox", "Safari", "Edge"],
      "audioWorklet": true,
      "webAudio": true
    }
  }
}
```

## Theme Testing

Try switching between different themes using the theme selector in the toolbar above:

### Light Themes
- **Default**: Clean minimal theme with GitHub code highlighting
- **GitHub**: GitHub-style documentation with light code themes
- **Material**: Google Material Design with VS Code light theme

### Dark Themes  
- **Dark**: Elegant dark theme with Dracula code highlighting
- **Terminal**: Retro terminal style with Okaidia code theme

### Colorful Themes
- **Synthwave**: 80s retro aesthetic with Synthwave84 code highlighting

Notice how the code blocks automatically switch to appropriate themes:
- Light themes → Light code syntax highlighting
- Dark themes → Dark code syntax highlighting  
- Colorful themes → Vibrant code syntax highlighting

## Features Demonstrated

| Theme Category | Code Theme | Background | Text Color |
|----------------|------------|------------|------------|
| Light | GitHub/VS | White/Light | Dark Text |
| Dark | Dracula/Okaidia | Dark/Black | Light Text |
| Colorful | Synthwave84 | Gradient | Vibrant Colors |

The **dynamic code theme switching** ensures optimal readability and visual consistency across all theme combinations!

## Inline Code Examples

Here are some inline code examples: `const processor = new AudioProcessor()`, `npm install @breezystack/lamejs`, and `processor.port.postMessage({command: 'start'})`.

Notice how inline code styling also adapts to the selected theme for perfect visual harmony. 