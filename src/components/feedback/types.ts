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
  frame_index: number;
  timestamp: string;
  feedback_text: FeedbackText;
  image_base64: string;
}

export interface FeedbackResponse {
  feedbacks: FeedbackItem[];
  message: string;
  problem: string;
}