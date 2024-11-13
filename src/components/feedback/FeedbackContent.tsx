import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { pollFeedbackData } from '@/services/record/apiService';
import { FeedbackHeader } from './sections/FeedbackHeader';
import { FeedbackImageSection } from './sections/FeedbackImageSection';
import { FeedbackAnalysisSection } from './sections/FeedbackAnalysisSection';
import type { FeedbackItem } from './types';

interface FeedbackContentProps {
  onNoResult: (message: string) => void;
}

export const FeedbackContent = ({ onNoResult }: FeedbackContentProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedbackData, setFeedbackData] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fetchRef = useRef(false);

  const location = useLocation();
  const navigate = useNavigate();
  const videoId = location.state?.videoId;

  useEffect(() => {
    if (fetchRef.current) return;

    if (!videoId) {
      navigate('/');
      return;
    }

    const fetchFeedbackData = async () => {
      try {
        fetchRef.current = true;
        const response = await pollFeedbackData(videoId);

        console.log('Response feedbacks:', response.feedbacks);

        if (!response.feedbacks || response.problem === "none") {
          console.log("NOTHING");
          onNoResult(response.message || '분석 결과가 없습니다. 다시 시도해주세요.');
          return;
        }

        setFeedbackData(response.feedbacks);
      } catch (error) {
        onNoResult('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedbackData();
  }, [videoId, navigate, onNoResult]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-discord900">
        <div className="bg-discord800 p-8 rounded-xl shadow-lg flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-discord100 animate-spin" />
          <p className="mt-4 text-white text-lg font-medium">Analyzing your presentation...</p>
          <p className="text-discord200 text-sm mt-2">This may take 1-2 minutes</p>
        </div>
      </div>
    );
  }

  if (!feedbackData || feedbackData.length === 0) {
    return null;
  }

  const currentFeedback = feedbackData[currentIndex];

  return (
    <div className="min-h-screen bg-discord900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
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