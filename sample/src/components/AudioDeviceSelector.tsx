import React from "react";
import { Mic, Volume2, RefreshCw } from "lucide-react";
import { useAudioDevices, AudioDevice } from "../hooks/useAudioDevices";

interface AudioDeviceSelectorProps {
  showMicrophoneSelector?: boolean;
  showSpeakerSelector?: boolean;
  disabled?: boolean;
  className?: string;
}

function AudioDeviceSelector({
  showMicrophoneSelector = true,
  showSpeakerSelector = true,
  disabled = false,
  className = "",
}: AudioDeviceSelectorProps) {
  const {
    microphones,
    speakers,
    selectedMicrophoneId,
    selectedSpeakerId,
    isLoading,
    refreshDevices,
    switchMicrophone,
    switchSpeaker,
  } = useAudioDevices();

  const handleMicrophoneChange = async (microphoneId: string) => {
    try {
      await switchMicrophone(microphoneId);
    } catch (error) {
      console.error("Failed to switch microphone:", error);
    }
  };

  const handleSpeakerChange = async (speakerId: string) => {
    try {
      await switchSpeaker(speakerId);
    } catch (error) {
      console.error("Failed to switch speaker:", error);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Device refresh button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-800">Audio Devices</h3>
        <button
          onClick={refreshDevices}
          disabled={disabled || isLoading}
          className="flex items-center space-x-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Devices</span>
        </button>
      </div>

      {/* Microphone selector */}
      {showMicrophoneSelector && (
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Mic className="w-4 h-4 mr-2" />
            Microphone
          </label>
          <select
            value={selectedMicrophoneId}
            onChange={(e) => handleMicrophoneChange(e.target.value)}
            disabled={disabled || isLoading}
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">Select microphone...</option>
            {microphones.map((mic: AudioDevice) => (
              <option key={mic.deviceId} value={mic.deviceId}>
                {mic.label}
              </option>
            ))}
          </select>
          {microphones.length === 0 && !isLoading && (
            <p className="text-sm text-gray-500 mt-1">No microphones detected</p>
          )}
        </div>
      )}

      {/* Speaker selector */}
      {showSpeakerSelector && (
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Volume2 className="w-4 h-4 mr-2" />
            Speaker
          </label>
          <select
            value={selectedSpeakerId}
            onChange={(e) => handleSpeakerChange(e.target.value)}
            disabled={disabled || isLoading}
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">Select speaker...</option>
            {speakers.map((speaker: AudioDevice) => (
              <option key={speaker.deviceId} value={speaker.deviceId}>
                {speaker.label}
              </option>
            ))}
          </select>
          {speakers.length === 0 && !isLoading && (
            <p className="text-sm text-gray-500 mt-1">No speakers detected</p>
          )}
        </div>
      )}

      {/* Loading status */}
      {isLoading && (
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading device list...</span>
        </div>
      )}
    </div>
  );
}

export default AudioDeviceSelector;
