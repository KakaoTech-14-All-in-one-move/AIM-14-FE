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
        className="w-full h-full object-cover border-4 border-gray-700 rounded-md"
      />
    </div>
  );
};

export default ScreenSharing;
