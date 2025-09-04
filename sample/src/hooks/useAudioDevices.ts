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

  // Custom implementation to get microphone list
  const getMicList = async (): Promise<AudioDevice[]> => {
    try {
      // Request permission to access media devices
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (permissionError) {
        console.warn(
          "Microphone permission denied, trying to get devices without labels:",
          permissionError
        );
      }

      // Get all media devices
      const devices = await navigator.mediaDevices.enumerateDevices();

      // Filter audio input devices (microphones)
      const microphones = devices
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 8)}...`,
        }));

      // Clean up the stream if we created one
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      console.log("Found microphones:", microphones);
      return microphones;
    } catch (error) {
      console.error("Failed to get microphone list:", error);
      return [];
    }
  };

  // Custom implementation to get speaker list
  const getSpeakerList = async (): Promise<AudioDevice[]> => {
    try {
      // Get all media devices
      const devices = await navigator.mediaDevices.enumerateDevices();

      // Filter audio output devices (speakers)
      const speakers = devices
        .filter((device) => device.kind === "audiooutput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${device.deviceId.slice(0, 8)}...`,
        }));

      console.log("Found speakers:", speakers);
      return speakers;
    } catch (error) {
      console.error("Failed to get speaker list:", error);
      return [];
    }
  };

  // Get device list
  const refreshDevices = async () => {
    try {
      setIsLoading(true);

      // Get microphone list using custom implementation
      const micList = await getMicList();
      setMicrophones(micList);

      // Get speaker list using custom implementation
      const speakerList = await getSpeakerList();
      setSpeakers(speakerList);

      // Set default devices if none selected
      if (!selectedMicrophoneId && micList.length > 0) {
        setSelectedMicrophoneId(micList[0].deviceId);
      }

      if (!selectedSpeakerId && speakerList.length > 0) {
        setSelectedSpeakerId(speakerList[0].deviceId);
      }

      console.log("Retrieved device lists:", {
        microphones: micList.length,
        speakers: speakerList.length,
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

  // Get device list on initialization and listen for device changes
  useEffect(() => {
    if (mediaStream) {
      refreshDevices();
    }

    // Listen for device changes (plugging/unplugging devices)
    const handleDeviceChange = () => {
      console.log("Audio device change detected, refreshing device list...");
      refreshDevices();
    };

    // Add event listener for device changes
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    // Cleanup event listener
    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
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
    // Export custom device list functions
    getMicList,
    getSpeakerList,
  };
}
