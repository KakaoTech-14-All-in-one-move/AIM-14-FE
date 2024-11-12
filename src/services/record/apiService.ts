// src/services/apiService.ts
import { FeedbackItem } from '@/components/feedback/types.ts';

interface ApiConfig {
  baseUrl: string;
  aiServerUrl: string;
}

const config: ApiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  aiServerUrl: import.meta.env.VITE_AI_SERVER_URL || ''
};

export interface VideoUploadResponse {
  video_id: string;
}

export interface FeedbackResponse {
  feedbacks: FeedbackItem[];
  message: string;
  problem: string;
}

/**
 * 비디오 파일을 서버에 업로드
 */
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

/**
 * AI 피드백 데이터 가져오기
 */
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

/**
 * AI 피드백 데이터 폴링
 */
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