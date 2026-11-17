'use client';
import {useState} from 'react';
import styles from './kinerja.module.css';
import {fmtMinutes, fmtMonthShort, fmtNumber, fmtPercent} from './kinerjaFormat';

const METRIC_CONFIG = {
  resolved: {
    label: 'Tiket selesai',
    unit: 'tiket',
    format: v => `${fmtNumber(v, 0)}`,
    higherIsBetter: true,
  },
  points: {
    label: 'Poin kontribusi',
    unit: 'poin',
    format: v => `${fmtNumber(v, 0)}`,
    higherIsBetter: true,
  },
  medianResponseMinutes: {
    label: 'Median respons',
    unit: 'menit',
    format: v => fmtMinutes(v),
    higherIsBetter: false,
  },
  slaCleanPct: {
    label: 'Tepat SLA',
    unit: '%',
    format: v => fmtPercent(v),
    higherIsBetter: true,
  },
};

export function TrendSparkline({
  series = [],
  metricKey = 'points',
  direction = 'flat',
  memberName = '',
  width = 96,
  height = 28,
}) {
  const cfg = METRIC_CONFIG[metricKey] || METRIC_CONFIG.points;
  const clean = series.map(item => ({
    month: item.month,
    value: item?.[metricKey] != null && Number.isFinite(Number(item[metricKey])) ? Number(item[metricKey]) : null,
  }));
  const numericValues = clean.map(p => p.value).filter(v => v != null);

  if (!numericValues.length || numericValues.every(v => v === 0)) {
    return (
      <span className={styles.cellSub} aria-label={`Tren ${cfg.label} ${memberName}: belum ada data`}>
        Belum ada tren
      </span>
    );
  }

  const max = Math.max(...numericValues);
  const min = Math.min(...numericValues);
  const span = max - min || 1;
  const padX = 4;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = clean.map((pt, idx) => {
    const x = clean.length === 1 ? width / 2 : padX + (idx / (clean.length - 1)) * innerW;
    const norm = pt.value == null ? 0 : (pt.value - min) / span;
    const y = padY + innerH - norm * innerH;
    return {...pt, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10};
  });

  const activeCoords = coords.filter(c => c.value != null);
  const pathPoints = activeCoords.map(c => `${c.x},${c.y}`).join(' ');
  const last = activeCoords[activeCoords.length - 1];

  const stroke =
    direction === 'up'
      ? 'var(--ui-success, #176043)'
      : direction === 'down'
        ? 'var(--ui-danger, #b42332)'
        : 'var(--ui-accent, #087b76)';

  const summaryText = clean
    .map(c => `${fmtMonthShort(c.month)}: ${c.value == null ? '-' : cfg.format(c.value)}`)
    .join(', ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Tren ${cfg.label} ${memberName}: ${summaryText}`}
      style={{display: 'block', overflow: 'visible'}}
    >
      <title>{`${cfg.label}: ${summaryText}`}</title>
      <line
        x1={padX}
        y1={height - padY}
        x2={width - padX}
        y2={height - padY}
        stroke="var(--ui-line, #d9dfe6)"
        strokeWidth="1"
      />
      {activeCoords.length > 1 && (
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pathPoints}
        />
      )}
      {activeCoords.map(c => (
        <circle
          key={c.month}
          cx={c.x}
          cy={c.y}
          r={c.month === last?.month ? 3 : 1.75}
          fill={c.month === last?.month ? stroke : 'var(--ui-surface, #fff)'}
          stroke={stroke}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

export function TrendSeriesPanel({series = [], title = 'Tren performa per bulan'}) {
  const [metric, setMetric] = useState('resolved');
  const cfg = METRIC_CONFIG[metric] || METRIC_CONFIG.resolved;

  const points = series.map(item => ({
    month: item.month,
    label: fmtMonthShort(item.month),
    value: item?.[metric] != null && Number.isFinite(Number(item[metric])) ? Number(item[metric]) : null,
  }));
  const numericValues = points.map(p => p.value).filter(v => v != null);
  const maxVal = numericValues.length ? Math.max(...numericValues, metric === 'slaCleanPct' ? 100 : 1) : 1;

  const svgWidth = Math.max(360, points.length * 76);
  const svgHeight = 160;
  const padLeft = 36;
  const padRight = 20;
  const padTop = 18;
  const padBottom = 28;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const coords = points.map((p, idx) => {
    const x = points.length <= 1 ? padLeft + plotW / 2 : padLeft + (idx / (points.length - 1)) * plotW;
    const ratio = p.value == null ? 0 : p.value / maxVal;
    const y = padTop + plotH - ratio * plotH;
    return {...p, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10};
  });

  const activeCoords = coords.filter(c => c.value != null);
  const polyPoints = activeCoords.map(c => `${c.x},${c.y}`).join(' ');

  return (
    <section className={styles.chartPanel} aria-label={title}>
      <div className={styles.sectionHeader}>
        <h3>{title}</h3>
        <div className={styles.pillGroup} role="group" aria-label="Pilih metrik grafik tren">
          {Object.entries(METRIC_CONFIG).map(([key, info]) => (
            <button
              key={key}
              type="button"
              className={styles.pillBtn}
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {info.label}
            </button>
          ))}
        </div>
      </div>

      {!numericValues.length ? (
        <p className={styles.sectionNote}>Belum ada catatan {cfg.label.toLowerCase()} pada rentang bulan ini.</p>
      ) : (
        <div className={styles.chartWrap}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            role="img"
            aria-label={`${title} untuk ${cfg.label}: ${points
              .map(p => `${p.label} ${p.value == null ? 'kosong' : cfg.format(p.value)}`)
              .join(', ')}`}
            style={{width: '100%', maxWidth: `${svgWidth}px`, height: 'auto', display: 'block'}}
          >
            {[0, 0.5, 1].map(tick => {
              const y = Math.round((padTop + plotH - tick * plotH) * 10) / 10;
              const val = Math.round(maxVal * tick);
              return (
                <g key={tick}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    stroke="var(--ui-line, #d9dfe6)"
                    strokeWidth="1"
                    strokeDasharray={tick === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 4}
                    textAnchor="end"
                    fill="var(--ui-muted, #566474)"
                    fontSize="11"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {activeCoords.length > 1 && (
              <polyline
                fill="none"
                stroke="var(--ui-accent, #087b76)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polyPoints}
              />
            )}

            {coords.map(c => (
              <g key={c.month}>
                {c.value != null && (
                  <>
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r="4.5"
                      fill="var(--ui-surface, #fff)"
                      stroke="var(--ui-accent, #087b76)"
                      strokeWidth="2.2"
                    />
                    <text
                      x={c.x}
                      y={c.y - 9}
                      textAnchor="middle"
                      fill="var(--ui-ink, #182333)"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {metric === 'medianResponseMinutes' ? `${Math.round(c.value)}m` : fmtNumber(c.value, 0)}
                    </text>
                  </>
                )}
                <text
                  x={c.x}
                  y={svgHeight - 6}
                  textAnchor="middle"
                  fill="var(--ui-muted, #566474)"
                  fontSize="11"
                >
                  {c.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      <div className={styles.chartStrip}>
        {points.map(p => (
          <div className={styles.chartStripItem} key={p.month}>
            <span>{p.label}</span>
            <strong>{p.value == null ? 'Belum ada' : cfg.format(p.value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
