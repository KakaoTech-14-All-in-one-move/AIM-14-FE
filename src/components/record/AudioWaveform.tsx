import { useEffect, useRef, useState } from "react";

const AudioWaveform = ({ stream }: { stream: MediaStream | null }) => {
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (stream) {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      source.connect(analyser);
      analyser.fftSize = 256;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      audioContextRef.current = audioContext;

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        setVolume(average);
        requestAnimationFrame(tick);
      };

      tick();
    }
    return () => {
      audioContextRef.current?.close();
    };
  }, [stream]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-white mb-2">Recording Audio</div>
        <div className="w-48 h-10 bg-gray-700 rounded-md overflow-hidden">
          <div
            style={{ width: `${volume}%` }}
            className="h-full bg-green-500"
          />
        </div>
      </div>
    </div>
  );
};

export default AudioWaveform;
