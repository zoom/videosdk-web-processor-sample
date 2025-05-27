import React, { createContext, useState } from "react";
import { Processor } from "@zoom/videosdk";
import { MediaStream } from "../index-types";

interface MediaContext {
  audio: {
    encode: boolean;
    decode: boolean;
  };
  video: {
    encode: boolean;
    decode: boolean;
  };
  share: {
    encode: boolean;
    decode: boolean;
  };
  mediaStream: MediaStream | null;
  selectVideoProcessor: any;
  selectedVideoProcessor: any;
  videoProcessorMapRef: any;
  selectedAudioProcessor: any;
  selectAudioProcessor: any;
  audioProcessorMapRef: any;
  removeVideoProcessor: (mediaStream: MediaStream, name: string) => void;
  removeAudioProcessor: (mediaStream: MediaStream, name: string) => void;
}

export default React.createContext<MediaContext>(null as any);
