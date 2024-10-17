import StopIcon from "../../icons/stop";
import CameraOnIcon from "../../icons/camera-on";
import CameraOffIcon from "../../icons/camera-off";
import RecordIcon from "../../icons/record";
import MicIcon from "../../icons/mic";
import ShareIcon from "../../icons/share";
import CancelIcon from "../../icons/cancel";
import DownloadIcon from "../../icons/download"; // DownloadIcon 추가

const Controls = ({
                    isRecording,
                    startRecording,
                    stopRecording,
                    isCameraOn,
                    toggleCamera,
                    isSharing,
                    startSharing,
                    stopSharing,
                    isRecordingComplete, // 녹화 완료 여부 추가
                    downloadRecording, // 다운로드 함수 추가
                  }: {
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  isCameraOn: boolean;
  toggleCamera: () => void;
  isSharing: boolean;
  startSharing: () => void;
  stopSharing: () => void;
  isRecordingComplete: boolean; // 타입 정의 추가
  downloadRecording: () => void; // 다운로드 함수 타입 정의 추가
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

      {/* Download Button - 녹화가 완료되었을 때 배경을 변경 */}
      {isRecordingComplete && (
        <button
          onClick={downloadRecording}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2"
        >
          <DownloadIcon />
          <span>Download</span>
        </button>
      )}
    </div>
  );
};

export default Controls;
