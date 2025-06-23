import React, { useContext, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, BookOpen, Code, FileCode, Terminal, Globe, Smartphone, Monitor, Edit3 } from "lucide-react";
import VideoProcessor from "./processors/VideoProcessor";
import AudioProcessor from "./processors/AudioProcessor";
import SharingProcessor from "./processors/SharingProcessor";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";
import processorConfig from "../config/processor";
import MarkdownRenderer from "./MarkdownRenderer";
import MarkdownEditor from "./MarkdownEditor";
import { useMarkdownLoader } from "../hooks/useMarkdownLoader";
import { saveMarkdownFile } from "../utils/markdownApi";

function ProcessorDetail() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"preview" | "howto" | "edit">("preview");
  const [isEditing, setIsEditing] = useState(false);

  const details =
    type && id
      ? processorConfig[type as keyof typeof processorConfig]?.[id]
      : null;

  // Load markdown documentation
  const { content: markdownContent, loading: markdownLoading, error: markdownError, version: markdownVersion, source: markdownSource } = 
    useMarkdownLoader(type || '', id || '');

  // Handle saving markdown
  const handleSaveMarkdown = async (content: string) => {
    if (!type || !id) return;
    
    const result = await saveMarkdownFile({
      processorType: type,
      processorId: id,
      content: content
    });
    
    if (result.success) {
      console.log('Markdown saved successfully:', result.message);
      // Optionally show a success notification
    } else {
      console.error('Failed to save markdown:', result.message);
      // Show error notification
      throw new Error(result.message);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setActiveTab("howto");
  };

  // Handle back navigation with tab state preservation
  const handleBackToProcessors = () => {
    navigate(`/processors?tab=${type}`);
  };

  // Handle resetting to original version
  const handleResetToOriginal = async () => {
    if (!type || !id) return;
    
    if (!window.confirm('Are you sure you want to reset to the original version? This will discard all modifications.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/docs/reset/${type}/${id}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Reset to original version successfully!');
        // Reload the page to show original content
        window.location.reload();
      } else {
        throw new Error('Failed to reset to original version');
      }
    } catch (error) {
      console.error('Reset failed:', error);
      alert('Failed to reset to original version. Please try again.');
    }
  };

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
              onClick={handleBackToProcessors}
              className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Processors
            </button>
          </div>
          <div className="py-8">
            <div className="flex items-center gap-4 mb-4">
              <h1 className="text-4xl font-bold text-white">
                {details.name}
              </h1>
              {details.platforms && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 inline-flex items-center space-x-2">
                  {details.platforms.map(({ icon: Icon }, index) => (
                    <Icon key={index} className="w-4 h-4 text-white/70" />
                  ))}
                </div>
              )}
            </div>
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
                <Eye className="w-4 h-4" />
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
                <BookOpen className="w-4 h-4" />
                <span>How to Use</span>
              </div>
              {activeTab === "howto" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            {/* Edit Documentation tab temporarily disabled - will be available for admin users only */}
            {/* 
            <button
              onClick={() => {
                setActiveTab("edit");
                setIsEditing(true);
              }}
              className={`px-6 py-3 font-medium text-sm transition-colors relative ${
                activeTab === "edit"
                  ? "text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="flex items-center space-x-2">
                <Edit3 className="w-4 h-4" />
                <span>Edit Documentation</span>
              </div>
              {activeTab === "edit" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
              )}
            </button>
            */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === "preview" ? (
          renderProcessor()
        ) : activeTab === "edit" && isEditing ? (
          <MarkdownEditor
            initialContent={markdownContent || '# New Documentation\n\nStart writing your documentation here...'}
            processorType={type || ''}
            processorId={id || ''}
            onSave={handleSaveMarkdown}
            onCancel={handleCancelEdit}
            enableAutoSave={true}
            autoSaveInterval={30000}
          />
        ) : (
          <MarkdownRenderer
            content={markdownContent}
            loading={markdownLoading}
            error={markdownError}
            enableToc={true}
            enableSearch={true}
            enableImageZoom={true}
            enableFootnotes={true}
            enableThemes={true}
            defaultTheme="default"
            fallbackContent={
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
            }
          />
        )}
      </div>
    </div>
  );
}

export default ProcessorDetail;
