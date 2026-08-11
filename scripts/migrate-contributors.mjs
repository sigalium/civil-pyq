import { createClient } from '@supabase/supabase-js'
import contributors from '../src/data/contributors.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const rows = contributors.map((c, index) => ({
    name: c.name,
    role_type: c.type,
    batch_year: c.type === 'student' ? String(c.batchYear ?? '') || null : null,
    department: c.type === 'faculty' ? c.department || null : null,
    profile_pic: c.profilePic || null,
    is_top_contributor: !!c.isTopContributor,
    sort_order: index,
  }))

  console.log(`Inserting ${rows.length} contributors...`)
  const { error } = await supabase.from('contributors').insert(rows)
  if (error) {
    console.error('Failed inserting contributors:', error.message)
    process.exit(1)
  }
  console.log('Migration complete.')
}

run()
