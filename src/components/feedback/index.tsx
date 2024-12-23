import { useNavigate, useLocation } from 'react-router-dom';
import { FeedbackContent } from '@/components/feedback/FeedbackContent';
import { VoiceFeedbackContent } from '@/components/feedback/VoiceFeedbackContent';

const Feedback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!location.state) {
    navigate('/');
    return null;
  }

  const { isVoice } = location.state;
  console.log('isVoice:', isVoice);

  const handleNoResult = (message: string) => {
    alert(message);
    navigate('/record');
  };

  return (
    <div className="min-h-screen bg-discord900">
      {isVoice ? (
        <VoiceFeedbackContent onNoResult={handleNoResult} />
      ) : (
        <FeedbackContent onNoResult={handleNoResult} />
      )}
    </div>
  );
};

export default Feedback;