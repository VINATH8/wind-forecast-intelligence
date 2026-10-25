import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const number = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })
const integer = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

const PAGES = [
  { id: 'overview', label: 'Overview' },
  { id: 'forecasts', label: 'Forecasts' },
  { id: 'accuracy', label: 'Accuracy' },
]

function formatDate(value, options = {}) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    ...options,
  }).format(date)
}

function MetricCard({ label, value, unit = '', note = '' }) {
  return (
    <article className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">
        {value}
        {unit && <span className="metric-unit"> {unit}</span>}
      </p>
      {note && <p className="metric-note">{note}</p>}
    </article>
  )
}

function ChartPanel({ title, subtitle, children }) {
  return (
    <section className="chart-panel">
      <div className="chart-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function Legend({ items }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span className="legend-item" key={item.label}>
          <i className="legend-line" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function makeDailyData(intervals) {
  const groups = new Map()

  intervals.forEach((item) => {
    const actual = Number(item.actual)
    const forecast = Number(item.forecast)
    const timestamp = item.startTime

    if (
      !timestamp ||
      !Number.isFinite(actual) ||
      !Number.isFinite(forecast)
    ) return

    const date = timestamp.slice(0, 10)
    if (!groups.has(date)) {
      groups.set(date, {
        date,
        count: 0,
        actual: 0,
        forecast: 0,
        absoluteError: 0,
        squaredError: 0,
        signedError: 0,
        overforecast: 0,
        underforecast: 0,
        exact: 0,
      })
    }

    const day = groups.get(date)
    const error = forecast - actual
    day.count += 1
    day.actual += actual
    day.forecast += forecast
    day.absoluteError += Math.abs(error)
    day.squaredError += error * error
    day.signedError += error

    if (error > 0) day.overforecast += 1
    else if (error < 0) day.underforecast += 1
    else day.exact += 1
  })

  return [...groups.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      ...day,
      actual: day.actual / day.count,
      forecast: day.forecast / day.count,
      mae: day.absoluteError / day.count,
      rmse: Math.sqrt(day.squaredError / day.count),
      bias: day.signedError / day.count,
    }))
}

function LineChart({ data, series, signed = false, labels = 7 }) {
  const chart = useMemo(() => {
    if (!data.length || !series.length) return null

    const width = 1000
    const height = 320
    const left = 70
    const right = 20
    const top = 20
    const bottom = 43
    const plotWidth = width - left - right
    const plotHeight = height - top - bottom

    const values = data.flatMap((item) =>
      series.map((line) => Number(item[line.key])).filter(Number.isFinite),
    )
    if (!values.length) return null

    let min = 0
    let max = Math.max(...values, 1)

    if (signed) {
      const extent = Math.max(...values.map(Math.abs), 1)
      min = -extent
      max = extent
    } else {
      max = Math.max(1000, Math.ceil(max / 5000) * 5000)
    }

    const x = (index) =>
      left + (index / Math.max(data.length - 1, 1)) * plotWidth
    const y = (value) =>
      top + ((max - value) / (max - min || 1)) * plotHeight

    const paths = series.map((line) => ({
      ...line,
      path: data.map((item, index) => {
        const value = Number(item[line.key])
        return `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`
      }).join(' '),
    }))

    const ticks = Array.from({ length: 5 }, (_, index) => {
      const value = min + ((max - min) * index) / 4
      return { value, y: y(value) }
    })

    const count = Math.min(labels, data.length)
    const xLabels = Array.from({ length: count }, (_, index) => {
      const dataIndex = Math.round(
        (index / Math.max(count - 1, 1)) * (data.length - 1),
      )
      const item = data[dataIndex]
      return {
        key: item.date || dataIndex,
        x: x(dataIndex),
        text: formatDate(item.date || item.startTime),
        anchor: index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle',
      }
    })

    return { width, height, left, right, top, bottom, x, y, paths, ticks, xLabels, min, max }
  }, [data, series, signed, labels])

  if (!chart) return <div className="chart-empty">No matching data available.</div>

  const axisFormat = (value) =>
    Math.abs(value) >= 1000 ? `${number.format(value / 1000)}k` : integer.format(value)

  return (
    <div className="chart-wrap">
      <svg
        className="data-chart"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label="Forecast analytics line chart"
      >
        {chart.ticks.map((tick) => (
          <g key={tick.value}>
            <line
              className="chart-grid"
              x1={chart.left}
              x2={chart.width - chart.right}
              y1={tick.y}
              y2={tick.y}
            />
            <text
              className="chart-axis"
              x={chart.left - 12}
              y={tick.y + 4}
              textAnchor="end"
            >
              {axisFormat(tick.value)}
            </text>
          </g>
        ))}

        {signed && chart.min < 0 && chart.max > 0 && (
          <line
            className="chart-zero"
            x1={chart.left}
            x2={chart.width - chart.right}
            y1={chart.y(0)}
            y2={chart.y(0)}
          />
        )}

        {chart.paths.map((line) => (
          <path
            key={line.key}
            d={line.path}
            fill="none"
            stroke={line.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {chart.xLabels.map((label) => (
          <text
            key={label.key}
            className="chart-axis"
            x={label.x}
            y={chart.height - 15}
            textAnchor={label.anchor}
          >
            {label.text}
          </text>
        ))}
      </svg>
    </div>
  )
}

function PieChart({ title, description, parts }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  let offset = 0

  const slices = parts.map((part) => {
    const start = offset
    const fraction = total ? part.value / total : 0
    offset += fraction

    return { ...part, start, fraction }
  })

  function arcPath(start, fraction) {
    const radius = 78
    const cx = 100
    const cy = 100
    const startAngle = start * 2 * Math.PI - Math.PI / 2
    const endAngle = (start + fraction) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + radius * Math.cos(startAngle)
    const y1 = cy + radius * Math.sin(startAngle)
    const x2 = cx + radius * Math.cos(endAngle)
    const y2 = cy + radius * Math.sin(endAngle)
    const largeArc = fraction > 0.5 ? 1 : 0

    if (fraction >= 0.9999) return ''

    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
  }

  return (
    <section className="chart-panel pie-panel">
      <div className="chart-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="pie-content">
        <svg className="pie-chart" viewBox="0 0 200 200" role="img" aria-label={title}>
          {total > 0 ? slices.map((slice) => (
            <path
              key={slice.label}
              d={arcPath(slice.start, slice.fraction)}
              fill={slice.color}
            >
              <title>
                {slice.label}: {integer.format(slice.value)} intervals
              </title>
            </path>
          )) : (
            <circle cx="100" cy="100" r="78" fill="#d9dfe2" />
          )}
          <circle cx="100" cy="100" r="45" fill="#fff" />
          <text x="100" y="96" className="pie-total">
            {integer.format(total)}
          </text>
          <text x="100" y="114" className="pie-total-label">intervals</text>
        </svg>

        <div className="pie-legend">
          {parts.map((part) => (
            <div className="pie-legend-row" key={part.label}>
              <span className="pie-swatch" style={{ background: part.color }} />
              <span className="pie-legend-label">{part.label}</span>
              <strong>{total ? number.format((part.value / total) * 100) : '0'}%</strong>
              <small>{integer.format(part.value)}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DataTable({ daily }) {
  return (
    <section className="chart-panel">
      <div className="chart-heading">
        <div>
          <h2>Daily forecast breakdown</h2>
          <p>Daily averages and error measures · MW</p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Actual avg.</th>
              <th>Forecast avg.</th>
              <th>Daily MAE</th>
              <th>Bias</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((day) => (
              <tr key={day.date}>
                <td>{formatDate(day.date)}</td>
                <td>{integer.format(day.actual)}</td>
                <td>{integer.format(day.forecast)}</td>
                <td>{integer.format(day.mae)}</td>
                <td className={day.bias > 0 ? 'bias-positive' : day.bias < 0 ? 'bias-negative' : ''}>
                  {day.bias > 0 ? '+' : ''}{integer.format(day.bias)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!daily.length && <p className="chart-empty">No daily records available.</p>}
      </div>
    </section>
  )
}

function PageHeading({ eyebrow, title, description }) {
  return (
    <div className="page-heading">
      <p className="page-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

function Overview({ analysis, intervals, daily, loading, onRefresh }) {
  const metrics = analysis?.metrics
  const quality = analysis?.data_quality

  return (
    <>
      <section className="hero">
        <div className="hero-image" aria-hidden="true" />
        <div className="hero-overlay" aria-hidden="true" />
        <div className="hero-content">
          <p className="hero-eyebrow">WIND GENERATION INTELLIGENCE / GREAT BRITAIN</p>
          <h1>Make better decisions<br />with the wind.</h1>
          <p className="hero-description">
            Compare forecast generation with actual output. Understand forecast
            error, identify patterns, and see what the data tells you.
          </p>
        </div>
      </section>

      <div className="dashboard-content">
        <div className="metrics-grid">
          <MetricCard label="Mean absolute error" value={metrics ? number.format(metrics.mae) : '—'} unit={metrics ? 'MW' : ''} />
          <MetricCard label="Root mean squared error" value={metrics ? number.format(metrics.rmse) : '—'} unit={metrics ? 'MW' : ''} />
          <MetricCard label="Forecast bias" value={metrics ? `${metrics.bias > 0 ? '+' : ''}${number.format(metrics.bias)}` : '—'} unit={metrics ? 'MW' : ''} />
          <MetricCard label="Interval coverage" value={quality ? `${number.format(quality.coverage_percent)}%` : '—'} note="Matched intervals, not accuracy" />
        </div>

        <ChartPanel title="Forecast vs actual generation" subtitle="Hourly wind generation · January 2026 · MW">
          <Legend items={[
            { label: 'Actual', color: '#172a2e' },
            { label: 'Forecast', color: '#c88724' },
          ]} />
          <LineChart
            data={intervals}
            series={[
              { key: 'actual', label: 'Actual', color: '#172a2e' },
              { key: 'forecast', label: 'Forecast', color: '#c88724' },
            ]}
            labels={9}
          />
          <div className="chart-footer">
            <span>Source: Elexon BMRS API</span>
            <span>{integer.format(quality?.matched_intervals ?? 0)} matched hourly intervals</span>
            <button className="square-button" onClick={onRefresh} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh data ↻'}
            </button>
          </div>
        </ChartPanel>


        {daily.length > 0 && (
          <p className="overview-caption">
            Detailed forecast and accuracy analytics are available in the top navigation.
          </p>
        )}
      </div>
    </>
  )
}

function Forecasts({ intervals, daily }) {
  const overall = useMemo(() => {
    if (!intervals.length) return null
    return intervals.reduce((sum, item) => ({
      actual: sum.actual + Number(item.actual) / intervals.length,
      forecast: sum.forecast + Number(item.forecast) / intervals.length,
    }), { actual: 0, forecast: 0 })
  }, [intervals])

  const meanDifference = overall ? overall.forecast - overall.actual : null
  const totalCount = daily.reduce((sum, day) => sum + day.count, 0)
  const over = daily.reduce((sum, day) => sum + day.overforecast, 0)
  const under = daily.reduce((sum, day) => sum + day.underforecast, 0)
  const exact = daily.reduce((sum, day) => sum + day.exact, 0)

  return (
    <div className="dashboard-content inner-page">
      <PageHeading
        eyebrow="01 / GENERATION OUTLOOK"
        title="Forecasts"
        description="Compare expected generation with delivered output and examine how forecast deviations change through January."
      />

      <div className="metrics-grid metrics-grid-three">
        <MetricCard label="Average actual output" value={overall ? integer.format(overall.actual) : '—'} unit={overall ? 'MW' : ''} />
        <MetricCard label="Average forecast output" value={overall ? integer.format(overall.forecast) : '—'} unit={overall ? 'MW' : ''} />
        <MetricCard label="Forecast minus actual" value={meanDifference == null ? '—' : `${meanDifference > 0 ? '+' : ''}${integer.format(meanDifference)}`} unit={overall ? 'MW' : ''} note="Positive means forecast was higher" />
      </div>

      <ChartPanel title="Daily average generation" subtitle="Actual and forecast generation · MW">
        <Legend items={[
          { label: 'Actual', color: '#172a2e' },
          { label: 'Forecast', color: '#c88724' },
        ]} />
        <LineChart
          data={daily}
          series={[
            { key: 'actual', label: 'Actual', color: '#172a2e' },
            { key: 'forecast', label: 'Forecast', color: '#c88724' },
          ]}
        />
      </ChartPanel>

      <div className="analytics-grid">
        <ChartPanel title="Daily forecast error" subtitle="Mean absolute error · MW">
          <LineChart data={daily} series={[{ key: 'mae', label: 'Daily MAE', color: '#c88724' }]} />
        </ChartPanel>
        <PieChart
          title="Forecast direction"
          description="Matched intervals classified by forecast vs actual"
          parts={[
            { label: 'Forecast above actual', value: over, color: '#c88724' },
            { label: 'Forecast below actual', value: under, color: '#172a2e' },
            { label: 'Exact match', value: exact, color: '#aab7bd' },
          ]}
        />
      </div>

      <div className="summary-strip">
        <div><span>Matched intervals</span><strong>{integer.format(totalCount)}</strong></div>
        <div><span>Days evaluated</span><strong>{daily.length}</strong></div>
        <div><span>Average daily MAE</span><strong>{daily.length ? `${integer.format(daily.reduce((s, d) => s + d.mae, 0) / daily.length)} MW` : '—'}</strong></div>
      </div>

      <DataTable daily={daily} />
    </div>
  )
}

function Accuracy({ analysis, intervals, daily }) {
  const metrics = analysis?.metrics
  const quality = analysis?.data_quality
  const errors = intervals.map((item) => Number(item.forecast) - Number(item.actual))
    .filter(Number.isFinite)
  const positive = errors.filter((value) => value > 0).length
  const negative = errors.filter((value) => value < 0).length
  const zero = errors.length - positive - negative
  const worstDay = daily.length ? daily.reduce((a, b) => a.mae > b.mae ? a : b) : null

  return (
    <div className="dashboard-content inner-page">
      <PageHeading
        eyebrow="02 / PERFORMANCE EVALUATION"
        title="Forecast accuracy"
        description="Understand error magnitude, forecast bias, and the consistency of available observations."
      />

      <div className="metrics-grid">
        <MetricCard label="Mean absolute error" value={metrics ? integer.format(metrics.mae) : '—'} unit={metrics ? 'MW' : ''} note="Average absolute deviation" />
        <MetricCard label="Root mean squared error" value={metrics ? integer.format(metrics.rmse) : '—'} unit={metrics ? 'MW' : ''} note="Penalises larger errors" />
        <MetricCard label="Forecast bias" value={metrics ? `${metrics.bias > 0 ? '+' : ''}${integer.format(metrics.bias)}` : '—'} unit={metrics ? 'MW' : ''} note="Positive means overforecasting" />
        <MetricCard label="Interval coverage" value={quality ? `${number.format(quality.coverage_percent)}%` : '—'} note="Data completeness, not accuracy" />
      </div>

      <div className="analytics-grid">
        <ChartPanel title="Daily absolute error" subtitle="Mean absolute error · MW">
          <LineChart data={daily} series={[{ key: 'mae', label: 'Daily MAE', color: '#c88724' }]} />
        </ChartPanel>
        <PieChart
          title="Error direction"
          description="Share of matched intervals by signed error"
          parts={[
            { label: 'Overforecast', value: positive, color: '#c88724' },
            { label: 'Underforecast', value: negative, color: '#172a2e' },
            { label: 'Exact match', value: zero, color: '#aab7bd' },
          ]}
        />
      </div>

      <ChartPanel title="Daily forecast bias" subtitle="Forecast minus actual · MW; positive values indicate overforecasting">
        <Legend items={[{ label: 'Daily bias', color: '#172a2e' }]} />
        <LineChart data={daily} series={[{ key: 'bias', label: 'Bias', color: '#172a2e' }]} signed />
      </ChartPanel>

      <ChartPanel title="Daily root mean squared error" subtitle="Sensitivity to larger misses · MW">
        <LineChart data={daily} series={[{ key: 'rmse', label: 'Daily RMSE', color: '#c88724' }]} />
      </ChartPanel>

      <div className="summary-strip">
        <div><span>Matched intervals</span><strong>{integer.format(quality?.matched_intervals ?? intervals.length)}</strong></div>
        <div><span>Highest daily MAE</span><strong>{worstDay ? `${integer.format(worstDay.mae)} MW` : '—'}</strong></div>
        <div><span>Highest-error day</span><strong>{worstDay ? formatDate(worstDay.date) : '—'}</strong></div>
      </div>

      
    </div>
  )
}

function App() {
  const [page, setPage] = useState('overview')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAnalysis = useCallback(async (signal) => {
    const response = await fetch('/api/analysis/january-2026', { signal })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.detail || `Request failed (${response.status})`)
    }
    return response.json()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        setAnalysis(await loadAnalysis(controller.signal))
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Unable to load analysis.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [loadAnalysis])

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      setAnalysis(await loadAnalysis())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh analysis.')
    } finally {
      setLoading(false)
    }
  }

  const intervals = analysis?.intervals ?? []
  const daily = useMemo(() => makeDailyData(intervals), [intervals])

  function navigate(id) {
    setPage(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => navigate('overview')} aria-label="Spark overview">
          <span className="wordmark-bolt" aria-hidden="true">⚡</span>
          <span>Spark</span>
        </button>

        <nav className="top-navigation" aria-label="Main navigation">
          {PAGES.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${page === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="period-control">January 2026 <span>UTC</span></div>
      </header>

      {error && (
        <div className="global-error" role="alert">
          <span>{error}</span>
          <button className="square-button" onClick={refresh} disabled={loading}>Retry</button>
        </div>
      )}

      {page === 'overview' && (
        <Overview
          analysis={analysis}
          intervals={intervals}
          daily={daily}
          loading={loading}
          onRefresh={refresh}
        />
      )}
      {page === 'forecasts' && <Forecasts intervals={intervals} daily={daily} />}
      {page === 'accuracy' && <Accuracy analysis={analysis} intervals={intervals} daily={daily} />}

      <footer className="site-footer">
        
      </footer>
    </main>
  )
}

export default App
