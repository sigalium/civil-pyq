import { supabase } from '../lib/supabaseClient'
import { extractRepoPathFromUrl } from './resourceSnippet'

export async function recordReplacedFile({ oldUrl, resourceName, resourceType, fileSizeBytes }) {
  if (!oldUrl) return
  const repoPath = extractRepoPathFromUrl(oldUrl)
  if (!repoPath) return
  const { data: sessionData } = await supabase.auth.getSession()
  const replacedBy = sessionData?.session?.user?.email || null
  await supabase.from('replaced_files').insert({
    resource_name: resourceName,
    resource_type: resourceType || null,
    github_path: repoPath,
    jsdelivr_url: oldUrl,
    file_size_bytes: fileSizeBytes || null,
    replaced_by: replacedBy,
  })
}
