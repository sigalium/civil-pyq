import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import VisibilityIcon from '@mui/icons-material/Visibility'
import DownloadIcon from '@mui/icons-material/Download'
import StorageIcon from '@mui/icons-material/Storage'
import DescriptionIcon from '@mui/icons-material/Description'
import { supabase } from '../../lib/supabaseClient'
import { formatBytes } from '../../utils/pdfCompression'
import { getDemoAnalyticsData } from '../../utils/analyticsDemoData'
import { useResourcesData } from '../../context/useResourcesData'
import Select from '../../components/Select'
import './Dashboard.css'

const TYPE_LABELS = { pyq: 'PYQ', lab: 'Lab', syllabus: 'Syllabus', iscode: 'Codes & Standards' }
const PIE_COLORS = ['#64ffda', '#7c9eff', '#ffb86c', '#ff6b9d']

function formatTrendDay(day) {
  const [year, month, date] = day.split('-')
  return `${date}-${month}-${year}`
}

const RANGE_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '1 year' },
  { value: 730, label: '2 years' },
]

const LEADERBOARD_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'pyq', label: 'PYQ' },
  { value: 'lab', label: 'Lab' },
  { value: 'iscode', label: 'Codes & Standards' },
]

const LEADERBOARD_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'Last year' },
]

function truncateName(name, max = 22) {
  if (!name) return ''
  return name.length > max ? `${name.slice(0, max - 1)}…` : name
}

function buildLeaderboardLabel(row, max = 30) {
  const full = row.subject ? `${row.subject} · ${row.name}` : row.name
  return truncateName(full, max)
}

const StatCard = ({ icon, label, value }) => (
  <div className="analytics-stat-card">
    <div className="analytics-stat-icon">{icon}</div>
    <div>
      <div className="analytics-stat-value">{value}</div>
      <div className="analytics-stat-label">{label}</div>
    </div>
  </div>
)

const ChartCard = ({ title, children, empty, action }) => (
  <div className="analytics-chart-card">
    <div className="analytics-chart-card-header">
      <h4>{title}</h4>
      {action}
    </div>
    {empty ? <p className="dashboard-empty">Not enough data yet.</p> : children}
  </div>
)

const AnalyticsTab = () => {
  const { analyticsDemoMode } = useResourcesData()
  const [summary, setSummary] = useState(null)
  const [topViewed, setTopViewed] = useState([])
  const [topDownloaded, setTopDownloaded] = useState([])
  const [trend, setTrend] = useState([])
  const [storageBreakdown, setStorageBreakdown] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rangeDays, setRangeDays] = useState(30)
  const [leaderboardType, setLeaderboardType] = useState('all')
  const [leaderboardDays, setLeaderboardDays] = useState('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    if (analyticsDemoMode) {
      const demo = getDemoAnalyticsData(rangeDays)
      const typeMatch = (r) => leaderboardType === 'all' || r.resource_type === leaderboardType
      setSummary(demo.summary)
      setTopViewed(demo.topViewed.filter(typeMatch).map((r) => ({ ...r, label: buildLeaderboardLabel(r) })))
      setTopDownloaded(demo.topDownloaded.filter(typeMatch).map((r) => ({ ...r, label: buildLeaderboardLabel(r) })))
      setTrend(demo.trend.map((r) => ({ ...r, day: formatTrendDay(r.day) })))
      setStorageBreakdown(demo.storageBreakdown.map((r) => ({ ...r, label: TYPE_LABELS[r.resource_type] || r.resource_type })))
      setLoading(false)
      return
    }

    Promise.all([
      supabase.rpc('analytics_summary'),
      supabase.rpc('resource_leaderboard', { sort_by: 'views', limit_count: 8, type_filter: leaderboardType === 'all' ? null : leaderboardType, days_back: leaderboardDays === 'all' ? null : leaderboardDays }),
      supabase.rpc('resource_leaderboard', { sort_by: 'downloads', limit_count: 8, type_filter: leaderboardType === 'all' ? null : leaderboardType, days_back: leaderboardDays === 'all' ? null : leaderboardDays }),
      supabase.rpc('resource_event_trend', { days_back: rangeDays }),
      supabase.rpc('resource_storage_breakdown'),
    ]).then(([summaryRes, viewsRes, downloadsRes, trendRes, breakdownRes]) => {
      if (cancelled) return
      const firstError = [summaryRes, viewsRes, downloadsRes, trendRes, breakdownRes].find((r) => r.error)?.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }
      setSummary(summaryRes.data?.[0] || null)
      setTopViewed((viewsRes.data || []).map((r) => ({ ...r, label: buildLeaderboardLabel(r) })))
      setTopDownloaded((downloadsRes.data || []).map((r) => ({ ...r, label: buildLeaderboardLabel(r) })))
      setTrend((trendRes.data || []).map((r) => ({ ...r, day: formatTrendDay(r.day) })))
      setStorageBreakdown(
        (breakdownRes.data || []).map((r) => ({ ...r, label: TYPE_LABELS[r.resource_type] || r.resource_type }))
      )
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [rangeDays, analyticsDemoMode, leaderboardType, leaderboardDays])

  if (loading) return <p className="dashboard-empty">Loading analytics…</p>
  if (error) return <p className="dashboard-error">{error}</p>

  return (
    <div className="dashboard-panel">
      <div className="analytics-header-row">
        {analyticsDemoMode && <span className="analytics-demo-badge">Demo data</span>}
      </div>
      <div className="analytics-stats-row">
        <StatCard icon={<DescriptionIcon sx={{ fontSize: 20 }} />} label="Resources" value={summary?.total_resources ?? 0} />
        <StatCard icon={<StorageIcon sx={{ fontSize: 20 }} />} label="Total storage" value={formatBytes(Number(summary?.total_storage_bytes) || 0)} />
        <StatCard icon={<VisibilityIcon sx={{ fontSize: 20 }} />} label="Total views" value={summary?.total_views ?? 0} />
        <StatCard icon={<DownloadIcon sx={{ fontSize: 20 }} />} label="Total downloads" value={summary?.total_downloads ?? 0} />
        <StatCard icon={<DescriptionIcon sx={{ fontSize: 20 }} />} label="Avg file size" value={formatBytes(Number(summary?.avg_file_size_bytes) || 0)} />
      </div>

      <ChartCard
        title="Views & downloads"
        empty={trend.every((d) => d.views === 0 && d.downloads === 0)}
        action={
          <Select
            value={rangeDays}
            onChange={(v) => setRangeDays(Number(v))}
            options={RANGE_OPTIONS}
          />
        }
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trend} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="analytics-grid" />
            <XAxis dataKey="day" className="analytics-axis" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} className="analytics-axis" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: 'var(--secondary)', border: '1px solid rgba(var(--glass-rgb), 0.15)', borderRadius: 8, color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-primary)' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="views" stroke="#64ffda" strokeWidth={2} dot={false} name="Views" />
            <Line type="monotone" dataKey="downloads" stroke="#7c9eff" strokeWidth={2} dot={false} name="Downloads" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="analytics-leaderboard-filters">
        <Select value={leaderboardType} onChange={setLeaderboardType} options={LEADERBOARD_TYPE_OPTIONS} />
        <Select value={leaderboardDays} onChange={setLeaderboardDays} options={LEADERBOARD_RANGE_OPTIONS} />
      </div>

      <div className="analytics-chart-grid">
        <ChartCard title="Most viewed files" empty={topViewed.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topViewed} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="analytics-grid" horizontal={false} />
              <XAxis type="number" allowDecimals={false} className="analytics-axis" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={170} className="analytics-axis" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--secondary)', border: '1px solid rgba(var(--glass-rgb), 0.15)', borderRadius: 8, color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-primary)' }} />
              <Bar dataKey="view_count" fill="#64ffda" radius={[0, 4, 4, 0]} name="Views" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Most downloaded files" empty={topDownloaded.length === 0}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topDownloaded} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="analytics-grid" horizontal={false} />
              <XAxis type="number" allowDecimals={false} className="analytics-axis" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={170} className="analytics-axis" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'var(--secondary)', border: '1px solid rgba(var(--glass-rgb), 0.15)', borderRadius: 8, color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} labelStyle={{ color: 'var(--text-primary)' }} />
              <Bar dataKey="download_count" fill="#7c9eff" radius={[0, 4, 4, 0]} name="Downloads" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Storage by type" empty={storageBreakdown.length === 0}>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={storageBreakdown}
              dataKey="total_bytes"
              nameKey="label"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
            >
              {storageBreakdown.map((entry, index) => (
                <Cell key={entry.resource_type} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatBytes(value), name]}
              contentStyle={{ background: 'var(--secondary)', border: '1px solid rgba(var(--glass-rgb), 0.15)', borderRadius: 8, color: 'var(--text-primary)' }}
              itemStyle={{ color: 'var(--text-primary)' }}
              labelStyle={{ color: 'var(--text-primary)' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

export default AnalyticsTab
