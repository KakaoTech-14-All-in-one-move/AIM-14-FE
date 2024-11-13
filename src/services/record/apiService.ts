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

export const uploadVideo = async (videoFile: Blob): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', videoFile, 'recording.webm');

    const response = await fetch(`${config.baseUrl}/api/video/receive-video/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const data: VideoUploadResponse = await response.json();
    console.log(data.video_id);
    return data.video_id;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
};

export const getFeedbackData = async (videoId: string): Promise<FeedbackResponse> => {
  try {
    const response = await fetch(`${config.aiServerUrl}/api/video/video-send-feedback/${videoId}/`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: FeedbackResponse = await response.json();
    console.log(data.message)

    if (!data.feedbacks?.length || data.problem === "none") {
      throw new Error(data.message || '분석 결과가 없습니다. 다시 시도해주세요.');
    }

    return data;
  } catch (error) {
    console.error('Error getting feedback:', error);
    throw error;
  }
};

export const pollFeedbackData = getFeedbackData;