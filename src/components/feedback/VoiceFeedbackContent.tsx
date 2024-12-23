import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { apiService } from '@/services/record/apiService';
import { VoiceFeedbackHeader } from './sections/VoiceFeedbackHeader';
import { VoiceFeedbackScoreSection } from './sections/VoiceFeedbackScoreSection';
import { VoiceFeedbackTimelineSection } from './sections/VoiceFeedbackTimelineSection';
import { RetryModal } from './sections/RetryModal';
import type { VoiceFeedbackResponse } from '@/components/feedback/types';

interface VoiceFeedbackContentProps {
  onNoResult: (message: string) => void;
}

export const VoiceFeedbackContent = ({ onNoResult }: VoiceFeedbackContentProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const videoId = location.state?.videoId;
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState({
    feedbackData: null as VoiceFeedbackResponse | null,
    isLoading: true,
    showModal: false,
    message: '',
  });

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    navigate('/record');
  }, [navigate]);

  const fetchFeedbackData = async () => {
    if (!videoId) {
      navigate('/');
      return;
    }

    try {
      abortControllerRef.current = new AbortController();
      const data = await apiService.pollFeedback(
        videoId,
        true,
        30,
        10000,
        abortControllerRef.current.signal,
      );

      // problem이 success이거나 null인 경우 모두 성공 처리
      if (data.problem === 'success' || data.problem === null) {
        if (data.analysis_result) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            feedbackData: data as VoiceFeedbackResponse,
          }));
        } else {
          throw new Error('분석 결과가 없습니다.');
        }
      } else {
        // error나 다른 상태일 경우
        throw new Error(data.message || '분석에 실패했습니다.');
      }
    } catch (error) {
      // 에러 발생 시 (200이 아닌 경우) 삭제 요청
      try {
        if (videoId) {
          await apiService.deleteVoiceData(videoId);
        }
      } catch (deleteError) {
        console.error('Failed to delete voice data:', deleteError);
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        showModal: true,
        message: error instanceof Error ? error.message : '서버와의 연결에 실패했습니다.',
      }));
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (videoId) {
      fetchFeedbackData().catch(error => {
        if (isMounted) {
          console.error('Error fetching feedback:', error);
        }
      });
    }

    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (state.isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-discord900">
        <div className="bg-discord800 p-8 rounded-xl shadow-lg flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-discord100 animate-spin" />
          <p className="mt-4 text-white text-lg font-medium">Analyzing your pronunciation...</p>
          <p className="text-discord200 text-sm mt-2">This may take 1-2 minutes</p>
          <button
            onClick={handleCancel}
            className="mt-6 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
          >
            Cancel Analysis
          </button>
        </div>
      </div>
    );
  }

  if (!state.feedbackData) {
    return (
      <RetryModal
        isOpen={state.showModal}
        onClose={() => {
          setState(prev => ({ ...prev, showModal: false }));
          navigate('/record');
        }}
        message={state.message}
      />
    );
  }

  const { analysis_result: result } = state.feedbackData;

  const handleBack = async () => {
    try {
      if (videoId) {
        await apiService.deleteVideoData(videoId);
      }
    } catch (error) {
      console.error('Failed to delete data:', error);
    }
    navigate('/record');
  };

  return (
    <div className="min-h-screen bg-discord900 py-8">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="bg-discord800 rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <VoiceFeedbackHeader onBack={handleBack} />

          {/* Content */}
          <div className="p-8">
            <VoiceFeedbackScoreSection
              audioSimilarity={result.audio_similarity}
              averageWpm={result.average_wpm}
              ttsWpm={result.tts_wpm}
              pronunciationAccuracy={result.average_pronunciation_accuracy}
              scriptSimilarity={result.script_similarity}
            />

            <VoiceFeedbackTimelineSection
              pronunciationScores={result.pronunciation_scores}
              wpmScores={result.wpm_scores}
            />
          </div>
        </div>
      </div>
    </div>
  );
};