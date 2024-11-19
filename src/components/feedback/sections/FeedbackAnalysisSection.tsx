import { Tab } from '@headlessui/react';
import { CategoryIcon } from '@/components/feedback/CategoryIcon';
import type { FeedbackText, FeedbackCategoryType } from '@/components/feedback/types';

interface FeedbackAnalysisSectionProps {
  feedbackText?: FeedbackText;
}

export const FeedbackAnalysisSection = ({ feedbackText }: FeedbackAnalysisSectionProps) => {
  const categories: Array<{ id: FeedbackCategoryType; label: string }> = [
    { id: 'gaze_processing', label: 'Eye Contact' },
    { id: 'facial_expression', label: 'Facial Expression' },
    { id: 'gestures', label: 'Gestures' },
    { id: 'posture_body', label: 'Posture' },
    { id: 'movement', label: 'Movement' }
  ];

  return (
    <div className="bg-discord700 rounded-lg shadow-xl overflow-hidden">
      <Tab.Group>
        <Tab.List className="flex space-x-1 bg-discord800 p-1">
          {categories.map(({ id, label }) => (
            <Tab
              key={id}
              className={({ selected }) => `
                flex-1 py-2.5 px-3 text-sm font-medium rounded-md
                focus:outline-none transition-all duration-200
                ${selected
                ? 'bg-discord500 text-white shadow-lg'
                : 'text-gray-300 hover:bg-discord600 hover:text-white'
              }
              `}
            >
              {label}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="p-4">
          {categories.map(({ id }) => (
            <Tab.Panel key={id} className="space-y-6 focus:outline-none">
              <div className="space-y-4">
                <div className="flex items-center space-x-3 bg-discord800 p-3 rounded-lg">
                  <CategoryIcon category={id} className="text-discord100" />
                  <h3 className="text-lg font-bold text-white">
                    Areas for Improvement
                  </h3>
                </div>
                <p className="text-gray-300 pl-4 leading-relaxed">
                  {feedbackText?.[id]?.improvement}
                </p>

                <div className="flex items-center space-x-3 bg-discord800 p-3 rounded-lg mt-6">
                  <CategoryIcon category={id} className="text-discord100" />
                  <h3 className="text-lg font-bold text-white">
                    Recommendations
                  </h3>
                </div>
                <p className="text-gray-300 pl-4 leading-relaxed">
                  {feedbackText?.[id]?.recommendations}
                </p>
              </div>
            </Tab.Panel>
          ))}
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};