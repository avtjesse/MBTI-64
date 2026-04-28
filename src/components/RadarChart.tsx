import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface RadarChartProps {
  scores: number[];
}

export default function RadarChart({ scores }: RadarChartProps) {
  const data = {
    labels: [
      '能量 (E/I)',
      '資訊 (S/N)',
      '決策 (T/F)',
      '執行 (J/P)',
      '壓力 (A/O)',
      '社交 (H/C)',
    ],
    datasets: [
      {
        label: '人格傾向得分 %',
        data: scores,
        fill: true,
        backgroundColor: 'rgba(180, 83, 9, 0.2)',
        borderColor: 'rgb(180, 83, 9)',
        pointBackgroundColor: 'rgb(180, 83, 9)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(180, 83, 9)',
      },
    ],
  };

  const options = {
    scales: {
      r: {
        angleLines: {
          display: true,
          color: 'rgba(180, 83, 9, 0.1)',
        },
        suggestedMin: 0,
        suggestedMax: 100,
        ticks: {
          stepSize: 20,
          backdropColor: 'transparent',
          color: 'rgba(180, 83, 9, 0.5)',
        },
        grid: {
          color: 'rgba(180, 83, 9, 0.1)',
        },
        pointLabels: {
          color: 'rgb(120, 53, 15)',
          font: {
            size: 14,
            family: "'Inter', sans-serif",
            weight: 'bold' as const,
          },
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(180, 83, 9, 0.9)',
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 14,
        },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: function(context: any) {
            const value = context.raw as number;
            const label = context.label as string;
            
            let left = '';
            let right = '';
            
            if (label.includes('E/I')) { right = 'E 外向'; left = 'I 內向'; }
            else if (label.includes('S/N')) { right = 'S 實感'; left = 'N 直覺'; }
            else if (label.includes('T/F')) { right = 'T 思考'; left = 'F 情感'; }
            else if (label.includes('J/P')) { right = 'J 判斷'; left = 'P 感知'; }
            else if (label.includes('A/O')) { right = 'A 堅定'; left = 'O 彈性'; }
            else if (label.includes('H/C')) { right = 'H 熱情'; left = 'C 冷靜'; }
            
            const isFirst = value >= 50;
            const dominant = isFirst ? right : left;
            const percentage = isFirst ? value : 100 - value;
            
            return [
              `主要傾向: ${dominant} (${percentage}%)`,
              `維度說明: ${right} vs ${left}`
            ];
          }
        }
      },
    },
  };

  return (
    <div className="w-full max-w-md mx-auto aspect-square">
      <Radar data={data} options={options} />
    </div>
  );
}
