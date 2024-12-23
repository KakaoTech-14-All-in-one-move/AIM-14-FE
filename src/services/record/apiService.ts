import type { VideoFeedbackResponse, VoiceFeedbackResponse, UploadResponse } from '@/components/feedback/types';

const config = {
  videoServerUrl: import.meta.env.VITE_AI_VIDEO_SERVER_URL,
  voiceServerUrl: import.meta.env.VITE_AI_VOICE_SERVER_URL,
  isDev: import.meta.env.VITE_ENV === 'dev'
};

class ApiService {
  // Video server API calls
  async uploadVideoForAnalysis(videoFile: Blob): Promise<UploadResponse> {
    if (config.isDev) {
      const jsonResponse: UploadResponse = {
        video_id: 'test-video-id',
        message: 'Success'
      };
      console.log('Dev mode: Upload response:', jsonResponse);
      return jsonResponse;
    }

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
    if (config.isDev) {
      const mockData = await import('@/services/record/mockVideoFeedback.json');
      console.log('Mock data loaded:', mockData);
      return mockData;
    }

    const response = await fetch(
      `${config.videoServerUrl}/api/video/video-send-feedback/${videoId}`
    );

    return response.json();
  }

  async deleteVideoData(videoId: string): Promise<void> {
    if (config.isDev) {
      console.log('Delete video data in dev mode:', videoId);
      return;
    }

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
    if (config.isDev) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { videoId: 'test-voice-id', message: 'Success' };
    }

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
    if (config.isDev) {
      const mockData = await import('@/services/record/mockVideoFeedback.json');
      return mockData;
    }

    const response = await fetch(
      `${config.voiceServerUrl}/api/pronun/send-feedback/${videoId}`
    );

    return response.json();
  }

  async deleteVoiceData(videoId: string): Promise<void> {
    if (config.isDev) {
      console.log('Delete voice data in dev mode:', videoId);
      return;
    }

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
    maxAttempts = 30,
    initialInterval = 10000,
    signal?: AbortSignal
  ): Promise<VideoFeedbackResponse | VoiceFeedbackResponse> {
    // 개발 환경에서는 mock 데이터 사용
    if (config.isDev) {
      const mockData = await import('@/services/record/mockVideoFeedback.json');
      return { ...mockData.default, problem: 'success' };
    }

    const getFeedback = isVoice
      ? () => this.getVoiceFeedback(videoId)
      : () => this.getVideoFeedback(videoId);

    let currentInterval = initialInterval;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }

        const response = await getFeedback();

        if (response.problem !== 'processing') {
          return response;
        }

        await Promise.race([
          new Promise(resolve => setTimeout(resolve, currentInterval)),
          new Promise((_, reject) => {
            if (signal) {
              signal.addEventListener('abort', () => reject(new Error('Request aborted')));
            }
          })
        ]);

        currentInterval = Math.min(currentInterval * 1.5, 30000);
      } catch (error) {
        throw error;
      }
    }

    throw new Error('피드백 분석 시간이 초과되었습니다.');
  }
}

export const apiService = new ApiService();