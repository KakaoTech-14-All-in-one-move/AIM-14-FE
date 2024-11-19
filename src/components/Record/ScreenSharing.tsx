import { useRef, useEffect } from "react";

const ScreenSharing = ({ stream }: { stream: MediaStream | null }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        className="w-full h-full object-cover rounded-lg" // 화면 공유 영상 비율
      />
    </div>
  );
};

export default ScreenSharing;
