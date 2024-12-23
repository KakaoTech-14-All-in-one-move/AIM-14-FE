import { useLocation, useNavigate } from 'react-router-dom';
import { apiService } from '@/services/record/apiService';

export const VoiceFeedbackHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const videoId = location.state?.videoId;
  const isVoice = location.state?.isVoice;

  const handleBack = async () => {
    try {
      if (videoId) {
        await apiService.deleteVoiceData(videoId);
      }
    } catch (error) {
      console.error('Failed to delete data:', error);
    }
    navigate('/record');
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-3xl font-bold text-white">Voice Analysis Results</h1>
      <button
        onClick={handleBack}
        className="px-4 py-2 bg-discord600 hover:bg-discord500 text-white rounded transition-colors"
      >
        녹화 페이지로 돌아가기
      </button>
    </div>
  );
};