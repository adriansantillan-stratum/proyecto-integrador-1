import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);
interface Series { label: string; values: (number | null)[] }
const colors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777'];
export function AnalyticsChart({ title, labels, series, kind = 'bar', unit = 'pedidos', note }: { title: string; labels: string[]; series: Series[]; kind?: 'bar' | 'line' | 'doughnut' | 'horizontal'; unit?: string; note?: string }) {
  const data = { labels, datasets: series.map((s, i) => ({ label: s.label, data: s.values, borderColor: colors[i % colors.length], backgroundColor: kind === 'doughnut' ? labels.map((_, j) => colors[j % colors.length]) : colors[i % colors.length] + 'aa', spanGaps: false })) };
  const present = labels.length > 0 && series.some(s => s.values.some(v => v != null));
  if (kind === 'horizontal') {
    const maximum = Math.max(1, ...series.flatMap(s => s.values.filter((value): value is number => value != null)));
    return <section className="card analytics-chart--horizontal"><h3>{title}</h3>
      {!present ? <p>Sin datos evaluables para estos filtros.</p> : <>
        <div className="analytics-bar-legend">{series.map((s, index) => <span key={s.label}>
          <i className="analytics-bar-swatch" style={{ background: colors[index % colors.length] }} aria-hidden="true" />{s.label}
        </span>)}</div>
        <ol className="analytics-bar-list" aria-label={title}>{labels.map((label, index) => <li key={`${index}-${label}`}>
          <span className="analytics-bar-label">{label}</span>
          <div className="analytics-bar-values">{series.map((s, seriesIndex) => <div className="analytics-bar-row" key={s.label}>
            <div className="analytics-bar-track" aria-hidden="true"><div className="analytics-bar-fill" style={{
              width: `${Math.max(0, s.values[index] ?? 0) / maximum * 100}%`, background: colors[seriesIndex % colors.length],
            }} /></div>
            <span className="analytics-bar-value" aria-label={`${s.label}: ${s.values[index] ?? 'sin datos'} ${unit}`}>{s.values[index] ?? '—'}</span>
          </div>)}</div>
        </li>)}</ol>
        <p className="analytics-bar-scale">Escala: 0–{maximum} {unit}. El valor se indica junto a cada barra.</p>
      </>}{note && <p>{note}</p>}</section>;
  }
  const options = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true, title: { display: true, text: unit } } } };
  return <section className="card"><h3>{title}</h3><div style={{ height: 260 }}>
    {!present ? <p>Sin datos evaluables para estos filtros.</p> : kind === 'line' ? <Line data={data} options={options} /> : kind === 'doughnut' ? <Doughnut data={data} options={{ responsive: true, maintainAspectRatio: false }} /> : <Bar data={data} options={options} />}
  </div>{note && <p>{note}</p>}</section>;
}
