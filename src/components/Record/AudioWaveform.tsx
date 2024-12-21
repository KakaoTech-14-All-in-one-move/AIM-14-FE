import { useEffect, useState } from "react";
import BigMicIcon from "@/common/icons/big-mic.tsx";

interface AudioWaveformProps {
  isRecording: boolean;
  isScreenSharingExpanded: number;
  isCameraExpanded: number;
  audioStream: MediaStream | null;
}

const AudioWaveform = ({ isRecording, isScreenSharingExpanded, isCameraExpanded, audioStream }: AudioWaveformProps) => {
  const [frequencies, setFrequencies] = useState<number[]>(new Array(64).fill(0));

  useEffect(() => {
    if (!audioStream) return;

    let audioContext: AudioContext | null = null;
    let animationFrameId: number;

    const initializeAudioAnalyzer = () => {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      const microphone = audioContext.createMediaStreamSource(audioStream);
      microphone.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        analyser.getByteFrequencyData(dataArray);
        setFrequencies([...dataArray]);
        animationFrameId = requestAnimationFrame(updateWaveform);
      };

      updateWaveform();
    };

    initializeAudioAnalyzer();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audioStream]);

  // 파형 크기 설정
  const getBarSize = () => {
    switch (isCameraExpanded) {
      case 1:
        return { width: '5px', maxHeight: '150px' };
      case 2:
        return { width: '7px', maxHeight: '180px' };
      default:
        return { width: '3px', maxHeight: '120px' };
    }
  };

  const { width, maxHeight } = getBarSize();

  const getMicStyle = () => ({
    marginBottom: isCameraExpanded === 2 ? '160px' : isCameraExpanded === 1 ? '80px' : '10px',
  });

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      {isScreenSharingExpanded === 2 ? (
        <div className="flex items-center justify-center h-full" style={getMicStyle()}>
          <BigMicIcon size={10} />
        </div>
      ) : (
        <>
          <div style={getMicStyle()} className="flex items-center justify-center">
            <BigMicIcon />
          </div>

          <div className="flex justify-center items-end space-x-1 h-full w-full max-h-40 mt-4">
            {frequencies.slice(0, 32).map((value, index) => (
              <div
                key={`left-${index}`}
                style={{
                  height: `${value}%`,
                  width,
                  maxHeight,
                  backgroundColor: isRecording ? "#FEE500" : "#FFFFFF",
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
                  width,
                  maxHeight,
                  backgroundColor: isRecording ? "#FEE500" : "#FFFFFF",
                  transition: 'height 0.1s ease-in-out, background-color 0.2s ease-in-out',
                }}
                className="rounded-sm"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AudioWaveform;
