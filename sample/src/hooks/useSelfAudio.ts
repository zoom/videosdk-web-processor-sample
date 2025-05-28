import ZoomMediaContext from "../context/media-context";
import { useContext, useEffect, useRef, useState } from "react";

export function useAudio() {
  const [audioOn, setAudioOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isSwitching = useRef(false);
  const isAudioMuting = useRef(false);
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

  const handleMuteAudio = async () => {
    if (isAudioMuting.current) {
      console.log(`audio is muting, skip`);
      return;
    }

    try {
      isAudioMuting.current = true;
      if (!isMuted) {
        setIsMuted(true);
        const result = await mediaStream?.muteAudio();
        console.log(`muteAudio result: ${result}`);
      } else {
        setIsMuted(false);
        const result = await mediaStream?.unmuteAudio();
        console.log(`unmuteAudio result: ${result}`);
      }
    } catch (error) {
      setIsMuted(false);
      console.error(`Error toggling audio mute: ${error}`);
    } finally {
      isAudioMuting.current = false;
    }
  };

  useEffect(
    () => () => {
      if (openAudioRef.current) {
        console.log(`useAudio cleanup, stopping audio`);
        mediaStream?.stopAudio();
      }
    },
    [mediaStream]
  );

  return {
    audioOn,
    isMuted,
    handleToggleAudio,
    handleMuteAudio,
  };
}
