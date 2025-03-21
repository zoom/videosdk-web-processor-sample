import ZoomMediaContext from "../context/media-context";
import { useContext, useEffect, useRef, useState } from "react";

export function useAudio() {
  const [audioOn, setAudioOn] = useState(false);
  const isSwitching = useRef(false);

  const { mediaStream } = useContext(ZoomMediaContext);

  const openAudioRef = useRef<boolean>(false);

  const handleToggleAudio = async () => {
    if (isSwitching.current) {
      return;
    }
    isSwitching.current = true;
    if (!audioOn) {
      setAudioOn(true);
      await mediaStream?.startAudio();
      openAudioRef.current = true;
    } else {
      setAudioOn(false);
      mediaStream?.stopAudio();
      openAudioRef.current = false;
    }
    isSwitching.current = false;
  };

  useEffect(
    () => () => {
      if (openAudioRef.current) {
        mediaStream?.stopAudio();
      }
    },
    [mediaStream]
  );

  return {
    audioOn,
    handleToggleAudio,
  };
}
