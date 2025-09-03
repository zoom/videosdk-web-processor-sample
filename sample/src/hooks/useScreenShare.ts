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
      
      // Use Zoom SDK screen sharing API, choose video or canvas element based on support
      if (mediaStream.isStartShareScreenWithVideoElement()) {
        // If video element is supported, prioritize video element
        const targetElement = videoElement || document.querySelector('#my-screen-share-content-video') as HTMLVideoElement;
        if (!targetElement) {
          console.error("Video element not found for screen sharing");
          return false;
        }
        
        await mediaStream.startShareScreen(targetElement);
        console.log("Screen sharing started with video element");
      } else {
        // Otherwise use canvas element
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
      
      // Stop Zoom screen sharing
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
        // Resume screen sharing
        await mediaStream.resumeShareScreen();
        setIsPaused(false);
        console.log("Screen sharing resumed");
      } else {
        // Pause screen sharing
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
