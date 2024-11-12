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
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="relative aspect-video overflow-hidden rounded-lg">
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
          className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex space-x-2">
          {Array.from({ length: totalFrames }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full ${
                currentIndex === idx ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentIndex(Math.min(totalFrames - 1, currentIndex + 1))}
          disabled={currentIndex === totalFrames - 1}
          className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-50"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};