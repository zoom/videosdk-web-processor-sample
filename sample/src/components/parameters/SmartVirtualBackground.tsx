import React, { useState, useRef } from "react";
import { Sparkles, Download, Upload, Wand2 } from "lucide-react";

const SmartVirtualBackground: React.FC = () => {
  const [description, setDescription] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateBackground = async () => {
    if (!description.trim()) return;

    setIsGenerating(true);
    // 模拟AI生成背景的过程
    setTimeout(() => {
      // 这里将来会调用实际的AI生成API
      setGeneratedImage("/images/generated-background-demo.jpg");
      setIsGenerating(false);
    }, 3000);
  };

  const handleUploadBackground = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setGeneratedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI生成背景 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-800">
            AI生成虚拟背景
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              描述你想要的背景
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：现代办公室，柔和的光线，简约风格..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <button
            onClick={handleGenerateBackground}
            disabled={!description.trim() || isGenerating}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {isGenerating ? "生成中..." : "生成背景"}
          </button>
        </div>
      </div>

      {/* 上传背景 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Upload className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-800">
            上传自定义背景
          </h3>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={handleUploadBackground}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Upload className="w-4 h-4 mr-2" />
          选择图片
        </button>
      </div>

      {/* 预览 */}
      {generatedImage && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">背景预览</h3>
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = generatedImage;
                link.download = "virtual-background.jpg";
                link.click();
              }}
              className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-4 h-4 mr-1" />
              下载
            </button>
          </div>

          <div className="relative">
            <img
              src={generatedImage}
              alt="Virtual Background Preview"
              className="w-full max-w-md mx-auto rounded-lg shadow-md"
            />
          </div>
        </div>
      )}

      {/* 功能说明 */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
        <h4 className="font-semibold text-gray-800 mb-3">功能特性</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center">
            <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
            AI智能生成：通过文本描述生成个性化背景
          </li>
          <li className="flex items-center">
            <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
            实时替换：无缝替换视频背景，保持自然效果
          </li>
          <li className="flex items-center">
            <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
            多样化风格：支持各种场景和艺术风格
          </li>
          <li className="flex items-center">
            <div className="w-2 h-2 bg-purple-400 rounded-full mr-3"></div>
            自动优化：智能调整背景以匹配光线和色调
          </li>
        </ul>

        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>开发中</strong> - 此功能正在开发中，敬请期待！
          </p>
        </div>
      </div>
    </div>
  );
};

export default SmartVirtualBackground;
