import StopIcon from "../../icons/stop";
import CameraOnIcon from "../../icons/camera-on";
import CameraOffIcon from "../../icons/camera-off";
import RecordIcon from "../../icons/record";
import MicIcon from "../../icons/mic";
import ShareIcon from "../../icons/share";
import CancelIcon from "../../icons/cancel";

const Controls = ({
                    isRecording,
                    startRecording,
                    stopRecording,
                    isCameraOn,
                    toggleCamera,
                    isSharing,
                    startSharing,
                    stopSharing,
                  }: {
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  isCameraOn: boolean;
  toggleCamera: () => void;
  isSharing: boolean;
  startSharing: () => void;
  stopSharing: () => void;
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
    </div>
  );
};

export default Controls;
