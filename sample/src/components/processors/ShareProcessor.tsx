import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Play, Square, Pause, Eye, EyeOff, Monitor, Settings } from 'lucide-react';
import shareProcessorConfig from "../../config/processor/share";
import { useLoadProcessor } from "../../hooks/useLoadProcessor";
import { useScreenShare } from "../../hooks/useScreenShare";

interface ShareProcessorProps {
  id: string;
}

function ShareProcessor({ id }: ShareProcessorProps) {
  // 屏幕共享功能
  const { 
    isSharing, 
    isPaused, 
    startScreenShare,
    stopScreenShare,
    pauseScreenShare 
  } = useScreenShare();
  
  // 预览状态
  const [showPreview, setShowPreview] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const processorResult = useLoadProcessor(id, "share");
  const processor = (processorResult && 'processor' in processorResult) ? processorResult.processor : processorResult;
  const createProcessor = (processorResult && 'createProcessor' in processorResult) ? processorResult.createProcessor : null;
  const removeProcessor = (processorResult && 'removeProcessor' in processorResult) ? processorResult.removeProcessor : null;
  const processorCreated = (processorResult && 'processorCreated' in processorResult) ? processorResult.processorCreated : true;

  // 获取参数组件
  const Cmp = useMemo(() => {
    return shareProcessorConfig[id]?.render || null;
  }, [id]);

  // 处理开始屏幕共享的逻辑
  const handleStartScreenShare = async () => {
    const success = await startScreenShare(previewVideoRef.current || undefined, previewCanvasRef.current || undefined);
    return success;
  };

  // 处理停止屏幕共享的额外逻辑
  const handleStopScreenShare = async () => {
    const success = await stopScreenShare();
    if (success) {
      setShowPreview(false);
    }
  };

  // 切换效果预览 - 控制canvas效果层的显示/隐藏
  const togglePreview = () => {
    setShowPreview(!showPreview);
    if (!showPreview && isSharing) {
      startPreviewCapture();
    }
  };

  // 屏幕共享状态变化监听 - Zoom SDK会自动处理video元素的内容
  useEffect(() => {
    if (!isSharing && previewVideoRef.current) {
      // 当停止共享时，清空video元素
      previewVideoRef.current.srcObject = null;
    }
  }, [isSharing]);

  // 开始预览捕获 - Canvas现在主要用于处理器效果叠加
  const startPreviewCapture = async () => {
    // Canvas现在主要由处理器参数组件使用
    // Video元素直接显示原始屏幕共享流
    console.log('Preview capture started - video element will show the stream');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Side - Preview Section */}
      <div className="lg:col-span-2">
        {/* 预览区域 - 始终显示 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Screen Share Preview</h2>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={togglePreview}
                disabled={!isSharing}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  !isSharing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : showPreview
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {showPreview ? 'Hide Effects' : 'Show Effects'}
              </button>
            </div>
          </div>
          
          <div className="relative">
            {/* Video预览 - 显示原始屏幕共享流 */}
            <video
              id="my-screen-share-content-video"
              ref={previewVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full aspect-video bg-gray-900 rounded-lg border"
              style={{ display: isSharing ? 'block' : 'none' }}
            />
            
            {/* Canvas预览 - 用于处理器效果叠加 */}
            <canvas
              id="my-screen-share-content-canvas"
              ref={previewCanvasRef}
              width={640}
              height={360}
              className="absolute inset-0 w-full aspect-video pointer-events-none"
              style={{ 
                display: isSharing && showPreview ? 'block' : 'none',
                background: 'transparent'
              }}
            />
            
            {/* 占位符 - 当没有屏幕共享时显示 */}
            {!isSharing && (
              <div className="w-full aspect-video flex items-center justify-center bg-gray-900 rounded-lg border relative">
                <div className="text-center text-gray-400">
                  <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Screen Share Preview</p>
                  <p className="text-sm opacity-75">Start screen sharing to see content here</p>
                </div>
                
                {/* 预览区域边框装饰 */}
                <div className="absolute inset-4 border-2 border-dashed border-gray-600 rounded-lg opacity-30"></div>
              </div>
            )}
          </div>
          
          {/* 状态信息 */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                isSharing ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span>{isSharing ? 'Live Preview' : 'Preview Ready'}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Video: {isSharing ? 'Active' : 'Waiting'}</span>
              <span>Canvas: {showPreview ? 'Ready for effects' : 'Hidden'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Elegant Control Panel */}
      <div className="space-y-6">
        {/* 主控制面板 */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* 面板标题 */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Control Panel</h2>
            <p className="text-blue-100 text-sm mt-1">Manage screen sharing and processing</p>
          </div>
          
          <div className="p-6 space-y-6">
            {/* 当前状态卡片 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${
                    isSharing ? 'bg-green-500 shadow-lg shadow-green-200 animate-pulse' : 'bg-gray-300'
                  }`}></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {isSharing ? (isPaused ? 'Screen Sharing Paused' : 'Screen Sharing Active') : 'Ready to Share'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isSharing ? 'Live session in progress' : 'Click Start to begin'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Status</p>
                  <p className={`text-sm font-semibold ${
                    isSharing ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {isSharing ? 'LIVE' : 'IDLE'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* 屏幕共享控制组 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-800">Screen Share</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleStartScreenShare}
                  disabled={isSharing}
                  className={`group relative overflow-hidden rounded-xl py-3 px-4 font-medium transition-all duration-300 ${
                    isSharing 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 hover:shadow-lg hover:shadow-green-200 transform hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Play className="w-4 h-4" />
                    <span>Start</span>
                  </div>
                  {!isSharing && (
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                  )}
                </button>
                
                <button
                  onClick={handleStopScreenShare}
                  disabled={!isSharing}
                  className={`group relative overflow-hidden rounded-xl py-3 px-4 font-medium transition-all duration-300 ${
                    !isSharing 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 hover:shadow-lg hover:shadow-red-200 transform hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Square className="w-4 h-4" />
                    <span>Stop</span>
                  </div>
                  {isSharing && (
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                  )}
                </button>
                
                <button
                  onClick={pauseScreenShare}
                  disabled={!isSharing}
                  className={`group relative overflow-hidden rounded-xl py-3 px-4 font-medium transition-all duration-300 ${
                    !isSharing 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 hover:shadow-lg hover:shadow-amber-200 transform hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Pause className="w-4 h-4" />
                    <span>{isPaused ? 'Resume' : 'Pause'}</span>
                  </div>
                  {isSharing && (
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                  )}
                </button>
                
                <button
                  onClick={togglePreview}
                  disabled={!isSharing}
                  className={`group relative overflow-hidden rounded-xl py-3 px-4 font-medium transition-all duration-300 ${
                    !isSharing 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : showPreview
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-200 transform hover:-translate-y-0.5'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 hover:shadow-lg hover:shadow-blue-200 transform hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    <span>Effects</span>
                  </div>
                  {isSharing && (
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                  )}
                </button>
              </div>
            </div>
            
            {/* 优雅分隔线 */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-gray-50 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium">
                  Processor Settings
                </span>
              </div>
            </div>
            
            {/* 处理器参数部分 */}
            {Cmp ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <Cmp 
                  processor={processor} 
                  isSharing={isSharing} 
                  previewCanvasRef={previewCanvasRef}
                  previewVideoRef={previewVideoRef}
                  createProcessor={createProcessor}
                  removeProcessor={removeProcessor}
                  processorCreated={processorCreated}
                />
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
                <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No Processor Selected</p>
                <p className="text-gray-400 text-sm mt-1">Choose a processor to see its parameters</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShareProcessor;