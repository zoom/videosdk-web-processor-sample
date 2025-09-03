# Audio Classification Processor

A real-time audio classification processor powered by MediaPipe's YAMNet model that can detect and classify various audio categories including speech, music, background noise, and environmental sounds.

## Overview

The **Audio Classification Processor** is designed as a:

- 🧠 **AI-powered** real-time audio analyzer
- 🎯 **Multi-category** sound classification system
- 📊 **Live monitoring** tool for audio content
- 🔧 **Integration-ready** component for smart applications

## Features

### Core Capabilities

- **Real-time classification** with sub-second latency
- **500+ audio categories** support via YAMNet model
- **Confidence scoring** for classification accuracy
- **Audio visualization** with live waveform display
- **Volume monitoring** with real-time level detection
- **Debounced updates** for stable classification results

### Technical Specifications

| Specification | Value | Notes |
|---------------|--------|-------|
| Processing Delay | ~500ms | Classification interval |
| Categories | 500+ | YAMNet model classes |
| Audio Buffer | 1 second | Required for classification |
| Sample Rate | 48kHz | Fixed requirement |
| CPU Usage | ~5-15% | Model dependent |
| Memory | ~50MB | Model + buffers |

### Supported Audio Categories

- **Speech & Voice**: Human speech, singing, conversation
- **Music**: Various instruments, genres, and musical elements  
- **Environmental**: Traffic, nature sounds, machinery
- **Animals**: Dogs, cats, birds, and other animal sounds
- **Household**: Appliances, tools, domestic activities
- **And many more...** (500+ total categories)

## Quick Start

### Basic Implementation

```javascript
import { ZoomVideo } from '@zoom/videosdk';

// Create audio stream
const stream = ZoomVideo.createAudioStream();

// Add audio classification processor
const processor = stream.createProcessor({
  url: '/audio-classification-processor.js',
  name: 'audio-classification-processor',
  type: 'audio',
  options: {
    modelUrl: 'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite',
    confidenceThreshold: 0.3,
    debounceMs: 500
  }
});

await stream.addProcessor(processor);
await stream.startAudio();
```

### Listen for Classification Results

```javascript
processor.port.addEventListener('message', (event) => {
  if (event.data.cmd === 'audio_data') {
    console.log('Audio Data:', event.data.audioData);
  }
});

// In your component, handle classification updates
const [classification, setClassification] = useState('');
const [confidence, setConfidence] = useState(0);

// Classification results are automatically updated via the component state
```

## Configuration Options

### Available Parameters

- `modelUrl` (string): YAMNet model URL (optional, uses default CDN)
- `confidenceThreshold` (number): Minimum confidence for classification (0-1)
- `debounceMs` (number): Debounce interval for classification updates
- `bufferSize` (number): Audio buffer size for classification
- `enableVisualization` (boolean): Enable waveform visualization

### Example Configuration

```javascript
const options = {
  modelUrl: 'https://custom-model-url/yamnet.tflite',
  confidenceThreshold: 0.5,  // Higher threshold for more confident results
  debounceMs: 300,           // Faster updates
  bufferSize: 48000,         // 1 second at 48kHz
  enableVisualization: true
};
```

## Use Cases

### 1. Content Moderation

Automatically detect and filter inappropriate audio content:

```javascript
processor.port.addEventListener('message', (event) => {
  const { classification, confidence } = event.data;
  
  if (classification === 'profanity' && confidence > 0.7) {
    // Mute or flag content
    stream.muteAudio();
  }
});
```

### 2. Smart Meeting Features

Enhance video calls with context-aware features:

- **Music Detection**: Auto-adjust audio processing for music
- **Speech Recognition**: Optimize for voice communication
- **Background Noise**: Apply noise suppression selectively

### 3. Accessibility Features

Provide audio context for hearing-impaired users:

```javascript
function updateAccessibilityDescription(classification, confidence) {
  const description = `Audio: ${classification} (${Math.round(confidence * 100)}% confidence)`;
  document.getElementById('audio-description').textContent = description;
}
```

### 4. Analytics & Monitoring

Track audio content patterns:

- Meeting analysis (speech vs. silence ratio)
- Music streaming categorization
- Environmental audio monitoring

## Audio Classification Flow

The processor follows this classification pipeline:

1. **Capture** real-time audio input
2. **Buffer** audio data (1-second windows)
3. **Process** through YAMNet model
4. **Extract** top classification categories
5. **Apply** confidence filtering
6. **Debounce** rapid classification changes
7. **Emit** stable classification results

```javascript
// Simplified classification logic
async function classifyAudio(audioBuffer) {
  // Accumulate 1 second of audio data
  const combinedBuffer = combineAudioBuffers(audioBuffer);
  
  // Run through YAMNet model
  const result = await audioClassifier.classify(combinedBuffer, 48000);
  
  // Extract top category
  const topCategory = result[0].classifications[0].categories[0];
  
  // Apply debouncing
  if (topCategory.score > confidenceThreshold) {
    debouncedUpdate(topCategory.categoryName, topCategory.score);
  }
}
```

## Component Integration

### React Component Usage

```jsx
import AudioClassification from './components/AudioClassification';

function MyApp() {
  return (
    <div>
      {/* Audio classification with device selection */}
      <AudioClassification processor={audioProcessor} />
    </div>
  );
}
```

### Key Component Features

- **Device Selection**: Choose microphone and speaker
- **Real-time Visualization**: Live audio waveform
- **Classification Display**: Current category and confidence
- **Volume Meter**: Audio level monitoring
- **Loading States**: Model initialization feedback

## Troubleshooting

### Common Issues

**Classification not working:**
- Verify model URL is accessible
- Check browser CORS policies
- Ensure microphone permissions granted
- Confirm audio input is active

**Poor classification accuracy:**
- Increase confidence threshold
- Reduce background noise
- Ensure clear audio input
- Check microphone quality

**High CPU usage:**
- Increase debounce interval
- Reduce classification frequency
- Consider using lighter models
- Monitor browser performance

**Model loading fails:**
- Check network connectivity
- Verify model URL accessibility
- Try alternative CDN sources
- Enable CORS headers

### Debug Mode

Enable detailed logging for troubleshooting:

```javascript
// Enable debug in AudioClassification component
const [error, setError] = useState(null);

// Monitor classification errors
if (error) {
  console.error('Classification error:', error);
}
```

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Recommended, best WebAssembly support |
| Firefox | ✅ Full | Good performance with MediaPipe |
| Safari | ⚠️ Limited | WebAssembly restrictions may apply |
| Edge | ✅ Full | Chrome-based, full compatibility |

### Requirements

- **WebAssembly support** (for MediaPipe)
- **Web Audio API** compatibility
- **Microphone access** permissions
- **Modern JavaScript** (ES2020+)

## Performance Optimization

### Tips for Better Performance

1. **Adjust Buffer Size**: Larger buffers = less frequent processing
2. **Tune Confidence Threshold**: Higher threshold = fewer updates
3. **Optimize Debounce**: Balance responsiveness vs. stability
4. **Monitor Memory**: Clear old audio buffers regularly

### Resource Management

```javascript
// Cleanup when component unmounts
useEffect(() => {
  return () => {
    if (audioClassifierRef.current) {
      audioClassifierRef.current.close();
    }
    // Clear timeouts and intervals
    clearInterval(classificationInterval);
  };
}, []);
```

---

## Next Steps

After implementing audio classification:

1. **Customize** classification categories for your use case
2. **Integrate** with other audio processors
3. **Build** smart audio features based on classification
4. **Optimize** performance for production deployment

## Resources

- [MediaPipe Audio Classification](https://developers.google.com/mediapipe/solutions/audio/audio_classifier)
- [YAMNet Model Documentation](https://tfhub.dev/google/yamnet/1)
- [Web Audio API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Zoom Video SDK Audio Processors](https://developers.zoom.us/docs/video-sdk/web/audio-processors/)
- [Sample Code Repository](https://github.com/zoom/videosdk-samples)
