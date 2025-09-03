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

export function useLoadProcessor(id: string, type: "audio" | "video" | "share") {
  const {
    mediaStream,
    selectVideoProcessor,
    selectedVideoProcessor,
    videoProcessorMapRef,
    selectAudioProcessor,
    selectedAudioProcessor,
    audioProcessorMapRef,
    selectShareProcessor,
    selectedShareProcessor,
    shareProcessorMapRef,
    removeVideoProcessor,
    removeAudioProcessor,
    removeShareProcessor, 
  } = useContext(ZoomMediaContext);

  const [processor, setProcessor] = useState<Processor | undefined>();
  const [processorLoaded, setProcessorLoaded] = useState(false);
  const [processorCreated, setProcessorCreated] = useState(false);

  const currentProcessorIdRef = useRef<string>("");
  const currentMediaStreamRef = useRef<any>(null);

  const selectProcessor = useMemo(() => {
    return {
      video: selectVideoProcessor,
      audio: selectAudioProcessor,
      share: selectShareProcessor,
    }[type];
  }, [type]);

  const selectedProcessor = useMemo(() => {
    return {
      video: selectedVideoProcessor,
      audio: selectedAudioProcessor,
      share: selectedShareProcessor,
    }[type];
  }, [type, selectedVideoProcessor, selectedAudioProcessor, selectedShareProcessor]);

  const processorMapRef = useMemo(() => {
    return {
      video: videoProcessorMapRef,
      audio: audioProcessorMapRef,
      share: shareProcessorMapRef,
    }[type];
  }, [type]);

  const createProcessor = useCallback(async () => {
    if (!mediaStream || processorCreated) return null;
    const c = processorConfig[type][id];
    if (!c) return null;

    console.log(`Creating ${type} processor: ${c.id}`);

    currentProcessorIdRef.current = id;
    currentMediaStreamRef.current = mediaStream;

    try {
      await selectProcessor(
        mediaStream,
        c.id,
        c.url,
        c.options,
        async (port: MessagePort) => {
          setProcessorLoaded(true);
        }
      );
      setProcessorCreated(true);
      return processorMapRef.current.get(c.id);
    } catch (error) {
      console.error(`Failed to create ${type} processor:`, error);
      return null;
    }
  }, [id, mediaStream, type, selectProcessor, processorMapRef, processorCreated]);

  // Remove processor function
  const removeProcessorFn = useCallback(async () => {
    if (!mediaStream || !processorCreated) return;
    
    const removeHandler = {
      video: removeVideoProcessor,
      audio: removeAudioProcessor,
      share: removeShareProcessor,
    }[type];

    if (removeHandler && currentProcessorIdRef.current) {
      console.log(`Removing ${type} processor: ${currentProcessorIdRef.current}`);
      await removeHandler(mediaStream, currentProcessorIdRef.current);
      
      // Reset state
      setProcessor(undefined);
      setProcessorLoaded(false);
      setProcessorCreated(false);
      currentProcessorIdRef.current = "";
      currentMediaStreamRef.current = null;
    }
  }, [mediaStream, processorCreated, type, removeVideoProcessor, removeAudioProcessor, removeShareProcessor]);

  // For audio and video processors, maintain the original auto-creation behavior
  // For share processors, delay creation
  useEffect(() => {
    if (type === "share") {
      // Share type processors are not automatically created, wait for manual call
      return;
    }
    
    // Audio and video processors maintain original behavior
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
    setProcessorCreated(true);
  }, [id, mediaStream, type, selectProcessor]);

  useEffect(() => {
    return () => {
      console.log(`unloading processor: ${currentProcessorIdRef.current}`);
      if (currentMediaStreamRef.current) {
        if (type === "video") {
          removeVideoProcessor(
            currentMediaStreamRef.current,
            currentProcessorIdRef.current
          );
        } else if (type === "audio") {
          removeAudioProcessor(
            currentMediaStreamRef.current,
            currentProcessorIdRef.current
          );
        } else if (type === "share") {
          removeShareProcessor(
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

  // For share type, return processor and createProcessor function
  // For other types, maintain original behavior
  if (type === "share") {
    return { processor, createProcessor, removeProcessor: removeProcessorFn, processorCreated };
  }
  
  return processor;
}
