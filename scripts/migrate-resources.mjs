import { createClient } from '@supabase/supabase-js'
import subjects, { electives } from '../src/data/subjects.js'
import resources from '../src/data/resources.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const JSDELIVR_OWNER = process.env.JSDELIVR_OWNER
const JSDELIVR_REPO = process.env.JSDELIVR_REPO
const JSDELIVR_BRANCH = process.env.JSDELIVR_BRANCH || 'main'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JSDELIVR_OWNER || !JSDELIVR_REPO) {
  console.error('Missing one of SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JSDELIVR_OWNER, JSDELIVR_REPO')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function toJsDelivr(localPath) {
  const cleaned = localPath.replace(/^\/pdfs\//, '')
  return `https://cdn.jsdelivr.net/gh/${JSDELIVR_OWNER}/${JSDELIVR_REPO}@${JSDELIVR_BRANCH}/pdfs/${cleaned}`
}

async function run() {
  const subjectRows = []
  Object.entries(subjects).forEach(([semester, names]) => {
    if (!names) return
    names.forEach((name, index) => {
      subjectRows.push({
        semester: Number(semester),
        name,
        is_elective: electives.includes(name),
        sort_order: index,
      })
    })
  })

  console.log(`Inserting ${subjectRows.length} subjects...`)
  const { error: subjectsError } = await supabase.from('subjects').upsert(subjectRows, {
    onConflict: 'semester,name',
  })
  if (subjectsError) {
    console.error('Failed inserting subjects:', subjectsError.message)
    process.exit(1)
  }

  const resourceRows = []
  Object.entries(subjects).forEach(([semester, names]) => {
    if (!names) return
    names.forEach((subjectName) => {
      const entry = resources[subjectName]
      if (!entry) return

      if (entry.syllabus === true) {
        resourceRows.push({
          semester: Number(semester),
          subject: subjectName,
          resource_type: 'syllabus',
          name: 'Syllabus',
          path: toJsDelivr(`/pdfs/Semester${semester}/${subjectName}/Syllabus.pdf`),
          sort_order: 0,
        })
      }

      ;(entry.pyq || []).forEach((item, index) => {
        resourceRows.push({
          semester: Number(semester),
          subject: subjectName,
          resource_type: 'pyq',
          name: item.name,
          path: toJsDelivr(item.path),
          sort_order: index,
        })
      })

      ;(entry.lab || []).forEach((item, index) => {
        resourceRows.push({
          semester: Number(semester),
          subject: subjectName,
          resource_type: 'lab',
          name: item.name,
          path: toJsDelivr(item.path),
          sort_order: index,
        })
      })
    })
  })

  console.log(`Inserting ${resourceRows.length} resources...`)
  const chunkSize = 500
  for (let i = 0; i < resourceRows.length; i += chunkSize) {
    const chunk = resourceRows.slice(i, i + chunkSize)
    const { error: resourcesError } = await supabase.from('resources').insert(chunk)
    if (resourcesError) {
      console.error('Failed inserting resources chunk:', resourcesError.message)
      process.exit(1)
    }
  }

  console.log('Migration complete.')
}

run()
