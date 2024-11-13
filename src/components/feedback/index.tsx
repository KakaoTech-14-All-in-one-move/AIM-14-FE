import { useNavigate } from 'react-router-dom';
import { FeedbackContent } from './FeedbackContent';

const Feedback = () => {
  const navigate = useNavigate();

  const handleNoResult = (message: string) => {
    alert(message);
    navigate('/record');
  };

  return (
    <div className="min-h-screen bg-discord900">
      <FeedbackContent onNoResult={handleNoResult} />
    </div>
  );
};

export default Feedback;