interface FeedbackHeaderProps {
  currentIndex: number;
  totalFrames: number;
  timestamp: string;
}

export const FeedbackHeader = ({ currentIndex, totalFrames, timestamp }: FeedbackHeaderProps) => {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900">Presentation Analysis</h1>
      <p className="text-gray-600 mt-2">
        Frame {currentIndex + 1} of {totalFrames} • {timestamp}
      </p>
    </div>
  );
};