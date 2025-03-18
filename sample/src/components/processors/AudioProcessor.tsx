import React, { useMemo } from "react";
import audioProcessorConfig from "../../config/processor/audio";
import { useLoadProcessor } from "../../hooks/useLoadProcessor";

interface AudioProcessorProps {
  id: string;
}

function AudioProcessor({ id }: AudioProcessorProps) {
  const processor = useLoadProcessor(id, "audio");

  const Cmp = useMemo(() => {
    return audioProcessorConfig[id]?.render || null;
  }, [id]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/** processor && ignore loading for test */ Cmp ? (
        <Cmp processor={processor} />
      ) : (
        <p>Loading controls...</p>
      )}
    </div>
  );
}

export default AudioProcessor;
