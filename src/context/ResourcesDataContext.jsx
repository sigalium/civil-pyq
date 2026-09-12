import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ResourcesDataContext } from './useResourcesData'

const CACHE_KEY = 'civilpyq_resources_cache_v1'

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    return
  }
}

export function ResourcesDataProvider({ children }) {
  const [subjectRows, setSubjectRows] = useState([])
  const [resourceRows, setResourceRows] = useState([])
  const [settingsRows, setSettingsRows] = useState([])
  const [sectionRows, setSectionRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [usingCachedData, setUsingCachedData] = useState(false)
  const [cachedAt, setCachedAt] = useState(null)
  const [maintenanceStatus, setMaintenanceStatus] = useState(null)
  const initializedRef = useRef(false)

  const fetchMaintenanceStatus = useCallback(async () => {
    const { data } = await supabase.rpc('maintenance_status')
    if (data && data[0]) setMaintenanceStatus(data[0])
  }, [])

  useEffect(() => {
    fetchMaintenanceStatus()
    const interval = setInterval(fetchMaintenanceStatus, 45000)
    return () => clearInterval(interval)
  }, [fetchMaintenanceStatus])

  const refresh = useCallback(async () => {
    if (!initializedRef.current) setLoading(true)
    setError('')
    fetchMaintenanceStatus()

    const [subjectsRes, resourcesRes, settingsRes, sectionsRes] = await Promise.all([
      supabase.from('subjects').select('*').order('semester').order('sort_order'),
      supabase.from('resources').select('*').order('sort_order'),
      supabase.from('global_resources').select('*'),
      supabase.from('sections').select('*').order('sort_order'),
    ])

    if (subjectsRes.error || resourcesRes.error) {
      const cached = readCache()
      if (cached) {
        setSubjectRows(cached.subjectRows || [])
        setResourceRows(cached.resourceRows || [])
        setSettingsRows(cached.settingsRows || [])
        setSectionRows(cached.sectionRows || [])
        setUsingCachedData(true)
        setCachedAt(cached.savedAt || null)
        setLoading(false)
        initializedRef.current = true
        return
      }
      setError('Could not load resources right now.')
      setLoading(false)
      return
    }

    setSubjectRows(subjectsRes.data || [])
    setResourceRows(resourcesRes.data || [])
    setSettingsRows(settingsRes.data || [])
    setSectionRows(sectionsRes.data || [])
    setUsingCachedData(false)
    setLoading(false)
    initializedRef.current = true

    writeCache({
      subjectRows: subjectsRes.data || [],
      resourceRows: resourcesRes.data || [],
      settingsRows: settingsRes.data || [],
      sectionRows: sectionsRes.data || [],
      savedAt: new Date().toISOString(),
    })
  }, [fetchMaintenanceStatus])

  useEffect(() => {
    refresh()
  }, [refresh])

  const subjects = {}
  const electives = []
  const subjectSemester = {}
  subjectRows.filter((row) => !row.deleted_at).forEach((row) => {
    if (!subjects[row.semester]) subjects[row.semester] = []
    subjects[row.semester].push(row.name)
    if (row.is_elective) electives.push(row.name)
    subjectSemester[row.name] = row.semester
  })

  const centralSyllabus = {}
  settingsRows.forEach((row) => {
    const match = row.key.match(/^syllabus_semester_(\d+)$/)
    if (match && row.value) centralSyllabus[Number(match[1])] = row.value
  })

  const academicCalendarPath = settingsRows.find((row) => row.key === 'academic_calendar_path')?.value || ''
  const analyticsDemoModeRow = settingsRows.find((row) => row.key === 'analytics_demo_mode')
  const analyticsDemoMode = analyticsDemoModeRow ? analyticsDemoModeRow.value === 'true' : true
  const maintenanceActive = maintenanceStatus?.active || false
  const maintenanceMode = maintenanceStatus?.mode || false
  const maintenanceUntil = maintenanceStatus?.until || ''
  const maintenanceType = maintenanceStatus?.type || 'indefinite'
  const maintenanceMessage = maintenanceStatus?.message || ''
  const maintenanceStartedAt = maintenanceStatus?.started_at || ''
  const submissionIntakeRow = settingsRows.find((row) => row.key === 'submission_intake_enabled')
  const submissionIntakeEnabled = submissionIntakeRow ? submissionIntakeRow.value === 'true' : true

  const isCodesById = {}
  resourceRows.forEach((row) => {
    if (row.resource_type === 'iscode') isCodesById[row.id] = row
  })

  const resources = {}
  const isCodes = []
  resourceRows.filter((row) => !row.deleted_at).forEach((row) => {
    if (row.resource_type === 'iscode') {
      isCodes.push({ id: row.id, name: row.name, path: row.path, description: row.description || '', file_size_bytes: row.file_size_bytes, sort_order: row.sort_order, section_id: row.section_id || null })
      return
    }
    if (!resources[row.subject]) {
      resources[row.subject] = { syllabus: null, pyq: [], lab: [] }
    }
    if (row.resource_type === 'syllabus') {
      resources[row.subject].syllabus = { id: row.id, path: row.path }
    } else if (resources[row.subject][row.resource_type]) {
      const linkedSource = row.linked_iscode_id ? isCodesById[row.linked_iscode_id] : null
      const isBrokenLink = !!row.linked_iscode_id && (!linkedSource || linkedSource.deleted_at)
      resources[row.subject][row.resource_type].push({
        id: row.id,
        name: linkedSource ? linkedSource.name : row.name,
        path: linkedSource ? linkedSource.path : row.path,
        description: linkedSource ? (linkedSource.description || '') : (row.description || ''),
        file_size_bytes: linkedSource ? linkedSource.file_size_bytes : row.file_size_bytes,
        linked_iscode_id: row.linked_iscode_id,
        isBrokenLink,
      })
    }
  })
  isCodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  Object.keys(subjectSemester).forEach((subjectName) => {
    if (!resources[subjectName]) {
      resources[subjectName] = { syllabus: null, pyq: [], lab: [] }
    }
    const sem = subjectSemester[subjectName]
    const specificPath = resources[subjectName].syllabus?.path || null
    resources[subjectName].effectiveSyllabusPath = specificPath || centralSyllabus[sem] || null
    resources[subjectName].isCentralSyllabus = !specificPath && !!centralSyllabus[sem]
  })

  const sections = sectionRows.filter((row) => !row.deleted_at).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  return (
    <ResourcesDataContext.Provider
      value={{ subjectRows, resourceRows, subjects, electives, resources, centralSyllabus, academicCalendarPath, analyticsDemoMode, maintenanceActive, maintenanceMode, maintenanceUntil, maintenanceType, maintenanceMessage, maintenanceStartedAt, submissionIntakeEnabled, isCodes, sections, sectionRows, loading, error, usingCachedData, cachedAt, refresh }}
    >
      {children}
    </ResourcesDataContext.Provider>
  )
}
