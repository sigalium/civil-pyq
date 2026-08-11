import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const ResourcesDataContext = createContext(null)

export function ResourcesDataProvider({ children }) {
  const [subjectRows, setSubjectRows] = useState([])
  const [resourceRows, setResourceRows] = useState([])
  const [settingsRows, setSettingsRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const initializedRef = useRef(false)

  const refresh = useCallback(async () => {
    if (!initializedRef.current) setLoading(true)
    setError('')

    const [subjectsRes, resourcesRes, settingsRes] = await Promise.all([
      supabase.from('subjects').select('*').order('semester').order('sort_order'),
      supabase.from('resources').select('*').order('sort_order'),
      supabase.from('global_resources').select('*').like('key', 'syllabus_semester_%'),
    ])

    if (subjectsRes.error || resourcesRes.error) {
      setError('Could not load resources right now.')
      setLoading(false)
      return
    }

    setSubjectRows(subjectsRes.data || [])
    setResourceRows(resourcesRes.data || [])
    setSettingsRows(settingsRes.data || [])
    setLoading(false)
    initializedRef.current = true
  }, [])

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

  const resources = {}
  resourceRows.filter((row) => !row.deleted_at).forEach((row) => {
    if (!resources[row.subject]) {
      resources[row.subject] = { syllabus: null, pyq: [], lab: [] }
    }
    if (row.resource_type === 'syllabus') {
      resources[row.subject].syllabus = { id: row.id, path: row.path }
    } else {
      resources[row.subject][row.resource_type].push({ id: row.id, name: row.name, path: row.path })
    }
  })

  Object.keys(subjectSemester).forEach((subjectName) => {
    if (!resources[subjectName]) {
      resources[subjectName] = { syllabus: null, pyq: [], lab: [] }
    }
    const sem = subjectSemester[subjectName]
    const specificPath = resources[subjectName].syllabus?.path || null
    resources[subjectName].effectiveSyllabusPath = specificPath || centralSyllabus[sem] || null
    resources[subjectName].isCentralSyllabus = !specificPath && !!centralSyllabus[sem]
  })

  return (
    <ResourcesDataContext.Provider
      value={{ subjectRows, resourceRows, subjects, electives, resources, centralSyllabus, loading, error, refresh }}
    >
      {children}
    </ResourcesDataContext.Provider>
  )
}

export function useResourcesData() {
  const ctx = useContext(ResourcesDataContext)
  if (!ctx) throw new Error('useResourcesData must be used within a ResourcesDataProvider')
  return ctx
}
