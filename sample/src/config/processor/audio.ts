import {
  Binary,
  Share,
  Gauge,
  Radio,
  Wifi,
  Speech,
  AudioLines,
  Mic,
  Save,
  Settings,
  Volume2,
  ArrowRight,
  Waves,
  Brain,
  FileText,
  Zap,
} from "lucide-react";
import BypassAudio from "../../components/parameters/BypassAudio";
import AudioClassification from "../../components/parameters/AudioClassification";
import SpeechToText from "../../components/parameters/SpeechToText";
import { ProcessorConfig } from "../../index-types";
import LocalRecording from "../../components/parameters/LocalRecording";
import PitchShiftAudioProcessor from "../../components/parameters/PitchShiftAudioProcessor";

const audioConfig: Record<string, ProcessorConfig> = {
  "bypass-audio-processor": {
    id: "bypass-audio-processor",
    url: window.origin + "/bypass-audio-processor.js",
    options: {},
    render: BypassAudio,
    name: "Bypass Audio Processor",
    description:
      "A basic processor where audio is passed through the processor but nothing changes.",
    features: [
      { icon: ArrowRight, text: "Pass-through audio" },
      { icon: Volume2, text: "Zero latency" },
      { icon: Waves, text: "Audio visualization" },
      { icon: Settings, text: "Debug monitoring" },
    ],
    implementation: {
      setup: `// No additional dependencies required`,
      usage: `const processor = stream.createProcessor({
  url: '/bypass-audio-processor.js',
  name: 'bypass-audio-processor',
  type: 'audio'
});`,
    },
    // isInDevelopment: true,
  },
  // ... other audio processors remain the same
  "audio-classification-processor": {
    id: "audio-classification-processor",
    url: window.origin + "/audio-classification-processor.js",
    options: {},
    render: AudioClassification,
    name: "Audio Classification Processor",
    description: "Categorize audio clips into a series of defined categories.",
    features: [
      { icon: Brain, text: "MediaPipe YAMNet model" },
      { icon: Waves, text: "Real-time classification" },
      { icon: Gauge, text: "Confidence scoring" },
      { icon: Volume2, text: "Volume analysis" },
    ],
    implementation: {
      setup: `npm install @mediapipe/tasks-audio`,
      usage: `const processor = stream.createProcessor({
  url: '/audio-classification-processor.js',
  name: 'audio-classification-processor',
  type: 'audio'
});

processor.port.postMessage({ cmd: 'start_classification' });`,
      example: `// Listen for classification results
processor.port.addEventListener('message', (event) => {
  if (event.data.cmd === 'audio_data') {
    console.log('Audio classified:', event.data);
  }
});`,
    },
    isInDevelopment: true,
  },
  "speech-to-text-processor": {
    id: "speech-to-text-processor",
    url: window.origin + "/speech-to-text-processor.js",
    options: {},
    render: SpeechToText,
    name: "Speech-to-Text Processor",
    description: "Convert real-time audio stream to text",
    features: [
      { icon: Speech, text: "AssemblyAI API" },
      { icon: FileText, text: "Real-time transcription" },
      { icon: Zap, text: "Low latency streaming" },
      { icon: AudioLines, text: "Audio preprocessing" },
    ],
    implementation: {
      setup: `npm install assemblyai`,
      usage: `const processor = stream.createProcessor({
  url: '/speech-to-text-processor.js',
  name: 'speech-to-text-processor',
  type: 'audio',
  options: {
    apiKey: 'your-assemblyai-api-key'
  }
});

processor.port.postMessage({
  cmd: 'start_transcription',
  data: { apiKey: 'your-api-key' }
});`,
      example: `// Listen for transcription results
processor.port.addEventListener('message', (event) => {
  if (event.data.cmd === 'transcription_result') {
    console.log('Transcript:', event.data.text);
  }
});`,
    },
    isInDevelopment: true,
  },
  "local-recording-processor": {
    id: "local-recording-processor",
    url: window.origin + "/local_recording_processor.js",
    options: {},
    render: LocalRecording,
    name: "Local Recording Processor",
    description:
      "Record audio from the local microphone and send it to the server.",
    features: [
      { icon: Mic, text: "Real-time recording" },
      { icon: Save, text: "Multiple formats (WAV/MP3/PCM)" },
      { icon: Settings, text: "Configurable sample rate" },
      { icon: Volume2, text: "Multi-channel support" },
    ],
    implementation: {
      setup: `npm install @breezystack/lamejs`,
      usage: `const processor = stream.createProcessor({
  url: '/local_recording_processor.js',
  name: 'local_recording_audio_processor',
  type: 'audio'
});

processor.port.postMessage({
  command: 'start',
  config: {
    sampleRate: 48000,
    numChannels: 2,
    audioFormat: 'wav'
  }
});`,
    },
    isInDevelopment: false,
  },
  "pitch-shift-processor": {
    id: "pitch-shift-processor",
    url: window.origin + "/pitch-shift-audio-processor.js",
    options: {},
    render: PitchShiftAudioProcessor,
    name: "Pitch Shift Audio Processor",
    description:
      "Record audio from the local microphone and send it to the server.",
    features: [
      { icon: Radio, text: "Perceptual audio coding" },
      { icon: Share, text: "Multi-channel support" },
      { icon: Gauge, text: "Variable bit rate encoding" },
      { icon: Binary, text: "Spectral band replication" },
    ],
    implementation: {
      setup: `npm install @media/aac-encoder`,
      usage: ``,
    },
    isInDevelopment: false,
  },
};

export default audioConfig;
