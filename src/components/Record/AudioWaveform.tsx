import { useEffect, useState } from "react";
import BigMicIcon from "../../common/icons/big-mic.tsx";

interface AudioWaveformProps {
  isRecording: boolean;
  isScreenSharingExpanded: number;
  isCameraExpanded: number;
}

const AudioWaveform = ({ isRecording, isScreenSharingExpanded, isCameraExpanded }: AudioWaveformProps) => {
  const [frequencies, setFrequencies] = useState<number[]>(new Array(64).fill(0));

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let currentStream: MediaStream | null = null;
    let animationFrameId: number;

    const handleSuccess = async (stream: MediaStream) => {
      currentStream = stream;  // 스트림 저장
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      const microphone = audioContext.createMediaStreamSource(stream);
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

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(handleSuccess)
      .catch((err) => console.error("Error accessing microphone:", err));

    return () => {
      // 모든 리소스 정리
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioContext) {
        audioContext.close();
      }
      if (currentStream) {
        currentStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, []);

  // 파형 크기 설정: isCameraExpanded에 따라 다르게 설정
  const getBarSize = () => {
    switch (isCameraExpanded) {
      case 1:
        return { width: '5px', maxHeight: '150px' }; // 카메라가 1일 때
      case 2:
        return { width: '7px', maxHeight: '180px' }; // 카메라가 2일 때
      default:
        return { width: '3px', maxHeight: '120px' }; // 기본 크기
    }
  };

  const { width, maxHeight } = getBarSize();

  // isCameraExpanded에 따른 margin-bottom 설정
  const getMicStyle = () => ({
    marginBottom: isCameraExpanded === 2 ? '160px' : isCameraExpanded === 1 ? '80px' : '10px',
  });

  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      {/* isScreenSharingExpanded가 2일 때 BigMicIcon만 중앙에 표시 */}
      {isScreenSharingExpanded === 2 ? (
        <div className="flex items-center justify-center h-full" style={getMicStyle()}>
          <BigMicIcon size={10} />
        </div>
      ) : (
        <>
          {/* Mic Icon with adjusted position */}
          <div style={getMicStyle()} className="flex items-center justify-center">
            <BigMicIcon />
          </div>

          {/* Waveform */}
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
