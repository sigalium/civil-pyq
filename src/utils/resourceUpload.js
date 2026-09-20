import { buildStagingRepoPath } from './resourceSnippet'
import { uploadFileToGithub } from './githubUpload'

export async function uploadResourceFile({ file, semester, subject, type, label }) {
  const repoPath = buildStagingRepoPath({
    semester,
    subject,
    resource_type: type,
    resource_label: label || 'Untitled',
    file_path: file.name,
  })
  return uploadFileToGithub({
    file,
    repoPath,
    commitMessage: `Add ${label || type} (Sem ${semester} - ${subject})`,
  })
}
