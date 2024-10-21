import { useEffect, useState } from "react";
import BigMicIcon from "../../common/icons/big-mic.tsx";

interface AudioWaveformProps {
  isRecording: boolean;
}

const AudioWaveform = ({ isRecording }: AudioWaveformProps) => {
  const [frequencies, setFrequencies] = useState<number[]>(new Array(64).fill(0));

  useEffect(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    let analyser: AnalyserNode;
    let microphone: MediaStreamAudioSourceNode;
    let dataArray: Uint8Array;
    let animationFrameId: number;

    const handleSuccess = async (stream: MediaStream) => {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        analyser.getByteFrequencyData(dataArray);
        setFrequencies([...dataArray]);
        animationFrameId = requestAnimationFrame(updateWaveform);
      };

      updateWaveform();
    };

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(handleSuccess)
      .catch((err) => console.error("Error accessing microphone:", err));

    return () => {
      cancelAnimationFrame(animationFrameId);
      audioContext.close();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      {/* Mic Icon with adjusted position */}
      <BigMicIcon className="w-16 h-16 mb-8 mt-4 text-white max-w-full max-h-full" /> {/* Increased margin-bottom and margin-top */}

      {/* Waveform */}
      <div className="flex justify-center items-end space-x-1 h-full w-full max-h-40 mt-4">
        {frequencies.slice(0, 32).map((value, index) => (
          <div
            key={`left-${index}`}
            style={{
              height: `${value}%`,
              width: '3px',
              maxHeight: '120px', // Adjusted to fit small view
              backgroundColor: isRecording ? "#FEE500" : "#FFFFFF", // Yellow when recording, white otherwise
              transition: 'height 0.1s ease-in-out, background-color 0.2s ease-in-out',
            }}
            className="rounded-sm"
          />
        ))}
        {frequencies.slice(32, 64).map((value, index) => (
          <div
            key={`right-${index}`}
            style={{
              height: `${value}%`,
              width: '3px',
              maxHeight: '120px', // Adjusted to fit small view
              backgroundColor: isRecording ? "#FEE500" : "#FFFFFF",
              transition: 'height 0.1s ease-in-out, background-color 0.2s ease-in-out',
            }}
            className="rounded-sm"
          />
        ))}
      </div>
    </div>
  );
};

export default AudioWaveform;
