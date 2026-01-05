import { NextResponse } from 'next/server'
import { createClient, getAuthUser } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// GET: List user's GitHub repositories
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '30')
    const sort = searchParams.get('sort') || 'updated' // created, updated, pushed, full_name
    const type = searchParams.get('type') || 'all' // all, owner, member

    const supabase = await createClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get GitHub connection with access token
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: connection, error: connError } = await adminClient
      .from('user_github_connections')
      .select('access_token, github_username')
      .eq('user_id', user.id)
      .single()

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'GitHub not connected', code: 'NOT_CONNECTED' },
        { status: 400 }
      )
    }

    // Fetch repositories from GitHub API
    const reposResponse = await fetch(
      `https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=${sort}&type=${type}`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    )

    if (!reposResponse.ok) {
      const errorData = await reposResponse.json().catch(() => ({}))
      console.error('[GitHub Repos] API error:', errorData)

      if (reposResponse.status === 401) {
        return NextResponse.json(
          { error: 'GitHub token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to fetch repositories' },
        { status: reposResponse.status }
      )
    }

    const repos = await reposResponse.json()

    // Transform to simplified format
    const transformedRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      ssh_url: repo.ssh_url,
      default_branch: repo.default_branch,
      owner: {
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url,
      },
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
    }))

    // Get pagination info from Link header
    const linkHeader = reposResponse.headers.get('Link')
    const hasMore = linkHeader?.includes('rel="next"') || false

    return NextResponse.json({
      repos: transformedRepos,
      pagination: {
        page,
        per_page: perPage,
        has_more: hasMore,
      },
    })

  } catch (err: any) {
    console.error('[GitHub Repos] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: Create a new repository
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, private: isPrivate = true, auto_init = true } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Repository name is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get GitHub connection with access token
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: connection, error: connError } = await adminClient
      .from('user_github_connections')
      .select('access_token, github_username')
      .eq('user_id', user.id)
      .single()

    if (connError || !connection) {
      return NextResponse.json(
        { error: 'GitHub not connected', code: 'NOT_CONNECTED' },
        { status: 400 }
      )
    }

    // Create repository via GitHub API
    const createResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init,
      }),
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}))
      console.error('[GitHub Repos] Create error:', errorData)

      if (createResponse.status === 422) {
        return NextResponse.json(
          { error: 'Repository name already exists' },
          { status: 422 }
        )
      }

      return NextResponse.json(
        { error: errorData.message || 'Failed to create repository' },
        { status: createResponse.status }
      )
    }

    const repo = await createResponse.json()

    return NextResponse.json({
      success: true,
      repo: {
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        default_branch: repo.default_branch,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
        },
      },
    })

  } catch (err: any) {
    console.error('[GitHub Repos] Error:', err)
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
