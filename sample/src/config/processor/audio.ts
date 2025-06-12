import {
  Binary,
  Share,
  Gauge,
  Radio,
  Wifi,
  Speech,
  AudioLines,
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
      { icon: Radio, text: "Perceptual audio coding" },
      { icon: Share, text: "Multi-channel support" },
      { icon: Gauge, text: "Variable bit rate encoding" },
      { icon: Binary, text: "Spectral band replication" },
    ],
    implementation: {
      setup: `npm install @media/aac-encoder`,
      usage: ``,
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
      { icon: Radio, text: "Psychoacoustic modeling" },
      { icon: Share, text: "Joint stereo encoding" },
      { icon: Gauge, text: "Variable bit rate support" },
      { icon: Binary, text: "ID3 tag handling" },
    ],
    implementation: {
      setup: `npm install @media/mp3-processor`,
      usage: ``,
      example: ``,
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
      { icon: AudioLines, text: "audio pre-processing" },
    ],
    implementation: {
      setup: `npm install @media/opus-codec`,
      usage: `import { OpusCodec } from '@media/opus-codec';

const codec = new OpusCodec({
  mode: 'voip',
  frameSize: 20
});`,
      example: `// Example implementation
import { useOpusCodec } from '@media/opus-codec/react';

function AudioProcessor() {
  const { encode } = useOpusCodec();
  // Implementation details...
}`,
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
