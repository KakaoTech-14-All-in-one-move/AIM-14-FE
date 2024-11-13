interface FeedbackHeaderProps {
  currentIndex: number;
  totalFrames: number;
  timestamp: string;
}

export const FeedbackHeader = ({ currentIndex, totalFrames, timestamp }: FeedbackHeaderProps) => {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-white">Presentation Analysis</h1>
      <p className="text-discord200 mt-2 font-medium">
        Frame {currentIndex + 1} of {totalFrames} • {timestamp}
      </p>
    </div>
  );
};