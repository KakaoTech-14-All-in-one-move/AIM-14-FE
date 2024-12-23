import React from 'react';
import { ArrowLeft, Clock, Layers } from 'lucide-react';

interface FeedbackHeaderProps {
  currentIndex: number;
  totalFrames: number;
  timestamp: string;
  onBack?: () => void;
}

export const FeedbackHeader = ({
                                 currentIndex,
                                 totalFrames,
                                 timestamp,
                                 onBack,
                               }: FeedbackHeaderProps) => {
  return (
    <div className="w-full">
      <div className="flex justify-between items-start px-6 py-4">
        <div className="flex-1">
          <div className="flex flex-col">
            <div className="flex items-center space-x-4">
              <h1 className="text-4xl font-bold text-white">발표 영상 피드백</h1>
              <div className="flex items-center space-x-2 bg-gray-800/50 px-4 py-2 rounded-lg">
                <Layers className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 font-medium text-lg">
                  {currentIndex + 1} / {totalFrames}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-gray-400 mt-3">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{timestamp}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onBack}
          className="flex items-center space-x-2 px-4 py-2 text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>녹화 페이지로 돌아가기</span>
        </button>
      </div>

      <div className="w-full bg-gray-800/30 h-2 px-6">
        <div
          className="bg-yellow-400 h-full rounded-full transition-all duration-300"
          style={{
            width: `${((currentIndex + 1) / totalFrames) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};