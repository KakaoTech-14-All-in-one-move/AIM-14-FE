import { VideoFeedbackResponse, VoiceFeedbackResponse, UploadResponse } from '@/components/feedback/types.ts';

const config = {
  videoServerUrl: import.meta.env.VITE_AI_VIDEO_SERVER_URL,
  voiceServerUrl: import.meta.env.VITE_AI_VOICE_SERVER_URL,
};

class ApiService {
  // Video server API calls
  async uploadVideoForAnalysis(videoFile: Blob): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', videoFile, 'recording.webm');

    const response = await fetch(`${config.videoServerUrl}/api/video/receive-video`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Video upload failed: ${response.status}`);
    }

    return response.json();
  }

  async getVideoFeedback(videoId: string): Promise<VideoFeedbackResponse> {
    const response = await fetch(
      `${config.videoServerUrl}/api/video/video-send-feedback/${videoId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get video feedback: ${response.status}`);
    }

    const data: VideoFeedbackResponse = await response.json();

    if (!data.feedbacks?.length || data.problem === 'none') {
      throw new Error(data.message || '분석 결과가 없습니다. 다시 시도해주세요.');
    }

    return data;
  }

  async deleteVideoData(videoId: string): Promise<void> {
    const response = await fetch(
      `${config.videoServerUrl}/api/video/delete_files/${videoId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete video data: ${response.status}`);
    }
  }

  // Voice server API calls
  async uploadVoiceWithScript(voiceFile: Blob, script: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', voiceFile, 'recording.webm');
    formData.append('script', script);

    const response = await fetch(
      `${config.voiceServerUrl}/api/pronun/upload-video-with-script`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Voice upload failed: ${response.status}`);
    }

    return response.json();
  }

  async getVoiceFeedback(videoId: string): Promise<VoiceFeedbackResponse> {
    const response = await fetch(
      `${config.voiceServerUrl}/api/pronun/send-feedback/${videoId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get voice feedback: ${response.status}`);
    }

    const data = await response.json();

    if (data.problem === 'none') {
      throw new Error(data.message || '분석 결과가 없습니다. 다시 시도해주세요.');
    }

    return data;
  }

  async deleteVoiceData(videoId: string): Promise<void> {
    const response = await fetch(
      `${config.voiceServerUrl}/api/pronun/delete_files/${videoId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete voice data: ${response.status}`);
    }
  }

  // Polling helper with exponential backoff
  async pollFeedback(
    videoId: string,
    isVoice: boolean,
    maxAttempts = 30, // 5분
    initialInterval = 10000 // 10초
  ): Promise<VideoFeedbackResponse | VoiceFeedbackResponse> {
    const getFeedback = isVoice
      ? () => this.getVoiceFeedback(videoId)
      : () => this.getVideoFeedback(videoId);

    let currentInterval = initialInterval;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await getFeedback();
        if (response.problem !== 'processing') {
          return response;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('분석 결과가 없습니다')) {
          throw error;
        }
        console.warn(`Polling attempt ${attempt + 1} failed:`, error);
      }

      // Exponential backoff with max of 30 seconds
      currentInterval = Math.min(currentInterval * 1.5, 30000);
      await new Promise(resolve => setTimeout(resolve, currentInterval));
    }

    throw new Error('피드백 분석 시간이 초과되었습니다. 다시 시도해주세요.');
  }
}

export const apiService = new ApiService();

// 기존 코드와의 호환성을 위한 export
export const { getVideoFeedback: pollFeedbackData } = apiService;