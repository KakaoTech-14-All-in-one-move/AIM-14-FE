import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FeedbackImageSectionProps {
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  totalFrames: number;
  imageBase64: string;
}

export const FeedbackImageSection = ({
                                       currentIndex,
                                       setCurrentIndex,
                                       totalFrames,
                                       imageBase64
                                     }: FeedbackImageSectionProps) => {
  return (
    <div className="bg-discord700 rounded-lg shadow-xl p-4">
      <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-discord600">
        <img
          src={`data:image/jpeg;base64,${imageBase64}`}
          alt={`Frame ${currentIndex + 1}`}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="p-2 rounded-lg hover:bg-discord600 disabled:opacity-50 disabled:hover:bg-transparent transition-colors duration-200"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        <div className="flex space-x-2">
          {Array.from({ length: totalFrames }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                currentIndex === idx
                  ? 'bg-yellow-400' // 활성 도트를 노란색으로
                  : 'bg-white' // 비활성 도트를 하얀색으로
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentIndex(Math.min(totalFrames - 1, currentIndex + 1))}
          disabled={currentIndex === totalFrames - 1}
          className="p-2 rounded-lg hover:bg-discord600 disabled:opacity-50 disabled:hover:bg-transparent transition-colors duration-200"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
};