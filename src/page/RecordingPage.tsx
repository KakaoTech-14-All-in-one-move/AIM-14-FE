import React, { useState } from "react";
import CameraRecording from "../components/record/CameraRecording";
import ScreenSharing from "../components/record/ScreenSharing";
import Controls from "../components/record/Controls";

const RecordingPage = () => {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSharing, setIsSharing] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setCameraStream(stream);
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing camera and microphone:", err);
    }
  };

  const stopRecording = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
  };

  const toggleCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => {
        if (track.kind === "video") {
          track.enabled = !track.enabled;
        }
      });
    }
    setIsCameraOn(!isCameraOn);
  };

  const startSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      setScreenStream(stream);
      setIsSharing(true);
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const stopSharing = () => {
    screenStream?.getTracks().forEach((track) => track.stop());
    setScreenStream(null);
    setIsSharing(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("Uploaded file:", file);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-900">
      <div className="flex-grow flex w-full">
        <div className="w-1/2 h-full">
          {isCameraOn ? (
            <CameraRecording stream={cameraStream} />
          ) : (
            <div className="flex items-center justify-center text-white">Audio Only</div>
          )}
        </div>

        {/* 오른쪽 화면 공유 및 파일 첨부 영역 */}
        <div className="w-1/2 h-full flex flex-col">
          {/* 화면 공유 영역 (상단 70%) */}
          <div className="flex-grow bg-gray-700 flex items-center justify-center" style={{ height: '70%' }}>
            <ScreenSharing stream={screenStream} />
          </div>

          {/* 파일 첨부 영역 (하단 30%) */}
          <div className="bg-gray-600 flex flex-col items-center justify-center" style={{ height: '30%' }}>
            <p className="text-white mb-2">Upload a file:</p>
            <input type="file" onChange={handleFileUpload} className="text-white" />
          </div>
        </div>
      </div>

      <Controls
        isRecording={isRecording}
        startRecording={startRecording}
        stopRecording={stopRecording}
        isCameraOn={isCameraOn}
        toggleCamera={toggleCamera}
        isSharing={isSharing}
        startSharing={startSharing}
        stopSharing={stopSharing}
      />
    </div>
  );
};

export default RecordingPage;
