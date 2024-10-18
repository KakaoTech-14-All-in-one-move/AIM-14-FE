import { useState, useEffect, useRef } from "react";
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
  const [isCameraExpanded, setIsCameraExpanded] = useState(0);
  const [isScreenSharingExpanded, setIsScreenSharingExpanded] = useState(0);
  const [showDownload, setShowDownload] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    initializeCamera();
  }, []);

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setCameraStream(stream);
      setError(null);
    } catch (err) {
      console.error("Error accessing camera and microphone:", err);
      setError("There was an issue accessing the camera and microphone.");
    }
  };

  const startRecording = async () => {
    try {
      setRecordedChunks([]);
      setShowDownload(false);

      const stream = isCameraOn
        ? cameraStream
        : await navigator.mediaDevices.getUserMedia({ audio: true });

      if (stream) {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setRecordedChunks((prev) => [...prev, event.data]);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setError(null);
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("There was an issue starting the recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setShowDownload(true);
    }
  };

  const downloadRecording = () => {
    if (recordedChunks.length === 0) return;

    const blob = new Blob(recordedChunks, {
      type: isCameraOn ? "video/webm" : "audio/webm",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isCameraOn ? "recording.webm" : "audio.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    setShowDownload(false);
    setIsRecording(false);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
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
    if (newValue === 2) {
      setIsScreenSharingExpanded(0);
    }
  };

  const toggleScreenSharingExpand = () => {
    const newValue = isScreenSharingExpanded === 2 ? 0 : isScreenSharingExpanded + 1;
    setIsScreenSharingExpanded(newValue);
    if (newValue === 2) {
      setIsCameraExpanded(0);
    }
  };

  const getCameraClassName = () => {
    if (isCameraExpanded === 2) return "w-full h-full";
    if (isCameraExpanded === 1) return "w-3/4 h-full rounded-lg";
    if (isScreenSharingExpanded === 2) return "hidden";
    return isScreenSharingExpanded === 1 ? "w-1/5 h-2/5 mx-auto mt-6 rounded-lg" : "w-1/2 h-full";
  };

  const getScreenSharingClassName = () => {
    if (isScreenSharingExpanded === 2) return "w-full h-[70%]"; // Adjusted to occupy 70% of the height
    if (isScreenSharingExpanded === 1) return "w-3/4 h-[70%] rounded-lg";
    if (isCameraExpanded === 2) return "hidden";
    return isCameraExpanded === 1
      ? "w-1/5 h-[30%] mx-auto mt-6 rounded-lg border border-gray-300"
      : "w-1/2 h-[70%]"; // Set the height to 70%
  };

  const renderCameraPopup = () => (
    <Draggable bounds="parent">
      <div className="absolute bottom-4 right-4 w-48 h-32 bg-black text-sm p-2 rounded-lg border border-gray-300 shadow-lg z-50 overflow-hidden">
        {isCameraOn ? (
          <div className="relative w-full h-full">
            <CameraRecording stream={cameraStream} />
            {isRecording && (
              <div className="absolute top-2 left-2 flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
                <span className="text-white text-xs">REC</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-white flex items-center justify-center h-full relative">
            <AudioWaveform isRecording={isRecording} />
            {isRecording && (
              <div className="absolute top-2 left-2 flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
                <span className="text-white text-xs">REC</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Draggable>
  );

  const renderScreenSharingPopup = () => (
    <Draggable bounds="parent">
      <div className="absolute bottom-4 left-4 w-48 h-32 bg-gray-700 text-sm p-2 rounded-lg border border-gray-300 shadow-lg z-50 overflow-hidden">
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
    <div className="h-screen w-full flex flex-col" style={{ backgroundColor: "#1E1F22" }}>
      <div className="flex-grow flex relative overflow-hidden">
        {/* Camera Area */}
        <div className={`relative transition-all duration-500 ${getCameraClassName()} bg-black flex-shrink-0`}>
          {isCameraOn ? (
            <div className="relative h-full">
              <CameraRecording stream={cameraStream} />
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
                  <span className="text-white text-xs">REC</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center text-white h-full relative">
              <AudioWaveform isRecording={isRecording} />
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
                  <span className="text-white text-xs">REC</span>
                </div>
              )}
            </div>
          )}

          {isCameraExpanded === 0 && isScreenSharingExpanded === 0 && (
            <button
              onClick={toggleCameraExpand}
              className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
            >
              <FiArrowUpRight size={24} />
            </button>
          )}

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

          {isCameraExpanded === 2 && (
            <button
              onClick={() => setIsCameraExpanded(0)}
              className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
            >
              <FiArrowDownLeft size={24} />
            </button>
          )}

          {isCameraExpanded === 2 && renderScreenSharingPopup()}
        </div>

        {/* Screen Sharing Area */}
        <div
          className={`relative transition-all duration-500 ${getScreenSharingClassName()} bg-gray-700 flex-shrink-0 border border-black`}
        >
          {screenStream ? (
            <ScreenSharing stream={screenStream} />
          ) : (
            <div className="text-white flex items-center justify-center h-full text-sm" style={{ backgroundColor: "#2B2D31" }}>
              {isSharing ? "Initializing screen share..." : "Screen sharing not started"}
            </div>
          )}

          {isScreenSharingExpanded === 0 && isCameraExpanded === 0 && (
            <button
              onClick={toggleScreenSharingExpand}
              className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
            >
              <FiArrowUpRight size={24} />
            </button>
          )}

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

          {isScreenSharingExpanded === 2 && (
            <button
              onClick={() => setIsScreenSharingExpanded(0)}
              className="absolute top-2 right-2 text-white hover:bg-gray-700 p-1 rounded-full"
            >
              <FiArrowDownLeft size={24} />
            </button>
          )}

          {isScreenSharingExpanded === 2 && renderCameraPopup()}
        </div>
      </div>

      {/* Controls Area */}
      <div className="flex-shrink-0 h-20">
        {error && <div className="text-red-500 text-center p-4">{error}</div>}
        <div className="flex justify-center items-center gap-4 p-4 bg-[#1E1F22]">
          <Controls
            isRecording={isRecording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            isCameraOn={isCameraOn}
            toggleCamera={toggleCamera}
            isSharing={isSharing}
            startSharing={startSharing}
            stopSharing={stopSharing}
            isRecordingComplete={showDownload}
            downloadRecording={downloadRecording}
          />
        </div>
      </div>
    </div>
  );
};

export default RecordingPage;
