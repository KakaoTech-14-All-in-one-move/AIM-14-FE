import { Activity, Clock, FileText, Gauge } from 'lucide-react';
import GaugeChart from 'react-gauge-chart';

interface VoiceFeedbackScoreSectionProps {
  audioSimilarity: number;
  averageWpm: number;
  ttsWpm: number;
  pronunciationAccuracy: number;
  scriptSimilarity: number;
}

export const getColorByGaugePosition = (value: number): string => {
  // Arc lengths from the original gauge configuration
  const redZone = 0.3;    // 0-30%
  const yellowZone = 0.5; // 30-80%
  const greenZone = 0.2;  // 80-100%

  if (value <= redZone) {
    return 'text-red-400';
  } else if (value <= redZone + yellowZone) {
    return 'text-yellow-400';
  } else {
    return 'text-green-400';
  }
};

// WPM 값에 따른 색상 계산 함수 추가
export const getColorByWpm = (wpm: number): string => {
  // 120 WPM을 기준으로 비율 계산
  const ratio = wpm / 120;
  return getColorByGaugePosition(ratio);
};

const commonGaugeProps = {
  nrOfLevels: 20,
  arcsLength: [0.3, 0.5, 0.2],
  colors: ['#EF4444', '#EAB308', '#22C55E'],
  percent: 0,
  arcPadding: 0.02,
  cornerRadius: 0,
  textColor: 'transparent',
};

export const VoiceFeedbackScoreSection = ({
                                            audioSimilarity,
                                            averageWpm,
                                            ttsWpm,
                                            pronunciationAccuracy,
                                            scriptSimilarity,
                                          }: VoiceFeedbackScoreSectionProps) => {
  const audioColor = getColorByGaugePosition(audioSimilarity);
  const wpmColor = getColorByWpm(averageWpm);
  const pronunciationColor = getColorByGaugePosition(pronunciationAccuracy);
  const scriptColor = getColorByGaugePosition(scriptSimilarity);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Audio Similarity */}
      <div className="bg-discord700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Activity className={audioColor} />
            <h3 className={`font-medium ${audioColor}`}>음성 유사도</h3>
          </div>
          <span className={`text-4xl font-bold ${audioColor}`}>
            {(audioSimilarity * 100).toFixed(1)}%
          </span>
        </div>
        <p className="text-sm text-discord700 mt-2 mb-4">빈공간</p>
        <div className="h-32">
          <GaugeChart
            {...commonGaugeProps}
            percent={audioSimilarity}
          />
        </div>
        <p className="text-xs text-discord700 mt-2 text-right">
          빈공간
        </p>
      </div>

      {/* Average WPM */}
      <div className="bg-discord700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Clock className={wpmColor} />
            <h3 className={`font-medium ${wpmColor}`}>평균 속도</h3>
          </div>
          <div>
            <span className={`text-4xl font-bold ${wpmColor}`}>
              {averageWpm.toFixed(1)}
            </span>
            <span className={`text-xl font-bold ${wpmColor}`}>
              WPM
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-300 mt-2 mb-4 text-right">권장 속도: 120 WPM</p>
        <div className="h-32">
          <GaugeChart
            {...commonGaugeProps}
            percent={averageWpm / 120}
          />
        </div>
        <p className="text-xs text-white text-left">
          * WPM
        </p>
        <p className="text-xs text-white text-left">
          Words Per Minute (분당 단어 수)
        </p>
      </div>

      {/* Pronunciation */}
      <div className="bg-discord700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Gauge className={pronunciationColor} />
            <h3 className={`font-medium ${pronunciationColor}`}>발음 정확도</h3>
          </div>
          <span className={`text-4xl font-bold ${pronunciationColor}`}>
            {(pronunciationAccuracy * 100).toFixed(1)}%
          </span>
        </div>
        <p className="text-sm text-discord700 mt-2 mb-4">빈공간</p>
        <div className="h-32">
          <GaugeChart
            {...commonGaugeProps}
            percent={pronunciationAccuracy}
          />
        </div>
        <p className="text-xs text-discord700 mt-2 text-right">
          빈공간
        </p>
      </div>

      {/* Script Similarity */}
      <div className="bg-discord700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileText className={scriptColor} />
            <h3 className={`font-medium ${scriptColor}`}>스크립트 유사도</h3>
          </div>
          <span className={`text-4xl font-bold ${scriptColor}`}>
            {(scriptSimilarity * 100).toFixed(1)}%
          </span>
        </div>
        <p className="text-sm text-discord700 mt-2 mb-4">빈공간</p>
        <div className="h-32">
          <GaugeChart
            {...commonGaugeProps}
            percent={scriptSimilarity}
          />
        </div>
        <p className="text-xs text-discord700 mt-2 text-right">
          빈공간
        </p>
      </div>
    </div>
  );
};