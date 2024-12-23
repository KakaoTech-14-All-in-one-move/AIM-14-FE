import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/record/apiService';
import StopIcon from '@/common/icons/stop';
import CameraOnIcon from '@/common/icons/camera-on';
import RecordIcon from '@/common/icons/record';
import MicIcon from '@/common/icons/mic';
import ShareIcon from '@/common/icons/share';
import CancelIcon from '@/common/icons/cancel';
import DownloadIcon from '@/common/icons/download';
import FeedbackIcon from '@/common/icons/feedback';
import { HomeIcon } from 'lucide-react';

interface ControlsProps {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  isCameraOn: boolean;
  toggleCamera: () => void;
  isSharing: boolean;
  startSharing: () => Promise<void>;
  stopSharing: () => void;
  isRecordingComplete: boolean;
  downloadRecording: () => void;
  recordedFile: Blob | null;
  attachedFile?: File;
  cleanupMediaStreams: () => void;
}

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
                    recordedFile,
                    attachedFile,
                    cleanupMediaStreams,
                  }: ControlsProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupMediaStreams();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cleanupMediaStreams]);

  const handleHomeClick = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    }

    if (isSharing) {
      stopSharing();
    }

    cleanupMediaStreams();
    await new Promise(resolve => setTimeout(resolve, 100));
    navigate('/home');
  }, [isRecording, isSharing, stopRecording, stopSharing, cleanupMediaStreams, navigate]);

  const handleFeedbackClick = async () => {
    if (!recordedFile) {
      setError('No recording file available');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      cleanupMediaStreams();

      let uploadResponse;
      if (!isCameraOn) {
        // Voice recording case
        uploadResponse = await apiService.uploadVoiceWithScript(
          recordedFile,
          attachedFile
        );
      } else {
        // Video recording case
        uploadResponse = await apiService.uploadVideoForAnalysis(recordedFile);
      }

      navigate('/feedback', {
        state: {
          videoId: uploadResponse.video_id,
          isVoice: !isCameraOn
        }
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to upload video');
      console.error('Failed to process feedback:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full h-16 bg-[#1E1F22] flex justify-center items-center space-x-6">
      <button
        onClick={handleHomeClick}
        className="bg-white p-2 rounded-full hover:bg-gray-100"
        title="Home"
      >
        <HomeIcon />
      </button>

      <button
        onClick={isRecording ? stopRecording : startRecording}
        className="bg-white p-2 rounded-full"
      >
        {isRecording ? <StopIcon /> : <RecordIcon />}
      </button>

      <button
        onClick={toggleCamera}
        disabled={isRecording}
        className={`p-2 rounded-full ${
          isRecording
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-white hover:bg-gray-100'
        }`}
      >
        {isCameraOn ? <CameraOnIcon /> : <MicIcon />}
      </button>

      <button
        onClick={isSharing ? stopSharing : startSharing}
        className="bg-white p-2 rounded-full"
      >
        {isSharing ? <CancelIcon /> : <ShareIcon />}
      </button>

      {isRecordingComplete && (
        <button
          onClick={downloadRecording}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-full flex items-center gap-2"
        >
          <DownloadIcon />
          <span>Download</span>
        </button>
      )}

      {isRecordingComplete && (
        <button
          onClick={handleFeedbackClick}
          disabled={isUploading}
          className={`
            ${isUploading ? 'bg-gray-400' : 'bg-[#FEE500] hover:bg-yellow-400'}
            text-[#3B1E1E] px-4 py-2 rounded-full flex items-center gap-2
            transition-colors duration-200
            disabled:cursor-not-allowed
          `}
        >
          <FeedbackIcon />
          <span>{isUploading ? 'Uploading...' : 'Feedback'}</span>
        </button>
      )}

      {error && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
};

export default Controls;