import { Tab } from '@headlessui/react';
import { Timer } from 'lucide-react';
import { getColorByGaugePosition } from './VoiceFeedbackScoreSection';

interface TimelineScore {
  time_segment: string;
  accuracy: number;
}

interface WpmScore {
  time_segment: string;
  wpm: number;
}

interface VoiceFeedbackTimelineSectionProps {
  pronunciationScores: TimelineScore[];
  wpmScores: WpmScore[];
}

export const VoiceFeedbackTimelineSection = ({
                                               pronunciationScores,
                                               wpmScores,
                                             }: VoiceFeedbackTimelineSectionProps) => {
  return (
    <div className="bg-discord700 rounded-lg">
      <Tab.Group>
        <Tab.List className="flex space-x-1 bg-discord800 p-1 rounded-t-lg">
          <Tab className={({ selected }) => `
            flex-1 py-4 px-6 text-base font-medium rounded-md
            focus:outline-none transition-all duration-200
            ${selected
            ? 'text-yellow-400 bg-discord700'
            : 'text-white hover:bg-discord600'
          }
          `}>
            발음 타임라인
          </Tab>
          <Tab className={({ selected }) => `
            flex-1 py-4 px-6 text-base font-medium rounded-md
            focus:outline-none transition-all duration-200
            ${selected
            ? 'text-yellow-400 bg-discord700'
            : 'text-white hover:bg-discord600'
          }
          `}>
            말하기 속도
          </Tab>
        </Tab.List>

        <Tab.Panels className="p-8">
          <Tab.Panel className="space-y-6">
            {pronunciationScores.map((score, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 w-48">
                  <Timer className="w-5 h-5 text-white" />
                  <span className="text-white">{score.time_segment}</span>
                </div>
                <div className="flex-1 bg-discord600 rounded-full h-2">
                  <div
                    className="bg-white rounded-full h-full transition-all duration-300"
                    style={{ width: `${score.accuracy * 100}%` }}
                  />
                </div>
                <span className={`${getColorByGaugePosition(score.accuracy)} w-32 text-right font-medium`}>
                  정확도: {(score.accuracy * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </Tab.Panel>

          <Tab.Panel className="space-y-6">
            {wpmScores.map((score, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 w-48">
                  <Timer className="w-5 h-5 text-white" />
                  <span className="text-white">{score.time_segment}</span>
                </div>
                <div className="flex-1 bg-discord600 rounded-full h-2">
                  <div
                    className="bg-white rounded-full h-full transition-all duration-300"
                    style={{ width: `${(score.wpm / 120) * 100}%` }}
                  />
                </div>
                <span className={`${getColorByGaugePosition(score.wpm / 120)} w-32 text-right font-medium`}>
                  {score.wpm.toFixed(1)} WPM
                </span>
              </div>
            ))}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};