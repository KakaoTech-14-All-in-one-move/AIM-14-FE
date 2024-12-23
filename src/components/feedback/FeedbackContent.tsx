import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { apiService } from '@/services/record/apiService';
import { FeedbackHeader } from '@/components/feedback/sections/FeedbackHeader';
import { FeedbackImageSection } from '@/components/feedback/sections/FeedbackImageSection';
import { FeedbackAnalysisSection } from '@/components/feedback/sections/FeedbackAnalysisSection';
import type { FeedbackItem } from '@/components/feedback/types';
import { RetryModal } from './sections/RetryModal';

interface FeedbackContentProps {
  onNoResult: (message: string) => void;
}

export const FeedbackContent = ({ onNoResult }: FeedbackContentProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const videoId = location.state?.videoId;
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState({
    currentIndex: 0,
    feedbackData: [] as FeedbackItem[],
    isLoading: true,
    showModal: false,
    message: ''
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
        false,
        30,
        10000,
        abortControllerRef.current.signal
      );

      // problem이 success이거나 null인 경우 모두 성공 처리
      if (data.problem === 'success' || data.problem === null) {
        if (data.feedbacks && data.feedbacks.length > 0) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            feedbackData: data.feedbacks
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
          await apiService.deleteVideoData(videoId);
        }
      } catch (deleteError) {
        console.error('Failed to delete video data:', deleteError);
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        showModal: true,
        message: error instanceof Error ? error.message : '서버와의 연결에 실패했습니다.'
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
          <p className="mt-4 text-white text-lg font-medium">발표 영상 분석중...</p>
          <p className="text-gray-500 text-sm mt-2">영상 길이에 따라 분석 시간이 다를 수 있습니다.</p>
          <button
            onClick={handleCancel}
            className="mt-6 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
          >
            피드백 취소
          </button>
        </div>
      </div>
    );
  }

  if (state.feedbackData.length === 0) {
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

  const currentFeedback = state.feedbackData[state.currentIndex];

  return (
    <>
      <div className="min-h-screen bg-discord900 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <FeedbackHeader
              currentIndex={state.currentIndex}
              totalFrames={state.feedbackData.length}
              timestamp={currentFeedback?.timestamp}
              onBack={() => navigate('/record')}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <FeedbackImageSection
              currentIndex={state.currentIndex}
              setCurrentIndex={(index) => setState(prev => ({ ...prev, currentIndex: index }))}
              totalFrames={state.feedbackData.length}
              imageBase64={currentFeedback?.image_base64}
            />

            <FeedbackAnalysisSection
              feedbackText={currentFeedback?.feedback_text}
            />
          </div>
        </div>
      </div>
    </>
  );
};