import { useEffect, useState } from "react";
import BigMicIcon from "../../icons/big-mic.tsx";

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
    <div className="flex flex-col items-center justify-center h-full">
      <BigMicIcon className="w-20 h-20 mb-6 text-white" />

      <div className="flex justify-center items-end space-x-1 h-40 mt-4">
        {frequencies.slice(0, 32).map((value, index) => (
          <div
            key={`left-${index}`}
            style={{
              height: `${value}%`,
              width: '4px',
              maxHeight: '140px', // 막대 최대 길이 조금 더 길게
              backgroundColor: isRecording ? "#FEE500" : "#FFFFFF", // 녹음 중이면 노란색, 기본은 하얀색
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
              width: '4px',
              maxHeight: '140px', // 막대 최대 길이 조금 더 길게
              backgroundColor: isRecording ? "#FEE500" : "#FFFFFF", // 녹음 중이면 노란색, 기본은 하얀색
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
