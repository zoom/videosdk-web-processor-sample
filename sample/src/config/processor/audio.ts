import { Binary, Share, Gauge, Radio, Wifi } from "lucide-react";
import BypassAudio from "../../components/parameters/BypassAudio";
import AudioClassification from "../../components/parameters/AudioClassification";
import TextToSpeech from "../../components/parameters/TextToSpeech";
import { ProcessorConfig } from "../../index-types";

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
  "text-to-speech-processor": {
    id: "text-to-speech-processor",
    url: window.origin + "/text-to-speech-processor.js",
    options: {},
    render: TextToSpeech,
    name: "Text-to-Speech Processor",
    description: "Convert real-time audio stream to text",
    features: [
      { icon: Wifi, text: "Low-latency processing" },
      { icon: Gauge, text: "Adaptive bit rate" },
      { icon: Radio, text: "Speech and music optimization" },
      { icon: Binary, text: "Error resilience" },
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
};

export default audioConfig;
