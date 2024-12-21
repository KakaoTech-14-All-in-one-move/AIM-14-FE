import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { apiService } from '@/services/record/apiService';
import type { VoiceFeedbackResponse } from '@/components/feedback/types';

interface VoiceFeedbackContentProps {
  onNoResult: (message: string) => void;
}

export const VoiceFeedbackContent = ({ onNoResult }: VoiceFeedbackContentProps) => {
  const [feedbackData, setFeedbackData] = useState<VoiceFeedbackResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const fetchRef = useRef(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { videoId } = location.state || {};

  useEffect(() => {
    if (fetchRef.current) return;

    if (!videoId) {
      navigate('/');
      return;
    }

    const fetchFeedbackData = async () => {
      try {
        fetchRef.current = true;
        const response = await apiService.pollFeedback(videoId, true);
        setFeedbackData(response as VoiceFeedbackResponse);
      } catch (error) {
        onNoResult(error instanceof Error ? error.message : '분석 중 오류가 발생했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedbackData();

    return () => {
      if (videoId) {
        apiService.deleteVoiceData(videoId).catch(console.error);
      }
    };
  }, [videoId, navigate, onNoResult]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-discord900">
        <div className="bg-discord800 p-8 rounded-xl shadow-lg flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-discord100 animate-spin" />
          <p className="mt-4 text-white text-lg font-medium">Analyzing your pronunciation...</p>
          <p className="text-discord200 text-sm mt-2">This may take 1-2 minutes</p>
        </div>
      </div>
    );
  }

  if (!feedbackData) {
    return null;
  }

  const { analysis_result: result } = feedbackData;

  return (
    <div className="min-h-screen bg-discord900 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-discord700 rounded-lg shadow-xl p-6">
          <h1 className="text-3xl font-bold text-white mb-6">Voice Analysis Results</h1>

          <div className="space-y-6">
            {/* Overall Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ScoreCard
                title="Audio Similarity"
                value={`${(result.audio_similarity * 100).toFixed(1)}%`}
              />
              <ScoreCard
                title="Average WPM"
                value={`${result.average_wpm.toFixed(1)}`}
                subvalue={`Target: ${result.tts_wpm}`}
              />
              <ScoreCard
                title="Pronunciation Accuracy"
                value={`${(result.average_pronunciation_accuracy * 100).toFixed(1)}%`}
              />
            </div>

            {/* Pronunciation Timeline */}
            <div className="bg-discord800 p-4 rounded-lg">
              <h3 className="text-white font-semibold mb-4">Pronunciation Timeline</h3>
              <div className="space-y-2">
                {result.pronunciation_scores.map((score, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <span className="text-discord200 w-24">{score.time_segment}</span>
                    <div className="flex-1 bg-discord600 rounded-full h-4">
                      <div
                        className="bg-discord100 rounded-full h-full transition-all duration-300"
                        style={{ width: `${score.accuracy * 100}%` }}
                      />
                    </div>
                    <span className="text-discord100 w-16">{(score.accuracy * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* WPM Timeline */}
            <div className="bg-discord800 p-4 rounded-lg">
              <h3 className="text-white font-semibold mb-4">Speaking Speed Timeline</h3>
              <div className="space-y-2">
                {result.wpm_scores.map((score, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <span className="text-discord200 w-24">{score.time_segment}</span>
                    <div className="flex-1 bg-discord600 rounded-full h-4">
                      <div
                        className="bg-discord100 rounded-full h-full transition-all duration-300"
                        style={{ width: `${(score.wpm / 200) * 100}%` }}
                      />
                    </div>
                    <span className="text-discord100 w-16">{score.wpm.toFixed(1)} WPM</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ScoreCardProps {
  title: string;
  value: string;
  subvalue?: string;
}

const ScoreCard = ({ title, value, subvalue }: ScoreCardProps) => (
  <div className="bg-discord800 p-4 rounded-lg">
    <h3 className="text-discord200 text-sm font-medium mb-2">{title}</h3>
    <p className="text-white text-2xl font-bold">{value}</p>
    {subvalue && <p className="text-discord300 text-sm mt-1">{subvalue}</p>}
  </div>
);