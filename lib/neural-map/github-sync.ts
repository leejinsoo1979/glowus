/**
 * GitHub Sync Utility
 *
 * Blueprint 진행 상황을 GitHub에 동기화
 * - Issue 생성/업데이트
 * - PR 진행률 코멘트
 * - Commit 연결
 */

import type { BlueprintNode, BlueprintProgress } from './blueprint-sync'

// GitHub API 설정
interface GitHubConfig {
  owner: string
  repo: string
  token: string
}

// Issue 생성/업데이트
interface GitHubIssue {
  number?: number
  title: string
  body: string
  labels?: string[]
  state?: 'open' | 'closed'
}

// GitHub API 요청 헬퍼
async function githubRequest<T>(
  config: GitHubConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Blueprint 진행률을 Issue body로 포맷
export function formatBlueprintToIssueBody(
  projectName: string,
  progress: BlueprintProgress,
  nodes: BlueprintNode[]
): string {
  const progressBar = '█'.repeat(Math.floor(progress.percentage / 10)) +
                      '░'.repeat(10 - Math.floor(progress.percentage / 10))

  let body = `## 🚀 ${projectName} - Development Progress\n\n`
  body += `### Progress: ${progress.percentage}%\n`
  body += `\`[${progressBar}]\`\n\n`

  body += `| Status | Count |\n`
  body += `|--------|-------|\n`
  body += `| ✅ Done | ${progress.done} |\n`
  body += `| 🔄 In Progress | ${progress.doing} |\n`
  body += `| ⏳ Todo | ${progress.todo} |\n`
  body += `| **Total** | **${progress.total}** |\n\n`

  body += `### Tasks\n\n`

  for (const node of nodes.sort((a, b) => a.position - b.position)) {
    const icon = node.status === 'done' ? '✅' :
                 node.status === 'doing' ? '🔄' : '⏳'
    const checked = node.status === 'done' ? 'x' : ' '
    const commit = node.gitCommit ? ` ([${node.gitCommit.slice(0, 7)}](../../commit/${node.gitCommit}))` : ''

    body += `- [${checked}] ${icon} **${node.title}**${commit}\n`
    if (node.description && node.description !== node.title) {
      body += `  > ${node.description.split('\n')[0]}\n`
    }
  }

  if (progress.estimatedHoursRemaining) {
    body += `\n---\n⏱️ **Estimated Time Remaining:** ${progress.estimatedHoursRemaining}h\n`
  }

  body += `\n---\n*🤖 Auto-updated by GlowUS Blueprint*`

  return body
}

// Blueprint → GitHub Issue 동기화
export async function syncBlueprintToGitHubIssue(
  config: GitHubConfig,
  projectName: string,
  progress: BlueprintProgress,
  nodes: BlueprintNode[],
  issueNumber?: number
): Promise<number> {
  const body = formatBlueprintToIssueBody(projectName, progress, nodes)

  if (issueNumber) {
    // 기존 Issue 업데이트
    await githubRequest(config, `/issues/${issueNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({
        body,
        state: progress.percentage === 100 ? 'closed' : 'open',
      }),
    })
    return issueNumber
  } else {
    // 새 Issue 생성
    const issue = await githubRequest<{ number: number }>(config, '/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: `📋 ${projectName} - Blueprint Progress`,
        body,
        labels: ['blueprint', 'progress-tracker'],
      }),
    })
    return issue.number
  }
}

// Blueprint 노드 완료 시 Issue 코멘트 추가
export async function addCompletionComment(
  config: GitHubConfig,
  issueNumber: number,
  node: BlueprintNode,
  commitSha?: string
): Promise<void> {
  const commitLink = commitSha
    ? ` Commit: [${commitSha.slice(0, 7)}](../../commit/${commitSha})`
    : ''

  await githubRequest(config, `/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      body: `✅ **Task Completed:** ${node.title}${commitLink}`,
    }),
  })
}

// PR에 진행률 코멘트 추가/업데이트
export async function updatePRProgress(
  config: GitHubConfig,
  prNumber: number,
  projectName: string,
  progress: BlueprintProgress,
  nodes: BlueprintNode[]
): Promise<void> {
  const body = formatBlueprintToIssueBody(projectName, progress, nodes)

  // 기존 Blueprint 코멘트 찾기
  const comments = await githubRequest<Array<{ id: number; body: string }>>(
    config,
    `/issues/${prNumber}/comments`
  )

  const existingComment = comments.find(c =>
    c.body.includes('🤖 Auto-updated by GlowUS Blueprint')
  )

  if (existingComment) {
    // 기존 코멘트 업데이트
    await githubRequest(config, `/issues/comments/${existingComment.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    })
  } else {
    // 새 코멘트 추가
    await githubRequest(config, `/issues/${prNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
  }
}

// Repository 정보 가져오기
export async function getRepoInfo(config: GitHubConfig): Promise<{
  name: string
  full_name: string
  default_branch: string
}> {
  return githubRequest(config, '')
}

// 최근 커밋 가져오기
export async function getRecentCommits(
  config: GitHubConfig,
  limit = 10
): Promise<Array<{
  sha: string
  message: string
  author: string
  date: string
}>> {
  const commits = await githubRequest<Array<{
    sha: string
    commit: {
      message: string
      author: { name: string; date: string }
    }
  }>>(config, `/commits?per_page=${limit}`)

  return commits.map(c => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author.name,
    date: c.commit.author.date,
  }))
}

// GitHub 연동 설정 저장/조회
export interface GitHubSyncSettings {
  enabled: boolean
  owner: string
  repo: string
  issueNumber?: number
  prNumber?: number
  autoSync: boolean
  syncInterval: number // minutes
}

export function getDefaultGitHubSettings(): GitHubSyncSettings {
  return {
    enabled: false,
    owner: '',
    repo: '',
    autoSync: true,
    syncInterval: 5,
  }
}
