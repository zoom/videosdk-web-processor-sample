import { useContext, useEffect, useRef, useState } from "react";
import ZoomContext from "../context/zoom-context";
import ZoomMediaContext from "../context/media-context";

export function useVideo() {
  const [videoOn, setVideoOn] = useState(false);
  const isSwitching = useRef(false);

  const { mediaStream } = useContext(ZoomMediaContext);
  const zmClient = useContext(ZoomContext);

  const selfVideoRef = useRef(null);
  const openVideoRef = useRef<boolean>(false);

  const handleToggleVideo = async () => {
    if (isSwitching.current) {
      return;
    }
    isSwitching.current = true;
    const user = zmClient.getCurrentUserInfo();
    if (!videoOn) {
      setVideoOn(true);
      await mediaStream?.startVideo({ hd: true, fps: 24, originalRatio: true });
      await mediaStream?.attachVideo(user.userId, 3, selfVideoRef.current!);
      openVideoRef.current = true;
    } else {
      setVideoOn(false);
      await mediaStream?.stopVideo();
      await mediaStream?.detachVideo(user.userId, selfVideoRef.current!);
      openVideoRef.current = false;
    }
    isSwitching.current = false;
  };

  useEffect(
    () => () => {
      if (openVideoRef.current) {
        mediaStream?.stopVideo();
      }
    },
    []
  );

  return {
    videoOn,
    handleToggleVideo,
    selfVideoRef,
  };
}
