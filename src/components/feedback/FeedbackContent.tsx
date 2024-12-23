import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { apiService } from '@/services/record/apiService';
import { FeedbackHeader } from '@/components/feedback/sections/FeedbackHeader';
import { FeedbackImageSection } from '@/components/feedback/sections/FeedbackImageSection';
import { FeedbackAnalysisSection } from '@/components/feedback/sections/FeedbackAnalysisSection';
import type { FeedbackItem } from '@/components/feedback/types';

interface FeedbackContentProps {
  onNoResult: (message: string) => void;
}

const RetryModal = ({
                      isOpen,
                      onClose,
                      message,
                    }: {
  isOpen: boolean;
  onClose: () => void;
  message: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">알림</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

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
    console.log('1. fetchFeedbackData started with videoId:', videoId);

    if (!videoId) {
      console.log('No videoId found, navigating to home');
      navigate('/');
      return;
    }

    try {
      console.log('2. Starting pollFeedback request');
      abortControllerRef.current = new AbortController();
      const data = await apiService.pollFeedback(
        videoId,
        false,
        30,
        10000,
        abortControllerRef.current.signal
      );
      console.log('3. pollFeedback response received:', data);

      if (data.problem === 'success' && data.feedbacks && data.feedbacks.length > 0) {
        console.log('4a. Valid feedback data received, updating state');
        setState(prev => ({
          ...prev,
          isLoading: false,
          feedbackData: data.feedbacks
        }));
        console.log('5a. State updated with feedback data');
      } else {
        console.log('4b. No valid feedback data, showing modal');
        setState(prev => ({
          ...prev,
          isLoading: false,
          showModal: true,
          message: data.message || '분석 결과가 없습니다.'
        }));
        console.log('5b. State updated to show modal');
      }
    } catch (error) {
      console.log('4c. Error occurred:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        showModal: true,
        message: error instanceof Error ? error.message : '서버와의 연결에 실패했습니다.'
      }));
      console.log('5c. State updated with error');
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

  const handleModalClose = async () => {
    try {
      if (videoId) {
        await apiService.deleteVideoData(videoId);
      }
      setState(prev => ({ ...prev, showModal: false }));
      navigate('/record');
    } catch (error) {
      console.error('Failed to delete video data:', error);
      // 삭제 실패해도 페이지는 이동
      setState(prev => ({ ...prev, showModal: false }));
      navigate('/record');
    }
  };

  if (state.isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-discord900">
        <div className="bg-discord800 p-8 rounded-xl shadow-lg flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-discord100 animate-spin" />
          <p className="mt-4 text-white text-lg font-medium">Analyzing your presentation...</p>
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

  if (state.feedbackData.length === 0) {
    return (
      <RetryModal
        isOpen={state.showModal}
        onClose={handleModalClose}
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
            />
            <button
              onClick={() => navigate('/record')}
              className="flex items-center px-4 py-2 bg-discord700 hover:bg-discord600 text-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              녹화 페이지로 돌아가기
            </button>
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