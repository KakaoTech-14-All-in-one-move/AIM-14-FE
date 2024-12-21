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

export interface VoiceFeedbackScores {
  time_segment: string;
  accuracy: number;
}

export interface WPMScores {
  time_segment: string;
  wpm: number;
}

export interface VoiceAnalysisResult {
  audio_similarity: number;
  average_wpm: number;
  tts_wpm: number;
  average_pronunciation_accuracy: number;
  script_similarity: number;
  pronunciation_scores: VoiceFeedbackScores[];
  wpm_scores: WPMScores[];
}

export interface VoiceFeedbackResponse {
  video_id: string;
  message: string;
  analysis_result: VoiceAnalysisResult;
  problem: string;
}

export interface UploadResponse {
  video_id: string;
  message: string;
}