import { Processor } from "@zoom/videosdk";
import { useContext, useEffect, useMemo, useState } from "react";
import ZoomMediaContext from "../context/media-context";
import processorConfig from "../config/processor";

export function useLoadProcessor(id: string, type: "audio" | "video") {
  const {
    mediaStream,
    selectVideoProcessor,
    selectedVideoProcessor,
    videoProcessorMapRef,
    selectAudioProcessor,
    selectedAudioProcessor,
    audioProcessorMapRef,
  } = useContext(ZoomMediaContext);
  const [processor, setProcessor] = useState<Processor | undefined>();
  const [processorLoaded, setProcessorLoaded] = useState(false);

  const selectProcessor = useMemo(() => {
    return {
      video: selectVideoProcessor,
      audio: selectAudioProcessor,
    }[type];
  }, [type]);

  const selectedProcessor = useMemo(() => {
    return {
      video: selectedVideoProcessor,
      audio: selectedAudioProcessor,
    }[type];
  }, [type, selectedVideoProcessor, selectedAudioProcessor]);

  const processorMapRef = useMemo(() => {
    return {
      video: videoProcessorMapRef,
      audio: audioProcessorMapRef,
    }[type];
  }, [type]);

  useEffect(() => {
    if (!mediaStream) return;
    const c = processorConfig[type][id];
    if (!c) return;

    console.log(`Loading ${type} processor: ${c.id}`);

    selectProcessor(
      mediaStream,
      c.id,
      c.url,
      c.options,
      async (port: MessagePort) => {
        setProcessorLoaded(true);
      }
    );
  }, [id, mediaStream]);

  useEffect(() => {
    if (processorLoaded) {
      setProcessor(processorMapRef.current.get(selectedProcessor));
    }
  }, [selectedProcessor, processorLoaded]);

  return processor;
}
