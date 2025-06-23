import React, { useState, useRef } from "react";
import {
  Sticker,
  Smile,
  Heart,
  Star,
  Upload,
  Trash2,
  Move,
  RotateCw,
  ZoomIn,
  Eye,
} from "lucide-react";

interface StickerItem {
  id: string;
  src: string;
  name: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  isActive: boolean;
  trackFace: boolean;
}

const VideoStickers: React.FC = () => {
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [stickerMode, setStickerMode] = useState<"static" | "face-tracking">(
    "static"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 预设贴纸
  const presetStickers = [
    { id: "heart", name: "爱心", emoji: "❤️" },
    { id: "star", name: "星星", emoji: "⭐" },
    { id: "smile", name: "笑脸", emoji: "😊" },
    { id: "cool", name: "酷脸", emoji: "😎" },
    { id: "fire", name: "火焰", emoji: "🔥" },
    { id: "crown", name: "皇冠", emoji: "👑" },
    { id: "rainbow", name: "彩虹", emoji: "🌈" },
    { id: "unicorn", name: "独角兽", emoji: "🦄" },
  ];

  const addPresetSticker = (preset: (typeof presetStickers)[0]) => {
    const newSticker: StickerItem = {
      id: `${preset.id}-${Date.now()}`,
      src: preset.emoji,
      name: preset.name,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      opacity: 1,
      isActive: true,
      trackFace: stickerMode === "face-tracking",
    };

    setStickers((prev) => [...prev, newSticker]);
    setSelectedSticker(newSticker.id);
  };

  const addCustomSticker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newSticker: StickerItem = {
          id: `custom-${Date.now()}`,
          src: e.target?.result as string,
          name: file.name,
          x: 50,
          y: 50,
          scale: 1,
          rotation: 0,
          opacity: 1,
          isActive: true,
          trackFace: stickerMode === "face-tracking",
        };

        setStickers((prev) => [...prev, newSticker]);
        setSelectedSticker(newSticker.id);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateSticker = (id: string, updates: Partial<StickerItem>) => {
    setStickers((prev) =>
      prev.map((sticker) =>
        sticker.id === id ? { ...sticker, ...updates } : sticker
      )
    );
  };

  const removeSticker = (id: string) => {
    setStickers((prev) => prev.filter((sticker) => sticker.id !== id));
    if (selectedSticker === id) {
      setSelectedSticker(null);
    }
  };

  const selectedStickerData = selectedSticker
    ? stickers.find((s) => s.id === selectedSticker)
    : null;

  return (
    <div className="space-y-6">
      {/* 贴纸模式选择 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Sticker className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-800">贴纸模式</h3>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={() => setStickerMode("static")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              stickerMode === "static"
                ? "bg-orange-100 text-orange-700 border-2 border-orange-300"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Move className="w-4 h-4 inline mr-2" />
            静态贴纸
          </button>
          <button
            onClick={() => setStickerMode("face-tracking")}
            className={`px-4 py-2 rounded-lg transition-colors ${
              stickerMode === "face-tracking"
                ? "bg-orange-100 text-orange-700 border-2 border-orange-300"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Smile className="w-4 h-4 inline mr-2" />
            人脸跟踪
          </button>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          {stickerMode === "static"
            ? "贴纸将固定在指定位置"
            : "贴纸将跟随人脸移动，支持眼镜、帽子等装饰"}
        </p>
      </div>

      {/* 预设贴纸 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Star className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold text-gray-800">预设贴纸</h3>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {presetStickers.map((preset) => (
            <button
              key={preset.id}
              onClick={() => addPresetSticker(preset)}
              className="p-3 border-2 border-gray-200 rounded-lg hover:border-yellow-300 hover:bg-yellow-50 transition-colors group"
              title={preset.name}
            >
              <div className="text-2xl mb-1">{preset.emoji}</div>
              <div className="text-xs text-gray-600 group-hover:text-yellow-700 truncate">
                {preset.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 自定义贴纸 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Upload className="w-5 h-5 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-800">自定义贴纸</h3>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={addCustomSticker}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Upload className="w-4 h-4 mr-2" />
          上传贴纸
        </button>

        <p className="text-sm text-gray-600 mt-2">
          支持 PNG、JPG 格式，建议使用透明背景的 PNG 图片
        </p>
      </div>

      {/* 贴纸列表 */}
      {stickers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Eye className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-800">
              已添加的贴纸
            </h3>
          </div>

          <div className="space-y-3">
            {stickers.map((sticker) => (
              <div
                key={sticker.id}
                className={`flex items-center space-x-3 p-3 rounded-lg border-2 transition-colors ${
                  selectedSticker === sticker.id
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedSticker(sticker.id)}
              >
                <div className="flex-shrink-0">
                  {sticker.src.startsWith("data:") ? (
                    <img
                      src={sticker.src}
                      alt={sticker.name}
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    <div className="text-xl">{sticker.src}</div>
                  )}
                </div>

                <div className="flex-grow">
                  <p className="font-medium text-gray-800">{sticker.name}</p>
                  <p className="text-sm text-gray-600">
                    {sticker.trackFace ? "人脸跟踪" : "静态位置"}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateSticker(sticker.id, {
                        isActive: !sticker.isActive,
                      });
                    }}
                    className={`px-2 py-1 rounded text-xs ${
                      sticker.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {sticker.isActive ? "显示" : "隐藏"}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSticker(sticker.id);
                    }}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 贴纸属性调节 */}
      {selectedStickerData && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <RotateCw className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-800">贴纸属性</h3>
          </div>

          <div className="space-y-4">
            {/* 位置 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  X 位置: {selectedStickerData.x}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedStickerData.x}
                  onChange={(e) =>
                    updateSticker(selectedStickerData.id, {
                      x: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Y 位置: {selectedStickerData.y}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedStickerData.y}
                  onChange={(e) =>
                    updateSticker(selectedStickerData.id, {
                      y: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>

            {/* 缩放 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                大小: {(selectedStickerData.scale * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={selectedStickerData.scale}
                onChange={(e) =>
                  updateSticker(selectedStickerData.id, {
                    scale: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>

            {/* 旋转 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                旋转: {selectedStickerData.rotation}°
              </label>
              <input
                type="range"
                min="0"
                max="360"
                value={selectedStickerData.rotation}
                onChange={(e) =>
                  updateSticker(selectedStickerData.id, {
                    rotation: parseInt(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>

            {/* 透明度 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                透明度: {(selectedStickerData.opacity * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={selectedStickerData.opacity}
                onChange={(e) =>
                  updateSticker(selectedStickerData.id, {
                    opacity: parseFloat(e.target.value),
                  })
                }
                className="w-full"
              />
            </div>

            {/* 人脸跟踪 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="trackFace"
                checked={selectedStickerData.trackFace}
                onChange={(e) =>
                  updateSticker(selectedStickerData.id, {
                    trackFace: e.target.checked,
                  })
                }
                className="rounded"
              />
              <label
                htmlFor="trackFace"
                className="text-sm font-medium text-gray-700"
              >
                启用人脸跟踪
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 预览区域 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Eye className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-800">效果预览</h3>
        </div>

        <div className="relative bg-gray-900 rounded-lg aspect-video overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center text-white text-lg">
            📹 视频预览区域
          </div>

          {/* 渲染贴纸 */}
          {stickers
            .filter((s) => s.isActive)
            .map((sticker) => (
              <div
                key={sticker.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${sticker.x}%`,
                  top: `${sticker.y}%`,
                  transform: `translate(-50%, -50%) scale(${sticker.scale}) rotate(${sticker.rotation}deg)`,
                  opacity: sticker.opacity,
                  zIndex: 10,
                }}
              >
                {sticker.src.startsWith("data:") ? (
                  <img
                    src={sticker.src}
                    alt={sticker.name}
                    className="max-w-none w-16 h-16 object-contain"
                  />
                ) : (
                  <div className="text-4xl">{sticker.src}</div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* 功能说明 */}
      <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl p-6 border border-orange-100">
        <h4 className="font-semibold text-gray-800 mb-3">功能特性</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center">
            <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
            智能跟踪：支持人脸识别和实时跟踪
          </li>
          <li className="flex items-center">
            <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
            多样贴纸：内置丰富表情和装饰贴纸
          </li>
          <li className="flex items-center">
            <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
            自定义上传：支持个性化贴纸上传
          </li>
          <li className="flex items-center">
            <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
            精细调节：位置、大小、旋转、透明度全可控
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

export default VideoStickers;
