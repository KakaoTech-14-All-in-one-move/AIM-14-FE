import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pollFeedbackData } from '@/services/record/apiService';
import { FeedbackHeader } from './sections/FeedbackHeader';
import { FeedbackImageSection } from './sections/FeedbackImageSection';
import { FeedbackAnalysisSection } from './sections/FeedbackAnalysisSection';
import type { FeedbackItem } from './types';

export const FeedbackContent = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedbackData, setFeedbackData] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const videoId = location.state?.videoId;

  useEffect(() => {
    const fetchFeedbackData = async () => {
      if (!videoId) {
        setError('No video ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await pollFeedbackData(videoId);
        setFeedbackData(response.feedbacks);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load feedback data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedbackData();
  }, [videoId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Analyzing your presentation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  const currentFeedback = feedbackData[currentIndex];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <FeedbackHeader
          currentIndex={currentIndex}
          totalFrames={feedbackData.length}
          timestamp={currentFeedback?.timestamp}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <FeedbackImageSection
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
            totalFrames={feedbackData.length}
            imageBase64={currentFeedback?.image_base64}
          />

          <FeedbackAnalysisSection
            feedbackText={currentFeedback?.feedback_text}
          />
        </div>
      </div>
    </div>
  );
};