import React, { useState, useRef, useContext, useEffect } from "react";
import ZoomMediaContext from "../../context/media-context";
import { Mic, Loader2, Upload, Play, Download } from "lucide-react";
import { useAudio } from "../../hooks/useSelfAudio";
import { Processor } from "@zoom/videosdk";

type ProcessorInfo = {
  processor: Processor;
};

function LocalRecording({ processor }: ProcessorInfo) {
  const isRecordingRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { audioOn, handleToggleAudio } = useAudio();
  const sampleRate = 48000;
  const processorRef = useRef<Processor>();

  // states for UI
  const [selectedSampleRate, setSelectedSampleRate] = useState(sampleRate);
  const [selectedFormat, setSelectedFormat] = useState("wav");
  const [maxDuration, setMaxDuration] = useState(300);
  const [volumeThreshold, setVolumeThreshold] = useState(0.1);
  const [isComposing, setIsComposing] = useState(false);
  const [composingProgress, setComposingProgress] = useState(0);

  useEffect(() => {
    processorRef.current = processor;
    if (processorRef.current) {
      console.log(`processor loaded: ${processorRef.current.name}`);
      processorRef.current.port.onmessage = (event: MessageEvent) => {
        console.log(
          `Received message from processor. type: ${event.data.type}`
        );

        // handle the message from processor
        if (event.data) {
          if (event.data.type === "encoding") {
            if (event.data.buffer) {
              // received the message of recording completed and audio data
              const arrayBuffer = event.data.buffer;

              // create the MIME type based on the format
              let mimeType = "audio/wav";
              if (selectedFormat === "mp3") {
                mimeType = "audio/mp3";
              }

              // create the Blob object
              const audioBlob = new Blob([arrayBuffer], { type: mimeType });
              setRecordedBlob(audioBlob);

              // create the URL (will be created in the useEffect)
              console.log("Recording completed and audio blob created");
            } else if (event.data.status === "error") {
              // handle the error
              console.error("Recording error:", event.data.error);
            }
          } else if (event.data.type === "processing") {
            // draw the audio data
            drawAudioData(event.data.audioData);
          }
        }
      };
    }
  }, [processor, selectedFormat]);

  // countdown effect
  useEffect(() => {
    let timer: number | undefined;
    if (isRecording && remainingTime > 0) {
      timer = window.setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [isRecording, remainingTime]);

  // handle the audio after recording
  useEffect(() => {
    // clean the previous URL
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    if (recordedBlob && recordedBlob.size > 0) {
      try {
        const url = URL.createObjectURL(recordedBlob);
        console.log("Created audio URL:", url);
        setAudioUrl(url);

        // notify the user that the recording is completed and can be previewed
        console.log("Audio ready for preview");
      } catch (error) {
        console.error("Error creating object URL:", error);
      }
    }

    // clean the URL when the component is unmounted
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [recordedBlob]);

  // load the audioUrl to the audioRef element
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      try {
        audioRef.current.src = audioUrl;
        // preload the audio to verify its validity
        audioRef.current.load();
        console.log("Audio URL loaded to audio element");
      } catch (error) {
        console.error("Error loading audio:", error);
      }
    }
  }, [audioUrl]);

  const stopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;

    // Stop Zoom audio
    if (audioOn) {
      if (processor && processor.port) {
        processor.port.postMessage({
          command: "stop",
        });
      }
      handleToggleAudio();
    }
  };

  const startRecording = async () => {
    setIsRecording(true);
    isRecordingRef.current = true;
    setRemainingTime(maxDuration);

    // clear the previous recording data
    setRecordedBlob(null);
    setAudioUrl(null);

    // Start Zoom audio
    if (!audioOn) {
      if (processor && processor.port) {
        processor.port.postMessage({
          command: "start",
          config: {
            sampleRate: selectedSampleRate,
            numChannels: 2,
            audioFormat: selectedFormat,
            volumeThreshold: volumeThreshold,
          },
        });
      }
      handleToggleAudio();
    }
  };

  const handleDownload = async () => {
    if (!recordedBlob) return;

    try {
      setIsComposing(true);
      setComposingProgress(0);

      // simulate the progress of composing
      const progressInterval = setInterval(() => {
        setComposingProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      // create the download link
      const downloadUrl = URL.createObjectURL(recordedBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;

      // setup the file name
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadLink.download = `recording-${timestamp}.${selectedFormat}`;

      // simulate the composing progress
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // clear the interval & progress
      clearInterval(progressInterval);
      setComposingProgress(100);

      // trigger the download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsComposing(false);
      setComposingProgress(0);
      setRecordedBlob(null);
      setAudioUrl(null);
    }
  };

  const handlePreview = () => {
    if (!audioUrl || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      // ensure the correct audio source is loaded
      if (audioRef.current.src !== audioUrl) {
        audioRef.current.src = audioUrl;
      }

      audioRef.current.play().catch((err) => {
        console.error("Preview playback failed:", err);
      });
      setIsPlaying(true);
    }
  };

  const drawAudioData = (audioData: Float32Array) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgb(0, 200, 200)";
    ctx.beginPath();

    const sliceWidth = width / audioData.length;
    let x = 0;

    for (let i = 0; i < audioData.length; i++) {
      const v = audioData[i];
      const y = (v * 0.5 + 0.5) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  // listen to the audio playback completion
  useEffect(() => {
    const audioElement = audioRef.current;

    const handleEnded = () => {
      setIsPlaying(false);
    };

    if (audioElement) {
      audioElement.addEventListener("ended", handleEnded);
    }

    return () => {
      if (audioElement) {
        audioElement.removeEventListener("ended", handleEnded);
      }
    };
  }, []);

  return (
    <>
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            LocalRecording Processor
          </h2>
          <div className="flex space-x-2">
            <button
              className={`p-2 rounded-lg transition-colors ${
                isInitializing
                  ? "bg-gray-500"
                  : isRecording
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isInitializing}
            >
              {isInitializing ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Mic
                  className={`w-5 h-5 text-white ${
                    isRecording ? "animate-pulse" : ""
                  }`}
                />
              )}
            </button>
            {isRecording && (
              <div className="bg-gray-700 text-white px-2 py-1 rounded flex items-center">
                {Math.floor(remainingTime / 60)}:
                {(remainingTime % 60).toString().padStart(2, "0")}
              </div>
            )}
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className="w-full h-48 bg-gray-900 rounded-lg"
        />
        {/* hidden audio element for preview */}
        <audio ref={audioRef} style={{ display: "none" }} />
      </div>
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Parameters</h2>

        {/* sample rate selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sample Rate
          </label>
          <select
            value={selectedSampleRate}
            onChange={(e) => setSelectedSampleRate(Number(e.target.value))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          >
            <option value={44100}>44.1 kHz</option>
            <option value={48000}>48 kHz</option>
            <option value={96000}>96 kHz</option>
          </select>
        </div>

        {/* audio format selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Audio Format
          </label>
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          >
            <option value="wav">WAV</option>
            <option value="mp3">MP3</option>
          </select>
        </div>

        {/* max recording duration */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Duration (seconds)
          </label>
          <input
            type="number"
            value={maxDuration}
            onChange={(e) => setMaxDuration(Number(e.target.value))}
            min="1"
            max="3600"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            disabled={isRecording}
          />
        </div>

        {/* volume threshold */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Volume Threshold
          </label>
          <input
            type="range"
            value={volumeThreshold}
            onChange={(e) => setVolumeThreshold(Number(e.target.value))}
            min="0"
            max="1"
            step="0.01"
            className="w-full"
            disabled={isRecording}
          />
          <div className="text-sm text-gray-500 mt-1">
            {Math.round(volumeThreshold * 100)}%
          </div>
        </div>

        {/* preview and upload buttons */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={handlePreview}
            disabled={!audioUrl || isRecording}
            className={`flex-1 py-2 px-4 rounded-md flex justify-center items-center space-x-2 ${
              audioUrl && !isRecording
                ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <Play className="w-5 h-5" />
            <span>{isPlaying ? "Stop" : "Preview"}</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={!audioUrl || isRecording || isComposing}
            className={`flex-1 py-2 px-4 rounded-md flex justify-center items-center space-x-2 ${
              audioUrl && !isRecording && !isComposing
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isComposing ? (
              <div className="w-full">
                <div className="flex items-center justify-center space-x-2 mb-1">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Composing...</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${composingProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>Download</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

export default LocalRecording;
