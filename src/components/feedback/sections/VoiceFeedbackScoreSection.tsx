interface ScoreCardProps {
  title: string;
  value: string;
  subvalue?: string;
}

const ScoreCard = ({ title, value, subvalue }: ScoreCardProps) => (
  <div className="bg-discord800 p-4 rounded-lg">
    <h3 className="text-discord200 text-sm font-medium mb-2">{title}</h3>
    <p className="text-white text-2xl font-bold">{value}</p>
    {subvalue && <p className="text-discord300 text-sm mt-1">{subvalue}</p>}
  </div>
);

interface VoiceFeedbackScoreSectionProps {
  audioSimilarity: number;
  averageWpm: number;
  ttsWpm: number;
  pronunciationAccuracy: number;
}

export const VoiceFeedbackScoreSection = ({
                                            audioSimilarity,
                                            averageWpm,
                                            ttsWpm,
                                            pronunciationAccuracy,
                                          }: VoiceFeedbackScoreSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <ScoreCard
        title="Audio Similarity"
        value={`${(audioSimilarity * 100).toFixed(1)}%`}
      />
      <ScoreCard
        title="Average WPM"
        value={`${averageWpm.toFixed(1)}`}
        subvalue={`Target: ${ttsWpm}`}
      />
      <ScoreCard
        title="Pronunciation Accuracy"
        value={`${(pronunciationAccuracy * 100).toFixed(1)}%`}
      />
    </div>
  );
};