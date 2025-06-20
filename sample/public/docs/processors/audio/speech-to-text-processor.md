# Speech-to-Text Audio Processor

The **Speech-to-Text Audio Processor** provides real-time speech transcription capabilities using AssemblyAI's powerful speech recognition API. This processor captures audio streams and converts spoken words into text with high accuracy and low latency.

## Features

- **Real-time transcription** with streaming audio processing
- **High accuracy** speech recognition powered by AssemblyAI
- **Multiple language support** for global applications
- **Custom vocabulary** and domain-specific terminology
- **Speaker diarization** to identify different speakers
- **Punctuation and formatting** for readable transcripts

## Prerequisites

Before using this processor, you'll need:

1. **AssemblyAI API Key** - Sign up at [AssemblyAI](https://www.assemblyai.com/)
2. **Audio permissions** in the browser
3. **Stable internet connection** for API calls

## Installation

```bash
# Install required dependencies
npm install @zoom/videosdk assemblyai

# Set up environment variables
ASSEMBLYAI_API_KEY=your_api_key_here
```

## Basic Usage

Here's how to implement the Speech-to-Text processor:

```javascript
import { ZoomVideo } from '@zoom/videosdk';

// Initialize audio stream
const stream = ZoomVideo.createAudioStream();

// Create the speech-to-text processor
const processor = stream.createProcessor({
  url: '/speech-to-text-processor.js',
  name: 'speech-to-text-processor',
  type: 'audio',
  options: {
    apiKey: 'your-assemblyai-api-key',
    language: 'en',
    enableRealTime: true,
    punctuate: true,
    formatText: true
  }
});

// Add processor to stream
await stream.addProcessor(processor);

// Listen for transcription results
processor.port.addEventListener('message', (event) => {
  if (event.data.type === 'transcription') {
    console.log('Transcription:', event.data.text);
    console.log('Confidence:', event.data.confidence);
  }
});

// Start audio processing
await stream.startAudio();
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | Required | Your AssemblyAI API key |
| `language` | string | 'en' | Language code for transcription |
| `enableRealTime` | boolean | true | Enable real-time streaming transcription |
| `punctuate` | boolean | true | Add punctuation to transcripts |
| `formatText` | boolean | true | Format text with proper capitalization |
| `enableSpeakerLabels` | boolean | false | Enable speaker diarization |
| `speakersExpected` | number | null | Expected number of speakers |
| `customVocabulary` | string[] | [] | Custom words for better recognition |

## Advanced Configuration

### Custom Vocabulary

Improve accuracy for domain-specific terms:

```javascript
const processor = stream.createProcessor({
  // ... other options
  options: {
    apiKey: 'your-api-key',
    customVocabulary: [
      'Zoom VideoSDK',
      'WebRTC',
      'MediaProcessor',
      'AssemblyAI'
    ]
  }
});
```

### Speaker Diarization

Identify different speakers in the conversation:

```javascript
const processor = stream.createProcessor({
  // ... other options
  options: {
    apiKey: 'your-api-key',
    enableSpeakerLabels: true,
    speakersExpected: 2
  }
});

processor.port.addEventListener('message', (event) => {
  if (event.data.type === 'transcription') {
    console.log(`Speaker ${event.data.speaker}: ${event.data.text}`);
  }
});
```

## Event Handling

The processor emits various events during transcription:

```javascript
processor.port.addEventListener('message', (event) => {
  switch (event.data.type) {
    case 'transcription':
      // Final transcription result
      handleTranscription(event.data);
      break;
      
    case 'partial_transcript':
      // Interim results while speaking
      handlePartialTranscript(event.data);
      break;
      
    case 'session_begins':
      console.log('Transcription session started');
      break;
      
    case 'session_terminated':
      console.log('Transcription session ended');
      break;
      
    case 'error':
      console.error('Transcription error:', event.data.error);
      break;
  }
});

function handleTranscription(data) {
  const transcript = {
    text: data.text,
    confidence: data.confidence,
    timestamp: data.created,
    speaker: data.speaker || 'Unknown'
  };
  
  // Process the final transcript
  displayTranscript(transcript);
}

function handlePartialTranscript(data) {
  // Show interim results for better UX
  updateLiveTranscript(data.text);
}
```

## React Integration Example

Here's a complete React component that uses the Speech-to-Text processor:

```javascript
import React, { useState, useEffect, useRef } from 'react';
import { ZoomVideo } from '@zoom/videosdk';

function SpeechToTextComponent() {
  const [transcripts, setTranscripts] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const streamRef = useRef(null);
  const processorRef = useRef(null);

  useEffect(() => {
    const initializeProcessor = async () => {
      try {
        const stream = ZoomVideo.createAudioStream();
        streamRef.current = stream;

        const processor = stream.createProcessor({
          url: '/speech-to-text-processor.js',
          name: 'speech-to-text-processor',
          type: 'audio',
          options: {
            apiKey: process.env.REACT_APP_ASSEMBLYAI_API_KEY,
            language: 'en',
            enableRealTime: true,
            punctuate: true
          }
        });
        processorRef.current = processor;

        // Listen for transcription events
        processor.port.addEventListener('message', handleProcessorMessage);

        await stream.addProcessor(processor);
      } catch (error) {
        console.error('Failed to initialize speech-to-text:', error);
      }
    };

    initializeProcessor();

    return () => {
      stopListening();
    };
  }, []);

  const handleProcessorMessage = (event) => {
    switch (event.data.type) {
      case 'transcription':
        setTranscripts(prev => [...prev, {
          id: Date.now(),
          text: event.data.text,
          confidence: event.data.confidence,
          timestamp: new Date()
        }]);
        setCurrentText('');
        break;
        
      case 'partial_transcript':
        setCurrentText(event.data.text);
        break;
    }
  };

  const startListening = async () => {
    if (streamRef.current) {
      await streamRef.current.startAudio();
      setIsListening(true);
    }
  };

  const stopListening = async () => {
    if (streamRef.current) {
      await streamRef.current.stopAudio();
      setIsListening(false);
    }
  };

  return (
    <div className="speech-to-text-container">
      <div className="controls">
        <button 
          onClick={isListening ? stopListening : startListening}
          className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
        >
          {isListening ? 'Stop Listening' : 'Start Listening'}
        </button>
      </div>

      <div className="live-transcript">
        <h3>Live Transcript:</h3>
        <p className="current-text">{currentText}</p>
      </div>

      <div className="transcript-history">
        <h3>Transcript History:</h3>
        {transcripts.map(transcript => (
          <div key={transcript.id} className="transcript-item">
            <div className="transcript-text">{transcript.text}</div>
            <div className="transcript-meta">
              Confidence: {(transcript.confidence * 100).toFixed(1)}% | 
              Time: {transcript.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SpeechToTextComponent;
```

## Error Handling

Common errors and how to handle them:

```javascript
processor.port.addEventListener('message', (event) => {
  if (event.data.type === 'error') {
    switch (event.data.error.code) {
      case 'INVALID_API_KEY':
        console.error('Invalid AssemblyAI API key');
        break;
        
      case 'NETWORK_ERROR':
        console.error('Network connection failed');
        // Implement retry logic
        break;
        
      case 'AUDIO_ERROR':
        console.error('Audio processing error');
        break;
        
      default:
        console.error('Unknown error:', event.data.error);
    }
  }
});
```

## Performance Optimization

### Buffering Strategy

```javascript
const processor = stream.createProcessor({
  // ... other options
  options: {
    apiKey: 'your-api-key',
    bufferSize: 4096,  // Adjust based on requirements
    sampleRate: 16000  // Optimize for speech recognition
  }
});
```

### Connection Management

```javascript
// Implement connection pooling for better performance
const connectionManager = {
  maxConnections: 3,
  activeConnections: 0,
  
  canCreateConnection() {
    return this.activeConnections < this.maxConnections;
  },
  
  createConnection() {
    if (this.canCreateConnection()) {
      this.activeConnections++;
      return true;
    }
    return false;
  },
  
  closeConnection() {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }
};
```

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 70+ | ✅ Full |
| Firefox | 65+ | ✅ Full |
| Safari | 13+ | ⚠️ Limited |
| Edge | 79+ | ✅ Full |

**Note:** Safari has limited WebRTC audio processing capabilities.

## Troubleshooting

### Common Issues

**No transcription results:**
- Verify API key is correct and has sufficient credits
- Check microphone permissions
- Ensure audio input is working

**Poor accuracy:**
- Speak clearly and at moderate pace
- Reduce background noise
- Use custom vocabulary for technical terms

**High latency:**
- Check network connection stability
- Reduce buffer size if acceptable
- Consider using local processing for sensitive applications

## API Limits

AssemblyAI has the following limits:
- **Free tier:** 5 hours of audio per month
- **Rate limits:** 10 concurrent connections
- **File size:** 2GB maximum per upload

Monitor your usage to avoid service interruptions.

## Support Resources

- [AssemblyAI Documentation](https://www.assemblyai.com/docs/)
- [Zoom VideoSDK Audio Guide](https://developers.zoom.us/docs/video-sdk/web/audio/)
- [WebRTC Audio Processing](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) 