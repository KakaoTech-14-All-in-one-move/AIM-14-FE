import { Eye, Smile, Hand, User, Move } from 'lucide-react';
import type { FeedbackCategoryType } from './types.ts';

interface CategoryIconProps {
  category: FeedbackCategoryType;
  className?: string;
}

export const CategoryIcon = ({ category, className = '' }: CategoryIconProps) => {
  const iconProps = {
    size: 24,
    className: `${className} transition-colors duration-200`
  };

  const iconMap: Record<FeedbackCategoryType, React.ReactNode> = {
    gaze_processing: <Eye {...iconProps} />,
    facial_expression: <Smile {...iconProps} />,
    gestures: <Hand {...iconProps} />,
    posture_body: <User {...iconProps} />,
    movement: <Move {...iconProps} />
  };

  return <>{iconMap[category]}</>;
};