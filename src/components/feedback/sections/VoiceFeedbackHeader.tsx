import { useLocation, useNavigate } from 'react-router-dom';
import { apiService } from '@/services/record/apiService';
import { Mic2, ArrowLeft } from 'lucide-react';

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
    <div className="p-8 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-4xl font-bold text-white">음성 피드백</h1>
        <div className="flex items-center space-x-2 bg-discord800 px-4 py-2 rounded-lg">
          <Mic2 className="w-5 h-5 text-yellow-400" />
          <span className="text-yellow-400 font-medium">Voice Analysis</span>
        </div>
      </div>

      <button
        onClick={handleBack}
        className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>녹화 페이지로 돌아가기</span>
      </button>
    </div>
  );
};