import type { FeedbackCategoryType } from './types.ts';

interface CategoryIconProps {
  category: FeedbackCategoryType;
}

export const CategoryIcon = ({ category }: CategoryIconProps) => {
  const iconMap: Record<FeedbackCategoryType, string> = {
    gaze_processing: '👀',
    facial_expression: '😊',
    gestures: '👋',
    posture_body: '🧍',
    movement: '🔄'
  };

  return <span className="text-2xl mr-2">{iconMap[category]}</span>;
};