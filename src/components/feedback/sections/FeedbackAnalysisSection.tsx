import { Tab } from '@headlessui/react';
import { CategoryIcon } from '@/components/feedback/CategoryIcon';
import { AlertCircle, Lightbulb } from 'lucide-react';
import type { FeedbackText, FeedbackCategoryType } from '@/components/feedback/types';

interface FeedbackAnalysisSectionProps {
  feedbackText?: FeedbackText;
}

export const FeedbackAnalysisSection = ({ feedbackText }: FeedbackAnalysisSectionProps) => {
  const categories: Array<{ id: FeedbackCategoryType; label: string }> = [
    { id: 'gaze_processing', label: '시선 처리' },
    { id: 'facial_expression', label: '표정' },
    { id: 'gestures', label: '손동작' },
    { id: 'posture_body', label: '자세' },
    { id: 'movement', label: '움직임' }
  ];

  return (
    <div className="bg-discord700 rounded-lg shadow-xl overflow-hidden">
      <Tab.Group>
        <Tab.List className="flex space-x-1 bg-discord800 p-1">
          {categories.map(({ id, label }) => (
            <Tab
              key={id}
              className={({ selected }) => `
        flex-1 py-3 px-4 text-sm font-medium rounded-md
        focus:outline-none transition-all duration-200
        flex items-center justify-center gap-2
        ${selected
                ? 'text-yellow-400'
                : 'text-white hover:bg-discord600 hover:text-white'
              }
      `}
            >
              {({ selected }) => (
                <>
                  <CategoryIcon
                    category={id}
                    className={selected ? 'text-yellow-400' : 'text-white'}
                  />
                  {label}
                </>
              )}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="p-4">
          {categories.map(({ id }) => (
            <Tab.Panel key={id} className="space-y-6 focus:outline-none">
              {/* 개선 필요 사항 섹션 */}
              <div className="bg-discord800 rounded-lg overflow-hidden">
                <div className="bg-red-900/20 border-l-4 border-red-500 p-4">
                  <div className="flex items-center space-x-3">
                    <AlertCircle className="text-red-400 w-6 h-6" />
                    <h3 className="text-lg font-bold text-white">
                      개선이 필요한 부분
                    </h3>
                  </div>
                  <p className="text-gray-300 mt-3 leading-relaxed pl-9">
                    {feedbackText?.[id]?.improvement}
                  </p>
                </div>
              </div>

              {/* 추천 사항 섹션 */}
              <div className="bg-discord800 rounded-lg overflow-hidden">
                <div className="bg-green-900/20 border-l-4 border-green-500 p-4">
                  <div className="flex items-center space-x-3">
                    <Lightbulb className="text-green-400 w-6 h-6" />
                    <h3 className="text-lg font-bold text-white">
                      추천 사항
                    </h3>
                  </div>
                  <p className="text-gray-300 mt-3 leading-relaxed pl-9">
                    {feedbackText?.[id]?.recommendations}
                  </p>
                </div>
              </div>
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};