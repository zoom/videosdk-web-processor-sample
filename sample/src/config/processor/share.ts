import {
  Box,
  Binary,
  Share,
  BarChart,
  Link2,
  Lock,
  Layout,
  Eye,
  Shield,
  Edit,
} from "lucide-react";
import { ProcessorConfig } from "../../index-types";
import PiiMaskProcessor from "../../components/parameters/PiiMaskProcessor";

const baseUrl = window.origin;

const shareConfig: Record<string, ProcessorConfig> = {
  "pii-masking-share-processor": {
    id: 'pii-masking-share-processor',
    url: baseUrl + '/pii-masking-share-processor.js',
    options: {
      blurRegionNorm: {
        x: 0.2,
        y: 0.2,
        width: 0.6,
        height: 0.6,
      },
      blurRadius: 10,
    },
    render: PiiMaskProcessor,
    name: "PII Mask Share Processor",
    description: "Mask the PII data in the share stream.",
    features: [
      { icon: Eye, text: "Real-time preview and masking" },
      { icon: Edit, text: "Editable masking region" },
      { icon: Lock, text: "Privacy information protection" },
    ],
    implementation: {},
  },
};

export default shareConfig;
