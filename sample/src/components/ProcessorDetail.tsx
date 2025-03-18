import React, { useContext, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Code, FileCode, Terminal } from "lucide-react";
import VideoProcessor from "./processors/VideoProcessor";
import AudioProcessor from "./processors/AudioProcessor";
import SharingProcessor from "./processors/SharingProcessor";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";
import processorConfig from "../config/processor";

function ProcessorDetail() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"preview" | "howto">("preview");

  const details =
    type && id
      ? processorConfig[type as keyof typeof processorConfig]?.[id]
      : null;

  const renderProcessor = () => {
    switch (type) {
      case "video":
        return <VideoProcessor id={id!} />;
      case "audio":
        return <AudioProcessor id={id!} />;
      case "sharing":
        return <SharingProcessor id={id!} />;
      default:
        return <div>Invalid processor type</div>;
    }
  };

  if (!details) {
    return <div>Processor not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Combined Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500">
        <div className="container mx-auto px-4">
          <div className="py-4">
            <button
              onClick={() => navigate("/processors")}
              className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Processors
            </button>
          </div>
          <div className="py-8">
            <h1 className="text-4xl font-bold text-white mb-4">
              {details.name}
            </h1>
            <p className="text-xl text-white/90 mb-8">{details.description}</p>
            <div className="flex flex-wrap gap-3">
              {details.features.map(({ icon: Icon, text }, index) => (
                <div
                  key={index}
                  className="bg-black/10 backdrop-blur-sm rounded-lg px-4 py-2 inline-flex items-center space-x-2"
                >
                  <Icon className="w-4 h-4 text-white/70 flex-shrink-0" />
                  <p className="text-sm text-white font-medium whitespace-nowrap">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === "preview"
                  ? "text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Play className="w-4 h-4" />
                <span>Preview</span>
              </div>
              {activeTab === "preview" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("howto")}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === "howto"
                  ? "text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4" />
                <span>How to Use</span>
              </div>
              {activeTab === "howto" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === "preview" ? (
          renderProcessor()
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {details.implementation?.setup && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <Terminal className="w-5 h-5 text-gray-400" />
                  <h2 className="text-xl font-semibold text-gray-800">
                    Installation
                  </h2>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <code className="text-green-400">
                    {details.implementation.setup}
                  </code>
                </div>
              </div>
            )}

            {details.implementation?.usage && (
              <div className="bg-white rounded-2xl shadow-lg p-6 lg:col-span-2">
                <div className="flex items-center space-x-2 mb-6">
                  <Code className="w-5 h-5 text-gray-400" />
                  <h2 className="text-xl font-semibold text-gray-800">
                    Basic Usage
                  </h2>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <SyntaxHighlighter language="javascript" style={dracula}>
                    {details.implementation.usage}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}

            {details.implementation?.example && (
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center space-x-2 mb-6">
                  <FileCode className="w-5 h-5 text-gray-400" />
                  <h2 className="text-xl font-semibold text-gray-800">
                    Example Implementation
                  </h2>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <SyntaxHighlighter language="javascript" style={dracula}>
                    {details.implementation.example}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProcessorDetail;
