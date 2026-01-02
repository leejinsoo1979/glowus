'use client'

import { useEffect, useState } from 'react'
import { TaskHubPage } from '@/components/task-hub'

interface Project {
  id: string
  name: string
}

interface Agent {
  id: string
  name: string
}

interface User {
  id: string
  name: string
  email: string
}

export default function TaskHubDashboardPage() {
  const [companyId, setCompanyId] = useState<string | undefined>()
  const [projects, setProjects] = useState<Project[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [users, setUsers] = useState<User[]>([])

  // 초기 데이터 로드
  useEffect(() => {
    async function loadInitialData() {
      try {
        // 회사 정보 로드 (DEV 모드에서는 첫 번째 회사 사용)
        const companyRes = await fetch('/api/erp/companies?limit=1')
        const companyData = await companyRes.json()
        if (companyData.success && companyData.data?.data?.[0]) {
          setCompanyId(companyData.data.data[0].id)
        }

        // 프로젝트 목록 로드
        const projectRes = await fetch('/api/projects?limit=50')
        const projectData = await projectRes.json()
        if (projectData.success && projectData.data) {
          setProjects(projectData.data.map((p: any) => ({
            id: p.id,
            name: p.name,
          })))
        }

        // Agent 목록 로드
        const agentRes = await fetch('/api/agents?limit=50')
        const agentData = await agentRes.json()
        if (agentData.success && agentData.data) {
          setAgents(agentData.data.map((a: any) => ({
            id: a.id,
            name: a.name,
          })))
        }

        // 사용자 목록 로드 (직원)
        const userRes = await fetch('/api/erp/employees?limit=50')
        const userData = await userRes.json()
        if (userData.success && userData.data?.data) {
          setUsers(userData.data.data.map((u: any) => ({
            id: u.user_id || u.id,
            name: u.name,
            email: u.email,
          })))
        }
      } catch (error) {
        console.error('[TaskHub] Failed to load initial data:', error)
      }
    }

    loadInitialData()
  }, [])

  return (
    <div className="h-full">
      <TaskHubPage
        companyId={companyId}
        projects={projects}
        agents={agents}
        users={users}
      />
    </div>
  )
}
