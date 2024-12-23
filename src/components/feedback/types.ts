export type FeedbackCategoryType = 'gaze_processing' | 'facial_expression' | 'gestures' | 'posture_body' | 'movement';

export interface FeedbackCategory {
  improvement: string;
  recommendations: string;
}

export interface FeedbackText {
  gaze_processing: FeedbackCategory;
  facial_expression: FeedbackCategory;
  gestures: FeedbackCategory;
  posture_body: FeedbackCategory;
  movement: FeedbackCategory;
}

export interface FeedbackItem {
  video_id: string;
  frame_index: number;
  timestamp: string;
  feedback_text: FeedbackText;
  image_base64: string;
}

export interface VideoFeedbackResponse {
  feedbacks: FeedbackItem[];
  message: string;
  problem: string;
}

export interface VoiceFeedbackResponse {
  video_id: string;
  message: string;
  analysis_result: {
    audio_similarity: number;
    average_wpm: number;
    tts_wpm: number;
    average_pronunciation_accuracy: number;
    script_similarity: number;
    pronunciation_scores: Array<{
      time_segment: string;
      accuracy: number;
    }>;
    wpm_scores: Array<{
      time_segment: string;
      wpm: number;
    }>;
  };
  problem: 'success' | 'processing' | 'error';
}

export interface UploadResponse {
  video_id: string;
  message: string;
}

export interface VideoFeedbackResponse {
  message: string;
  problem: 'success' | 'processing' | 'error' | null;
  feedbacks: FeedbackItem[];
}