import { Processor } from "@zoom/videosdk";
import { useRef, useState } from "react";
import type { MediaStream } from "../index-types";

export function useSelectProcessor(type: "video" | "audio" | "share"): [
  string,
  (mediaStream: MediaStream, name: string, url: string, options: any, initCallback: (port: MessagePort) => void) => Promise<void>,
  React.MutableRefObject<Map<string, Processor>>,
  (mediaStream: MediaStream, name: string) => Promise<void>
] {
  const [selectedProcessor, setSelectedProcessor] = useState<string>("");
  const processorMapRef = useRef(new Map<string, Processor>());
  const processorRef = useRef<Processor | undefined>();

  const selectProcessor = async (
    mediaStream: MediaStream,
    name: string,
    url: string,
    options: any,
    initCallback: (port: MessagePort) => void
  ) => {
    if (!mediaStream) return;
    setSelectedProcessor(name);
    if (processorRef.current) {
      await mediaStream?.removeProcessor(processorRef.current);
    }
    const processorMap = processorMapRef.current;
    let processor = processorMap.get(name);
    if (!processor) {
      processor = await mediaStream?.createProcessor({
        url,
        type,
        name,
        options,
      });
    }
    if (!processor) {
      throw new Error("Processor creation failed");
    }
    processorMap.set(name, processor);
    processorRef.current = processor;
    await mediaStream?.addProcessor(processor);
    initCallback(processor.port);
  };

  const removeProcessor = async (mediaStream: MediaStream, name: string) => {
    console.log(`removeProcessor() type: ${type}, id: ${selectedProcessor}`);
    if (processorRef.current && mediaStream) {
      await mediaStream?.removeProcessor(processorRef.current);
    }

    // cleanup current processor reference
    processorRef.current = undefined;
    setSelectedProcessor("");
  };

  return [selectedProcessor, selectProcessor, processorMapRef, removeProcessor];
}
