import { useState } from "react";
import CameraRecording from "../components/record/CameraRecording";
import ScreenSharing from "../components/record/ScreenSharing";
import Controls from "../components/record/Controls";
import AudioWaveform from "../components/record/AudioWaveform";
import { FiArrowUpRight, FiArrowDownLeft } from "react-icons/fi";
import Draggable from "react-draggable";

const RecordingPage = () => {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraExpanded, setIsCameraExpanded] = useState(0); // 0: 기본, 1: 반대편 축소, 2: 전체 화면
  const [isScreenSharingExpanded, setIsScreenSharingExpanded] = useState(0);

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

  const toggleCameraExpand = () => {
    const newValue = isCameraExpanded === 2 ? 0 : isCameraExpanded + 1;
    setIsCameraExpanded(newValue);
    // 카메라가 2단계로 확대될 때는 화면 공유를 완전히 숨김
    if (newValue === 2) {
      setIsScreenSharingExpanded(0);
    }
  };

  const toggleScreenSharingExpand = () => {
    const newValue = isScreenSharingExpanded === 2 ? 0 : isScreenSharingExpanded + 1;
    setIsScreenSharingExpanded(newValue);
    // 화면 공유가 2단계로 확대될 때는 카메라를 완전히 숨김
    if (newValue === 2) {
      setIsCameraExpanded(0);
    }
  };

  const getCameraClassName = () => {
    if (isCameraExpanded === 2) return "w-full h-full";
    if (isCameraExpanded === 1) return "w-3/4 h-full rounded-lg";
    if (isScreenSharingExpanded === 2) return "hidden";
    return isScreenSharingExpanded === 1 ? "w-1/5 h-2/5 mx-auto mt-6 rounded-lg" : "w-1/2 h-full"; // 작은 화면일 때 rounded-lg 추가
  };

  const getScreenSharingClassName = () => {
    if (isScreenSharingExpanded === 2) return "w-full h-full";
    if (isScreenSharingExpanded === 1) return "w-3/4 h-full rounded-lg";
    if (isCameraExpanded === 2) return "hidden";
    return isCameraExpanded === 1 ? "w-1/5 h-2/5 mx-auto mt-6 rounded-lg" : "w-1/2 h-full"; // 작은 화면일 때 rounded-lg 추가
  };

  // 팝업 렌더링 함수
  const renderCameraPopup = () => (
    <Draggable>
      <div className="absolute bottom-4 right-4 w-48 h-32 bg-black text-sm p-2 rounded-lg border border-gray-600 shadow-lg z-50">
        {isCameraOn ? (
          <CameraRecording stream={cameraStream} />
        ) : (
          <div className="text-white flex items-center justify-center h-full">
            <AudioWaveform isRecording={isRecording} />
          </div>
        )}
      </div>
    </Draggable>
  );

  const renderScreenSharingPopup = () => (
    <Draggable>
      <div className="absolute bottom-4 right-4 w-48 h-32 bg-gray-700 text-sm p-2 rounded-lg border border-gray-600 shadow-lg z-50">
        {screenStream ? (
          <ScreenSharing stream={screenStream} />
        ) : (
          <p className="text-white flex items-center justify-center h-full">
            {isSharing ? "Initializing screen share..." : "Screen sharing not started"}
          </p>
        )}
      </div>
    </Draggable>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-gray-900">
      {/* Upper Section (Camera and Screen Sharing) */}
      <div className="flex-grow flex relative">
        {/* Camera Area */}
        <div className={`relative transition-all duration-500 ${getCameraClassName()} bg-black flex-shrink-0`}>
          {isCameraOn ? (
            <CameraRecording stream={cameraStream} />
          ) : (
            <div className="flex items-center justify-center text-white h-full">
              <AudioWaveform isRecording={isRecording} />
            </div>
          )}

          {/* 기본 화면: 확대 버튼만 보이게 */}
          {isCameraExpanded === 0 && isScreenSharingExpanded === 0 && (
            <button
              onClick={toggleCameraExpand}
              className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
            >
              <FiArrowUpRight size={24} />
            </button>
          )}

          {/* 1단 확대: 확대/축소 둘 다 보이게 */}
          {isCameraExpanded === 1 && (
            <>
              <button
                onClick={toggleCameraExpand}
                className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
              >
                <FiArrowUpRight size={24} />
              </button>
              <button
                onClick={() => setIsCameraExpanded(0)}
                className="absolute top-2 right-12 text-white hover:bg-gray-700 p-1 rounded-full"
              >
                <FiArrowDownLeft size={24} />
              </button>
            </>
          )}

          {/* 2단 확대: 축소 아이콘만 보이게 */}
          {isCameraExpanded === 2 && (
            <button
              onClick={() => setIsCameraExpanded(0)}
              className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
            >
              <FiArrowDownLeft size={24} />
            </button>
          )}

          {/* 전체 화면일 때 팝업 */}
          {isCameraExpanded === 2 && renderScreenSharingPopup()}
        </div>

        {/* Screen Sharing Area */}
        <div className={`relative transition-all duration-500 ${getScreenSharingClassName()} bg-gray-700 flex-shrink-0 border border-black`}>
          {screenStream ? (
            <ScreenSharing stream={screenStream} />
          ) : (
            <p className="text-white flex items-center justify-center h-full text-sm">
              Waiting for screen sharing...
            </p>
          )}

          {/* 기본 화면: 확대 버튼만 보이게 */}
          {isScreenSharingExpanded === 0 && isCameraExpanded === 0 && (
            <button
              onClick={toggleScreenSharingExpand}
              className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
            >
              <FiArrowUpRight size={24} />
            </button>
          )}

          {/* 1단 확대: 확대/축소 둘 다 보이게 */}
          {isScreenSharingExpanded === 1 && (
            <>
              <button
                onClick={toggleScreenSharingExpand}
                className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
              >
                <FiArrowUpRight size={24} />
              </button>
              <button
                onClick={() => setIsScreenSharingExpanded(0)}
                className="absolute top-2 right-12 text-white hover:bg-gray-700 p-1 rounded-full"
              >
                <FiArrowDownLeft size={24} />
              </button>
            </>
          )}

          {/* 2단 확대: 축소 아이콘만 보이게 */}
          {isScreenSharingExpanded === 2 && (
            <button
              onClick={() => setIsScreenSharingExpanded(0)}
              className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
            >
              <FiArrowDownLeft size={24} />
            </button>
          )}

          {/* 전체 화면일 때 카메라 팝업 */}
          {isScreenSharingExpanded === 2 && renderCameraPopup()}
        </div>
      </div>

      {/* Lower Section (Controls) */}
      <div className="flex-shrink-0">
        {error && <div className="text-red-500 text-center p-4">{error}</div>}
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
    </div>
  );
};

export default RecordingPage;
