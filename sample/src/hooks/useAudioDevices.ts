import { useContext, useEffect, useState } from "react";
import ZoomMediaContext from "../context/media-context";

export interface AudioDevice {
  deviceId: string;
  label: string;
}

export function useAudioDevices() {
  const [microphones, setMicrophones] = useState<AudioDevice[]>([]);
  const [speakers, setSpeakers] = useState<AudioDevice[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>("");
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const { mediaStream } = useContext(ZoomMediaContext);

  // Get device list
  const refreshDevices = async () => {
    if (!mediaStream) return;

    try {
      setIsLoading(true);
      
      // Get microphone list
      const micList = mediaStream.getMicList();
      const formattedMicList: AudioDevice[] = micList.map((mic: any) => ({
        deviceId: mic.deviceId,
        label: mic.label || `Microphone ${mic.deviceId.slice(0, 8)}...`
      }));
      setMicrophones(formattedMicList);

      // Get speaker list
      const speakerList = mediaStream.getSpeakerList();
      const formattedSpeakerList: AudioDevice[] = speakerList.map((speaker: any) => ({
        deviceId: speaker.deviceId,
        label: speaker.label || `Speaker ${speaker.deviceId.slice(0, 8)}...`
      }));
      setSpeakers(formattedSpeakerList);

      // Set default devices if none selected
      if (!selectedMicrophoneId && formattedMicList.length > 0) {
        setSelectedMicrophoneId(formattedMicList[0].deviceId);
      }
      
      if (!selectedSpeakerId && formattedSpeakerList.length > 0) {
        setSelectedSpeakerId(formattedSpeakerList[0].deviceId);
      }
      
      console.log("Retrieved device lists:", { 
        microphones: formattedMicList.length, 
        speakers: formattedSpeakerList.length 
      });
      
    } catch (error) {
      console.error("Failed to get audio device list:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch microphone
  const switchMicrophone = async (microphoneId: string) => {
    if (!mediaStream || !microphoneId) return;

    try {
      console.log("Switching microphone to:", microphoneId);
      await mediaStream.switchMicrophone(microphoneId);
      setSelectedMicrophoneId(microphoneId);
      console.log("Microphone switched successfully");
    } catch (error) {
      console.error("Failed to switch microphone:", error);
      throw error;
    }
  };

  // Switch speaker
  const switchSpeaker = async (speakerId: string) => {
    if (!mediaStream || !speakerId) return;

    try {
      console.log("Switching speaker to:", speakerId);
      await mediaStream.switchSpeaker(speakerId);
      setSelectedSpeakerId(speakerId);
      console.log("Speaker switched successfully");
    } catch (error) {
      console.error("Failed to switch speaker:", error);
      throw error;
    }
  };

  // Get device list on initialization
  useEffect(() => {
    if (mediaStream) {
      refreshDevices();
    }
  }, [mediaStream]);

  return {
    microphones,
    speakers,
    selectedMicrophoneId,
    selectedSpeakerId,
    isLoading,
    refreshDevices,
    switchMicrophone,
    switchSpeaker,
  };
}
