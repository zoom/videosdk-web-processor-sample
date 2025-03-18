import { Processor } from "@zoom/videosdk";
import { useRef, useState } from "react";
import type { MediaStream } from "../index-types";

export function useSelectProcessor(type: "video" | "audio", mediaStream: MediaStream | null) {
  const [selectedProcessor, setSelectedProcessor] = useState<string>("");
  const processorMapRef = useRef(new Map<string, Processor>());
  const processorRef = useRef<Processor | undefined>();

  const selectProcessor = async (
    name: string,
    url: string,
    options: any,
    initCallback: (port: MessagePort) => void
  ) => {
    setSelectedProcessor(name);
    if (processorRef.current) {
      mediaStream?.removeProcessor(processorRef.current);
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
    mediaStream?.addProcessor(processor);
    initCallback(processor.port);
  };

  return [selectedProcessor, selectProcessor, processorMapRef];
}
