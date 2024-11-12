import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as apiService from "@/services/record/apiService";
import StopIcon from "@/common/icons/stop";
import CameraOnIcon from "@/common/icons/camera-on";
import RecordIcon from "@/common/icons/record";
import MicIcon from "@/common/icons/mic";
import ShareIcon from "@/common/icons/share";
import CancelIcon from "@/common/icons/cancel";
import DownloadIcon from "@/common/icons/download";
import FeedbackIcon from "@/common/icons/feedback";
import { FeedbackResponse } from '@/services/record/apiService.ts';

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
  onFeedbackClick: (recordedFile: Blob, attachedFile?: File) => void;  // 추가된 prop
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
                    recordedFile
                  }: ControlsProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleFeedbackClick = async () => {
    if (!recordedFile) {
      setError("No recording file available");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // apiService로 접근하도록 수정
      const videoId = await apiService.uploadVideo(recordedFile);

      navigate('/feedback', { state: { videoId } });

    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to upload video");
      console.error('Failed to process feedback:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full h-16 bg-[#1E1F22] flex justify-center items-center space-x-6">
      {/* Start/Stop Recording Button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className="bg-white p-2 rounded-full"
      >
        {isRecording ? <StopIcon /> : <RecordIcon />}
      </button>

      {/* Camera On/Off Button */}
      <button
        onClick={toggleCamera}
        className="bg-white p-2 rounded-full"
      >
        {isCameraOn ? <CameraOnIcon /> : <MicIcon />}
      </button>

      {/* Screen Share/Cancel Button */}
      <button
        onClick={isSharing ? stopSharing : startSharing}
        className="bg-white p-2 rounded-full"
      >
        {isSharing ? <CancelIcon /> : <ShareIcon />}
      </button>

      {/* Download Button - 녹화가 완료되었을 때만 표시 */}
      {isRecordingComplete && (
        <button
          onClick={downloadRecording}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-full flex items-center gap-2"
        >
          <DownloadIcon />
          <span>Download</span>
        </button>
      )}

      {/* AI Feedback Button - 녹화가 완료되었을 때만 표시 */}
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

      {/* Error message */}
      {error && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-md">
          {error}
        </div>
      )}
    </div>
  );
};

export default Controls;

// src/services/apiService.ts
interface ApiConfig {
  baseUrl: string;
  aiServerUrl: string;
}

const config: ApiConfig = {
  baseUrl: import.meta.env.REACT_APP_API_BASE_URL || '',
  aiServerUrl: import.meta.env.REACT_APP_AI_SERVER_URL || ''
};

// 비디오 업로드 응답 타입
interface VideoUploadResponse {
  video_id: string;
}

export const uploadVideo = async (videoFile: Blob): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('video', videoFile, 'recording.webm');

    const response = await fetch(`${config.baseUrl}/api/video/receive-video/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: VideoUploadResponse = await response.json();
    return data.video_id;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
};

export const getFeedbackData = async (videoId: string): Promise<FeedbackResponse> => {
  try {
    const response = await fetch(`${config.aiServerUrl}/video/video-send-feedback/${videoId}/`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: FeedbackResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting feedback:', error);
    throw error;
  }
};

export const pollFeedbackData = async (
  videoId: string,
  maxAttempts = 60,
  interval = 1000
): Promise<FeedbackResponse> => {
  let attempts = 0;

  const executePoll = async (): Promise<FeedbackResponse> => {
    try {
      const result = await getFeedbackData(videoId);
      return result;
    } catch (error) {
      if (attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, interval));
        return executePoll();
      }
      throw new Error('Polling timeout: AI analysis is taking longer than expected');
    }
  };

  return executePoll();
};