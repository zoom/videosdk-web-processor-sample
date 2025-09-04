import ZoomMediaContext from "../context/media-context";
import { useContext, useEffect, useRef, useState } from "react";

export function useAudio() {
  const [audioOn, setAudioOn] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [originalSoundEnabled, setOriginalSoundEnabled] = useState(false);
  const [stereoEnabled, setStereoEnabled] = useState(false);
  const [hifiEnabled, setHifiEnabled] = useState(false);
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

      // Prepare originalSound options
      let originalSoundOptions: any = false;
      if (originalSoundEnabled) {
        if (stereoEnabled || hifiEnabled) {
          originalSoundOptions = {
            stereo: stereoEnabled,
            hifi: hifiEnabled,
          };
        } else {
          originalSoundOptions = true;
        }
      }

      await mediaStream?.startAudio({
        originalSound:
          originalSoundOptions !== false ? originalSoundOptions : undefined,
      });
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

  const handleToggleOriginalSound = async (enabled: boolean) => {
    if (!audioOn) {
      // If audio is not on, just update the state for next time
      setOriginalSoundEnabled(enabled);
      return;
    }

    try {
      if (enabled) {
        let originalSoundOptions: any = true;
        if (stereoEnabled || hifiEnabled) {
          originalSoundOptions = {
            stereo: stereoEnabled,
            hifi: hifiEnabled,
          };
        }
        await mediaStream?.enableOriginalSound(originalSoundOptions);
      } else {
        await mediaStream?.enableOriginalSound(false);
      }
      setOriginalSoundEnabled(enabled);
      console.log(`OriginalSound ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error(`Error toggling original sound: ${error}`);
    }
  };

  const handleToggleStereo = async (enabled: boolean) => {
    setStereoEnabled(enabled);

    if (!audioOn || !originalSoundEnabled) {
      return; // Just update state if audio is off or original sound is disabled
    }

    try {
      const originalSoundOptions = {
        stereo: enabled,
        hifi: hifiEnabled,
      };
      await mediaStream?.enableOriginalSound(originalSoundOptions);
      console.log(`Stereo ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error(`Error toggling stereo: ${error}`);
    }
  };

  const handleToggleHifi = async (enabled: boolean) => {
    setHifiEnabled(enabled);

    if (!audioOn || !originalSoundEnabled) {
      return; // Just update state if audio is off or original sound is disabled
    }

    try {
      const originalSoundOptions = {
        stereo: stereoEnabled,
        hifi: enabled,
      };
      await mediaStream?.enableOriginalSound(originalSoundOptions);
      console.log(`HiFi ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      console.error(`Error toggling hifi: ${error}`);
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
    originalSoundEnabled,
    stereoEnabled,
    hifiEnabled,
    handleToggleAudio,
    handleMuteAudio,
    handleToggleOriginalSound,
    handleToggleStereo,
    handleToggleHifi,
  };
}
