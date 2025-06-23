import React, { useState, useRef } from "react";
import {
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Globe,
  Palette,
  Upload,
  Eye,
} from "lucide-react";

const VideoBusinessCard: React.FC = () => {
  const [cardInfo, setCardInfo] = useState({
    name: "",
    title: "",
    company: "",
    email: "",
    phone: "",
    website: "",
    address: "",
  });

  const [cardStyle, setCardStyle] = useState({
    theme: "modern",
    opacity: 0.8,
    position: "bottom-right",
    size: "medium",
  });

  const [logoImage, setLogoImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (field: string, value: string) => {
    setCardInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleStyleChange = (field: string, value: string | number) => {
    setCardStyle((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const themes = [
    {
      value: "modern",
      label: "现代简约",
      color: "bg-gradient-to-r from-blue-500 to-purple-600",
    },
    {
      value: "classic",
      label: "经典商务",
      color: "bg-gradient-to-r from-gray-700 to-gray-900",
    },
    {
      value: "creative",
      label: "创意设计",
      color: "bg-gradient-to-r from-pink-500 to-orange-500",
    },
    {
      value: "minimal",
      label: "极简风格",
      color: "bg-white border-2 border-gray-300",
    },
  ];

  const positions = [
    { value: "top-left", label: "左上角" },
    { value: "top-right", label: "右上角" },
    { value: "bottom-left", label: "左下角" },
    { value: "bottom-right", label: "右下角" },
  ];

  const sizes = [
    { value: "small", label: "小" },
    { value: "medium", label: "中" },
    { value: "large", label: "大" },
  ];

  return (
    <div className="space-y-6">
      {/* 名片信息 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <User className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-800">名片信息</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              姓名
            </label>
            <input
              type="text"
              value={cardInfo.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="张三"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              职位
            </label>
            <input
              type="text"
              value={cardInfo.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="产品经理"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              公司
            </label>
            <input
              type="text"
              value={cardInfo.company}
              onChange={(e) => handleInputChange("company", e.target.value)}
              placeholder="科技有限公司"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              邮箱
            </label>
            <input
              type="email"
              value={cardInfo.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="zhangsan@company.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              电话
            </label>
            <input
              type="tel"
              value={cardInfo.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              placeholder="+86 138 0000 0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              网站
            </label>
            <input
              type="url"
              value={cardInfo.website}
              onChange={(e) => handleInputChange("website", e.target.value)}
              placeholder="www.company.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* 公司Logo */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Building className="w-5 h-5 text-green-500" />
          <h3 className="text-lg font-semibold text-gray-800">公司Logo</h3>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex items-center space-x-4">
          <button
            onClick={handleLogoUpload}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            上传Logo
          </button>

          {logoImage && (
            <div className="flex items-center space-x-2">
              <img
                src={logoImage}
                alt="Company Logo"
                className="w-10 h-10 object-contain rounded"
              />
              <span className="text-sm text-gray-600">Logo已上传</span>
            </div>
          )}
        </div>
      </div>

      {/* 样式设置 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Palette className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold text-gray-800">样式设置</h3>
        </div>

        <div className="space-y-4">
          {/* 主题 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              主题风格
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {themes.map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => handleStyleChange("theme", theme.value)}
                  className={`relative p-3 rounded-lg border-2 transition-all ${
                    cardStyle.theme === theme.value
                      ? "border-purple-500 shadow-md"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div
                    className={`w-full h-8 rounded ${theme.color} mb-2`}
                  ></div>
                  <span className="text-xs font-medium text-gray-700">
                    {theme.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 位置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              显示位置
            </label>
            <select
              value={cardStyle.position}
              onChange={(e) => handleStyleChange("position", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {positions.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>

          {/* 大小 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              名片大小
            </label>
            <select
              value={cardStyle.size}
              onChange={(e) => handleStyleChange("size", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {sizes.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>

          {/* 透明度 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              透明度: {Math.round(cardStyle.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.1"
              value={cardStyle.opacity}
              onChange={(e) =>
                handleStyleChange("opacity", parseFloat(e.target.value))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>
      </div>

      {/* 预览 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Eye className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-semibold text-gray-800">名片预览</h3>
        </div>

        <div className="relative bg-gray-100 rounded-lg p-4 min-h-[200px]">
          <div
            className={`absolute ${
              cardStyle.position === "top-left"
                ? "top-4 left-4"
                : cardStyle.position === "top-right"
                ? "top-4 right-4"
                : cardStyle.position === "bottom-left"
                ? "bottom-4 left-4"
                : "bottom-4 right-4"
            } ${
              cardStyle.size === "small"
                ? "w-48"
                : cardStyle.size === "medium"
                ? "w-56"
                : "w-64"
            }`}
            style={{ opacity: cardStyle.opacity }}
          >
            <div
              className={`p-4 rounded-lg shadow-lg ${
                cardStyle.theme === "modern"
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                  : cardStyle.theme === "classic"
                  ? "bg-gradient-to-r from-gray-700 to-gray-900 text-white"
                  : cardStyle.theme === "creative"
                  ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white"
                  : "bg-white text-gray-800 border border-gray-300"
              }`}
            >
              <div className="flex items-center space-x-3 mb-2">
                {logoImage && (
                  <img
                    src={logoImage}
                    alt="Logo"
                    className="w-8 h-8 object-contain rounded"
                  />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {cardInfo.name || "姓名"}
                  </h4>
                  <p className="text-xs opacity-90">
                    {cardInfo.title || "职位"}
                  </p>
                </div>
              </div>
              <div className="text-xs space-y-1 opacity-80">
                <p>{cardInfo.company || "公司名称"}</p>
                <p>{cardInfo.email || "邮箱地址"}</p>
                <p>{cardInfo.phone || "联系电话"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 功能说明 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
        <h4 className="font-semibold text-gray-800 mb-3">功能特性</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
            动态名片：实时显示个人或企业信息
          </li>
          <li className="flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
            多样主题：支持多种设计风格和配色方案
          </li>
          <li className="flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
            灵活布局：可自定义位置、大小和透明度
          </li>
          <li className="flex items-center">
            <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
            品牌展示：支持公司Logo和完整联系信息
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

export default VideoBusinessCard;
