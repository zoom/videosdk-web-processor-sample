import { Processor } from "@zoom/videosdk";
import {
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
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
    removeVideoProcessor,
    removeAudioProcessor,
  } = useContext(ZoomMediaContext);

  const [processor, setProcessor] = useState<Processor | undefined>();
  const [processorLoaded, setProcessorLoaded] = useState(false);

  const currentProcessorIdRef = useRef<string>("");
  const currentMediaStreamRef = useRef<any>(null);

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

    currentProcessorIdRef.current = id;
    currentMediaStreamRef.current = mediaStream;

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
    return () => {
      console.log(`unloading processor: ${currentProcessorIdRef.current}`);
      if (currentMediaStreamRef.current) {
        if (type === "video") {
          removeVideoProcessor(
            currentMediaStreamRef.current,
            currentProcessorIdRef.current
          );
        } else {
          removeAudioProcessor(
            currentMediaStreamRef.current,
            currentProcessorIdRef.current
          );
        }
      }
    };
  }, []);

  useEffect(() => {
    if (processorLoaded) {
      setProcessor(processorMapRef.current.get(selectedProcessor));
    }
  }, [selectedProcessor, processorLoaded]);

  return processor;
}
