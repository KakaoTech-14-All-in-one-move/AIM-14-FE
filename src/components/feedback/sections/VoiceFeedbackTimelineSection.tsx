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
    <>
      {/* Pronunciation Timeline */}
      <div className="bg-discord800 p-4 rounded-lg">
        <h3 className="text-white font-semibold mb-4">Pronunciation Timeline</h3>
        <div className="space-y-2">
          {pronunciationScores.map((score, index) => (
            <div key={index} className="flex items-center space-x-4">
              <span className="text-discord200 w-24">{score.time_segment}</span>
              <div className="flex-1 bg-discord600 rounded-full h-4">
                <div
                  className="bg-discord100 rounded-full h-full transition-all duration-300"
                  style={{ width: `${score.accuracy * 100}%` }}
                />
              </div>
              <span className="text-discord100 w-16">{(score.accuracy * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* WPM Timeline */}
      <div className="bg-discord800 p-4 rounded-lg">
        <h3 className="text-white font-semibold mb-4">Speaking Speed Timeline</h3>
        <div className="space-y-2">
          {wpmScores.map((score, index) => (
            <div key={index} className="flex items-center space-x-4">
              <span className="text-discord200 w-24">{score.time_segment}</span>
              <div className="flex-1 bg-discord600 rounded-full h-4">
                <div
                  className="bg-discord100 rounded-full h-full transition-all duration-300"
                  style={{ width: `${(score.wpm / 200) * 100}%` }}
                />
              </div>
              <span className="text-discord100 w-16">{score.wpm.toFixed(1)} WPM</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};