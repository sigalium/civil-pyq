const LABELS = {
  submissions: 'Submissions',
  resources: 'Resources',
  upload: 'Upload',
  migration: 'Migration',
  contributors: 'Contributors',
  trash: 'Trash',
  members: 'Members',
  audit: 'Log',
  analytics: 'Analytics',
  settings: 'Settings',
}

const INFO = {
  submissions: 'Student uploads waiting for review. Approve, edit or reject.',
  resources: 'Add, edit and reorder papers, lab manuals and syllabi.',
  upload: 'Publish many files at once.',
  migration: 'Move files to another subject or semester.',
  contributors: 'Cards shown on the Contribute page.',
  trash: 'Deleted items stay here for 30 days.',
  members: 'Admin accounts and permissions.',
  audit: 'Every change, with who made it.',
  analytics: 'Views, downloads and storage.',
  settings: 'Site switches, maintenance and monthly cleanup.',
}

const GROUPS = [
  { title: 'Submissions', tabs: ['submissions'] },
  { title: 'Files', tabs: ['resources', 'upload', 'migration'] },
  { title: 'Site content', tabs: ['contributors', 'trash'] },
  { title: 'Team', tabs: ['members', 'audit'] },
  { title: 'Insights', tabs: ['analytics', 'settings'] },
]

export function buildTourSteps(visibleTabs) {
  const shown = new Set(visibleTabs)
  const steps = [
    { id: 'welcome', title: 'Welcome to the dashboard', text: 'A quick tour of the main sections.', targets: [], items: [] },
  ]
  GROUPS.forEach((group) => {
    const tabs = group.tabs.filter((id) => shown.has(id))
    if (!tabs.length) return
    steps.push({
      id: group.title,
      title: group.title,
      text: '',
      targets: tabs,
      items: tabs.map((id) => ({ label: LABELS[id], text: INFO[id] })),
    })
  })
  steps.push({
    id: 'done',
    title: "You're all set",
    text: 'Banners at the top flag maintenance and cleanup windows. Replay this tour from the header.',
    targets: [],
    items: [],
  })
  return steps
}
