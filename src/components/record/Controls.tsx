import StopIcon from "../../icons/stop";
import CameraOnIcon from "../../icons/camera-on";
import CameraOffIcon from "../../icons/camera-off";
import RecordIcon from "../../icons/record";
import MicIcon from "../../icons/mic";
import ShareIcon from "../../icons/share";
import CancelIcon from "../../icons/cancel";
import DownloadIcon from "../../icons/download";
import FeedbackIcon from "../../icons/feedback"; // AI Feedback 아이콘 추가

const Controls = ({
                    isRecording,
                    startRecording,
                    stopRecording,
                    isCameraOn,
                    toggleCamera,
                    isSharing,
                    startSharing,
                    stopSharing,
                    isRecordingComplete,
                    downloadRecording,
                    onFeedbackClick, // AI Feedback 클릭 핸들러 추가
                  }: {
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  isCameraOn: boolean;
  toggleCamera: () => void;
  isSharing: boolean;
  startSharing: () => void;
  stopSharing: () => void;
  isRecordingComplete: boolean;
  downloadRecording: () => void;
  onFeedbackClick: () => void; // 클릭 핸들러 타입 정의 추가
}) => {
  return (
    <div className="w-full h-16 bg-[#1E1F22] flex justify-center items-center space-x-6">
      {/* Start/Stop Recording Button */}
      <button onClick={isRecording ? stopRecording : startRecording} className="bg-white p-2 rounded-full">
        {isRecording ? <StopIcon /> : isCameraOn ? <RecordIcon /> : <MicIcon />}
      </button>

      {/* Camera On/Off Button */}
      <button onClick={toggleCamera} className="bg-white p-2 rounded-full">
        {isCameraOn ? <CameraOnIcon /> : <CameraOffIcon />}
      </button>

      {/* Screen Share/Cancel Button */}
      <button onClick={isSharing ? stopSharing : startSharing} className="bg-white p-2 rounded-full">
        {isSharing ? <CancelIcon /> : <ShareIcon />}
      </button>

      {/* Download Button - 녹화가 완료되었을 때만 표시 */}
      {isRecordingComplete && (
        <button
          onClick={downloadRecording}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2"
        >
          <DownloadIcon />
          <span>Download</span>
        </button>
      )}

      {/* AI Feedback Button - 우측 끝에 위치 */}
      <button
        onClick={onFeedbackClick}
        className="ml-auto bg-[#FEE500] hover:bg-yellow-400 text-[#3B1E1E] px-4 py-2 rounded-full flex items-center gap-2"
      >
        <FeedbackIcon />
        <span>Feedback</span>
      </button>
    </div>
  );
};

export default Controls;
