import React, { useState } from "react";
import {
  Video,
  AudioLines,
  Share2,
  Play,
  Volume2,
  Link,
  Speech,
  Waves,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type Processor = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  isInDevelopment?: boolean; // 新增开发状态标志
};

const videoProcessors: Processor[] = [
  {
    id: "zoom-dual-mask-video-processor",
    name: "Dual Mask",
    description:
      "Detect the face region in the video source and show it, other regions will be covered by the background image.",
    icon: <Video className="w-6 h-6" />,
    isInDevelopment: false,
  },
  {
    id: "watermark-processor",
    name: "Watermark Effect",
    description:
      "Add text similar to a watermark effect to the video source and send it to other attendees.",
    icon: <Waves className="w-6 h-6" />,
    isInDevelopment: false,
  },
];

const audioProcessors: Processor[] = [
  {
    id: "bypass-audio-processor",
    name: "Bypass Audio Processor",
    description:
      "A basic processor where audio is passed through the processor but nothing changes.",
    icon: <Volume2 className="w-6 h-6" />,
    // isInDevelopment: true,
  },
  {
    id: "audio-classification-processor",
    name: "Audio Classification Processor",
    description: "Categorize audio clips into a series of defined categories.",
    icon: <AudioLines className="w-6 h-6" />,
    // isInDevelopment: true,
  },
  {
    id: "speech-to-text-processor",
    name: "Speech-to-Text Processor",
    description: "Convert real-time audio stream to text",
    icon: <Speech className="w-6 h-6" />,
    // isInDevelopment: true,
  },
];

const sharingProcessors: Processor[] = [
  {
    id: "social-media-share",
    name: "Social Media Share",
    description: "Direct integration with major social platforms",
    icon: <Share2 className="w-6 h-6" />,
    isInDevelopment: true,
  },
  {
    id: "link-generator",
    name: "Link Generator",
    description: "Create shareable links with custom parameters",
    icon: <Link className="w-6 h-6" />,
    isInDevelopment: true,
  },
  {
    id: "embed-code",
    name: "Embed Code",
    description: "Generate embed codes for websites and platforms",
    icon: <Share2 className="w-6 h-6" />,
    isInDevelopment: true,
  },
];

type Tab = "video" | "audio" | "sharing";

function MediaProcessors() {
  const [activeTab, setActiveTab] = useState<Tab>("video");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const navigate = useNavigate();

  const getProcessors = (tab: Tab) => {
    switch (tab) {
      case "video":
        return videoProcessors;
      case "audio":
        return audioProcessors;
      case "sharing":
        return sharingProcessors;
    }
  };

  const handleLearnMore = (processor: Processor) => {
    if (processor.isInDevelopment) {
      alert(
        `${processor.name} is currently under development. Please check back later!`
      );
      return;
    }
    navigate(`/processor/${activeTab}/${processor.id}`);
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage:
          'url("https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?auto=format&fit=crop&q=80")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-white bg-opacity-95"></div>

      <div className="relative z-10 container mx-auto px-4 py-12">
        <h1 className="text-6xl font-bold text-center mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500">
          Media Processors
        </h1>
        <p className="text-xl text-gray-600 text-center mb-12 max-w-2xl mx-auto">
          Choose the powerful media processing tools to transform your content
        </p>

        {/* Tabs */}
        <div className="flex justify-center space-x-4 mb-12">
          {[
            { id: "video", icon: Video, label: "Video" },
            { id: "audio", icon: AudioLines, label: "Audio" },
            { id: "sharing", icon: Share2, label: "Sharing" },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as Tab)}
              className={`flex items-center space-x-2 px-8 py-4 rounded-xl transition-all duration-300 transform ${
                activeTab === id
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white scale-105 shadow-lg shadow-blue-200"
                  : "bg-white hover:bg-gray-50 text-gray-700 hover:scale-105 shadow-md"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${activeTab === id ? "animate-pulse" : ""}`}
              />
              <span className="font-semibold">{label}</span>
            </button>
          ))}
        </div>

        {/* Processors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {getProcessors(activeTab).map((processor) => (
            <div
              key={processor.id}
              onMouseEnter={() => setHoveredCard(processor.id)}
              onMouseLeave={() => setHoveredCard(null)}
              className="relative group"
            >
              {/* Glow Effect */}
              <div
                className={`absolute inset-0 bg-gradient-to-r from-blue-200 to-purple-200 rounded-2xl blur transition-opacity duration-300 ${
                  hoveredCard === processor.id ? "opacity-70" : "opacity-0"
                }`}
              />

              {/* Card Content */}
              <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-8 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl border border-gray-100 flex flex-col h-[320px]">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl transform transition-transform group-hover:scale-110 group-hover:rotate-3">
                    {processor.icon}
                  </div>
                  <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">
                    {processor.name}
                  </h3>
                </div>
                <div className="flex-1 mb-6">
                  <p className="text-gray-600 text-lg line-clamp-3">
                    {processor.description}
                  </p>
                </div>
                <button
                  onClick={() => handleLearnMore(processor)}
                  className={`w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:shadow-lg hover:shadow-blue-200 hover:scale-105 ${
                    processor.isInDevelopment ? "opacity-75" : ""
                  }`}
                >
                  {processor.isInDevelopment ? "Coming Soon" : "Learn More"}
                </button>
                {processor.isInDevelopment && (
                  <span className="absolute top-4 right-4 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    In Development
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MediaProcessors;
