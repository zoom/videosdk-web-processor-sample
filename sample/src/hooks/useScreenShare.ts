import { useContext, useState } from "react";
import ZoomMediaContext from "../context/media-context";

export function useScreenShare() {
  const [isSharing, setIsSharing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const { mediaStream } = useContext(ZoomMediaContext);

  const startScreenShare = async (videoElement?: HTMLVideoElement, canvasElement?: HTMLCanvasElement) => {
    try {
      if (!mediaStream) {
        console.error("MediaStream not available");
        return false;
      }
      
      // 使用Zoom SDK的屏幕共享API，根据支持情况选择video或canvas元素
      if (mediaStream.isStartShareScreenWithVideoElement()) {
        // 如果支持video元素，优先使用video元素
        const targetElement = videoElement || document.querySelector('#my-screen-share-content-video') as HTMLVideoElement;
        if (!targetElement) {
          console.error("Video element not found for screen sharing");
          return false;
        }
        
        await mediaStream.startShareScreen(targetElement);
        console.log("Screen sharing started with video element");
      } else {
        // 否则使用canvas元素
        const targetElement = canvasElement || document.querySelector('#my-screen-share-content-canvas') as HTMLCanvasElement;
        if (!targetElement) {
          console.error("Canvas element not found for screen sharing");
          return false;
        }
        
        await mediaStream.startShareScreen(targetElement);
        console.log("Screen sharing started with canvas element");
      }
      
      setIsSharing(true);
      setIsPaused(false);
      
      console.log("Screen sharing started successfully");
      return true;
    } catch (error) {
      console.error("Failed to start screen sharing:", error);
      return false;
    }
  };

  const stopScreenShare = async () => {
    try {
      if (!mediaStream) return false;
      
      // 停止Zoom屏幕共享
      await mediaStream.stopShareScreen();
      
      setIsSharing(false);
      setIsPaused(false);
      
      console.log("Screen sharing stopped");
      return true;
    } catch (error) {
      console.error("Failed to stop screen sharing:", error);
      return false;
    }
  };

  const pauseScreenShare = async () => {
    try {
      if (!mediaStream) return false;
      
      if (isPaused) {
        // 恢复屏幕共享
        await mediaStream.resumeShareScreen();
        setIsPaused(false);
        console.log("Screen sharing resumed");
      } else {
        // 暂停屏幕共享
        await mediaStream.pauseShareScreen();
        setIsPaused(true);
        console.log("Screen sharing paused");
      }
      return true;
    } catch (error) {
      console.error("Failed to pause/resume screen sharing:", error);
      return false;
    }
  };

  return {
    isSharing,
    isPaused,
    startScreenShare,
    stopScreenShare,
    pauseScreenShare,
  };
}
