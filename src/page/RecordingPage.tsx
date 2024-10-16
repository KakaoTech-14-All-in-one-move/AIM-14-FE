import React, { useState } from "react";
import CameraRecording from "../components/record/CameraRecording";
import ScreenSharing from "../components/record/ScreenSharing";
import Controls from "../components/record/Controls";
import AudioWaveform from "../components/record/AudioWaveform";
import { FiArrowUpRight, FiArrowDownLeft } from "react-icons/fi";

const RecordingPage = () => {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraExpanded, setIsCameraExpanded] = useState(false);
  const [isScreenSharingExpanded, setIsScreenSharingExpanded] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setCameraStream(stream);
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error("Error accessing camera and microphone:", err);
      setError("There was an issue accessing the camera and microphone.");
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
      setError(null);
    } catch (err) {
      console.error("Error sharing screen:", err);
      setError("There was an issue with screen sharing.");
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

  const toggleCameraExpand = () => {
    setIsCameraExpanded(!isCameraExpanded);
  };

  const toggleScreenSharingExpand = () => {
    setIsScreenSharingExpanded(!isScreenSharingExpanded);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-900">
      {/* Camera and Screen Sharing Section */}
      <div className={`flex-grow flex relative justify-center items-center`}>
        {/* Camera Area */}
        <div
          className={`relative transition-all duration-500 ${
            isCameraExpanded ? "w-1/2 h-full" : isScreenSharingExpanded ? "w-1/3 h-1/2 mx-auto" : "w-1/3 h-1/2 mx-2"
          } bg-black flex-shrink-0`}>
          {isCameraOn ? (
            <CameraRecording stream={cameraStream} />
          ) : (
            <div className="flex items-center justify-center text-white h-full">
              <AudioWaveform isRecording={isRecording} />
            </div>
          )}
          {/* Toggle Expand/Collapse Icon */}
          <button onClick={toggleCameraExpand} className="absolute top-2 right-2 text-white">
            {isCameraExpanded ? <FiArrowDownLeft size={24} /> : <FiArrowUpRight size={24} />}
          </button>
        </div>

        {/* Screen Sharing Area with Black Border */}
        <div
          className={`relative transition-all duration-500 ${
            isScreenSharingExpanded ? "w-1/2 h-full" : isCameraExpanded ? "w-1/3 h-1/2 mx-auto" : "w-1/3 h-1/2 mx-2"
          } bg-gray-700 flex-shrink-0 border border-black`}>
          {screenStream ? (
            <ScreenSharing stream={screenStream} />
          ) : (
            <p className="text-white flex items-center justify-center h-full">Waiting for screen sharing...</p>
          )}
          {/* Toggle Expand/Collapse Icon */}
          <button onClick={toggleScreenSharingExpand} className="absolute top-2 right-2 text-white">
            {isScreenSharingExpanded ? <FiArrowDownLeft size={24} /> : <FiArrowUpRight size={24} />}
          </button>
        </div>
      </div>

      {/* Improved File Upload Section */}
      <div className="p-6 bg-gray-800 border-t border-gray-600">
        <div className="bg-gray-700 p-4 rounded-lg flex flex-col items-center space-y-4 max-w-lg mx-auto">
          <p className="text-white font-semibold">Upload a file:</p>
          <input
            type="file"
            onChange={handleFileUpload}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg focus:outline-none focus:ring focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && <div className="text-red-500 text-center p-4">{error}</div>}

      {/* Controls Section */}
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
