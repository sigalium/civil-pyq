const DEMO_NAMES = [
  { name: 'Structural Analysis I - ESE Dec 2024', subject: 'Structural Analysis I', semester: 5, resource_type: 'pyq' },
  { name: 'Fluid Mechanics - ESE Dec 2024', subject: 'Fluid Mechanics', semester: 4, resource_type: 'pyq' },
  { name: 'Geotechnical Engineering - Mid Sem', subject: 'Geotechnical Engineering', semester: 6, resource_type: 'pyq' },
  { name: 'Surveying Lab Manual', subject: 'Surveying', semester: 3, resource_type: 'lab' },
  { name: 'Concrete Technology - ESE Jun 2024', subject: 'Concrete Technology', semester: 5, resource_type: 'pyq' },
  { name: 'Environmental Engineering Syllabus', subject: 'Environmental Engineering', semester: 5, resource_type: 'syllabus' },
  { name: 'Transportation Engineering - ESE', subject: 'Transportation Engineering', semester: 6, resource_type: 'pyq' },
  { name: 'Hydraulics Lab Manual', subject: 'Fluid Mechanics', semester: 4, resource_type: 'lab' },
  { name: 'Design of Steel Structures - ESE', subject: 'Design of Steel Structures', semester: 7, resource_type: 'pyq' },
  { name: 'Building Materials - Mid Sem', subject: 'Building Materials', semester: 2, resource_type: 'pyq' },
]

function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

function buildLeaderboard(sortKey) {
  const rand = seededRandom(sortKey === 'views' ? 11 : 29)
  return DEMO_NAMES.map((item, index) => {
    const views = Math.round(40 + rand() * 260)
    const downloads = Math.round(views * (0.3 + rand() * 0.4))
    return {
      resource_id: `demo-${index}`,
      name: item.name,
      subject: item.subject,
      semester: item.semester,
      resource_type: item.resource_type,
      view_count: views,
      download_count: downloads,
      file_size_bytes: Math.round(300_000 + rand() * 2_200_000),
    }
  }).sort((a, b) => (sortKey === 'views' ? b.view_count - a.view_count : b.download_count - a.download_count))
}

function buildTrend(days) {
  const rand = seededRandom(7)
  const series = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const weekday = d.getDay()
    const weekendDip = weekday === 0 || weekday === 6 ? 0.5 : 1
    const views = Math.round((10 + rand() * 35) * weekendDip)
    const downloads = Math.round(views * (0.25 + rand() * 0.35))
    series.push({ day: d.toISOString().slice(0, 10), views, downloads })
  }
  return series
}

function buildStorageBreakdown() {
  return [
    { resource_type: 'pyq', total_bytes: 182_000_000, file_count: 142 },
    { resource_type: 'lab', total_bytes: 54_000_000, file_count: 38 },
    { resource_type: 'syllabus', total_bytes: 9_500_000, file_count: 24 },
  ]
}

export function getDemoAnalyticsData(days = 30) {
  const topViewed = buildLeaderboard('views').slice(0, 8)
  const topDownloaded = buildLeaderboard('downloads').slice(0, 8)
  const trend = buildTrend(days)
  const storageBreakdown = buildStorageBreakdown()

  const totalResources = storageBreakdown.reduce((sum, r) => sum + r.file_count, 0)
  const totalStorageBytes = storageBreakdown.reduce((sum, r) => sum + r.total_bytes, 0)
  const totalViews = trend.reduce((sum, d) => sum + d.views, 0) + 340
  const totalDownloads = trend.reduce((sum, d) => sum + d.downloads, 0) + 120

  return {
    summary: {
      total_resources: totalResources,
      total_storage_bytes: totalStorageBytes,
      total_views: totalViews,
      total_downloads: totalDownloads,
      avg_file_size_bytes: Math.round(totalStorageBytes / totalResources),
    },
    topViewed,
    topDownloaded,
    trend,
    storageBreakdown,
  }
}
