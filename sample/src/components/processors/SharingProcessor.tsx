import React, { useState } from 'react';
import { Settings, Copy, Share2, Link, Facebook, Twitter, Instagram } from 'lucide-react';

interface SharingProcessorProps {
  id: string;
}

function SharingProcessor({ id }: SharingProcessorProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [embedCode, setEmbedCode] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const platforms = [
    { id: 'facebook', name: 'Facebook', icon: Facebook },
    { id: 'twitter', name: 'Twitter', icon: Twitter },
    { id: 'instagram', name: 'Instagram', icon: Instagram },
  ];

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Share Settings */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Share Settings</h2>
          <button className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share URL
            </label>
            <div className="flex">
              <input
                type="text"
                value={shareUrl}
                onChange={(e) => setShareUrl(e.target.value)}
                placeholder="Enter share URL"
                className="flex-1 rounded-l-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-r-lg border border-l-0 border-gray-300">
                <Copy className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Embed Code
            </label>
            <div className="flex">
              <textarea
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder="Enter embed code"
                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 min-h-[100px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Platform Selection */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Platforms</h2>
        <div className="grid grid-cols-1 gap-4">
          {platforms.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              onClick={() => togglePlatform(id)}
              className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                selectedPlatforms.includes(id)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className="w-6 h-6" />
                <span className="font-medium">{name}</span>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 ${
                selectedPlatforms.includes(id)
                  ? 'border-white bg-white/30'
                  : 'border-gray-400'
              }`}>
                {selectedPlatforms.includes(id) && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8">
          <button className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-200 transition-all duration-300">
            Share Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default SharingProcessor;