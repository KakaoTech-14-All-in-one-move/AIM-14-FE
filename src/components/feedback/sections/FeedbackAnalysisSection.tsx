import { Tab } from '@headlessui/react';
import { CategoryIcon } from '../CategoryIcon';
import type { FeedbackText, FeedbackCategoryType } from '../types';

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
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <Tab.Group>
        <Tab.List className="flex space-x-1 bg-blue-50 p-1">
          {categories.map(({ id, label }) => (
            <Tab
              key={id}
              className={({ selected }) => `
                flex-1 py-3 px-4 text-sm font-medium rounded-lg
                focus:outline-none
                ${selected
                ? 'bg-white text-blue-700 shadow'
                : 'text-gray-500 hover:bg-white/[0.5] hover:text-blue-600'
              }
              `}
            >
              {label}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="p-6">
          {categories.map(({ id }) => (
            <Tab.Panel key={id} className="space-y-6 focus:outline-none">
              <div className="space-y-4">
                <div className="flex items-center">
                  <CategoryIcon category={id} />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Areas for Improvement
                  </h3>
                </div>
                <p className="text-gray-700 pl-10">
                  {feedbackText?.[id]?.improvement}
                </p>

                <div className="flex items-center mt-6">
                  <CategoryIcon category={id} />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Recommendations
                  </h3>
                </div>
                <p className="text-gray-700 pl-10">
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