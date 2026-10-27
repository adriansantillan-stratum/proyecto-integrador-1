import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import type { TooltipItem } from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface DeliveryPerformanceProps {
  onTime: number;
  delayed: number;
}

export const DeliveryPerformanceChart: React.FC<DeliveryPerformanceProps> = ({ onTime, delayed }) => {
  const data = {
    labels: ['A Tiempo', 'Retrasado'],
    datasets: [
      {
        label: '# de Envíos',
        data: [onTime, delayed],
        backgroundColor: [
          'rgba(34, 197, 94, 0.6)',
          'rgba(239, 68, 68, 0.6)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return <Pie data={data} />;
};

interface DriverPerformanceProps {
  data: Array<{ name: string; count: number }>;
}

export const DriverPerformanceChart: React.FC<DriverPerformanceProps> = ({ data }) => {
  const colors = [
    'rgba(59, 130, 246, 0.6)', // Blue
    'rgba(16, 185, 129, 0.6)', // Green
    'rgba(245, 158, 11, 0.6)', // Amber
    'rgba(139, 92, 246, 0.6)', // Purple
    'rgba(236, 72, 153, 0.6)', // Pink
  ];

  const chartData = {
    labels: data.map(d => d.name),
    datasets: [
      {
        label: 'Entregas Realizadas',
        data: data.map(d => d.count),
        backgroundColor: data.map((_, i) => colors[i % colors.length]),
        borderColor: data.map((_, i) => colors[i % colors.length].replace('0.6', '1')),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend since names are on X axis
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'bar'>) => ` Entregas: ${context.parsed.y}`,
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: { weight: 'bold' as const }
        },
        title: {
          display: true,
          text: 'Cantidad de Pedidos'
        }
      },
      x: {
        ticks: {
          font: { weight: 'bold' as const }
        }
      }
    }
  };

  return <Bar data={chartData} options={options} />;
};

export const DistrictPerformanceChart: React.FC<{ data: Array<{ name: string; count: number }> }> = ({ data }) => {
  const chartData = {
    labels: data.map(d => d.name || 'Sin Distrito'),
    datasets: [
      {
        label: 'Pedidos',
        data: data.map(d => d.count),
        backgroundColor: 'rgba(139, 92, 246, 0.6)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { stepSize: 1 }
      }
    }
  };

  return <Bar data={chartData} options={options} />;
};
