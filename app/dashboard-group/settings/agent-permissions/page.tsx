'use client'

/**
 * Agent Permissions Management UI
 *
 * Allows users to configure agent access to:
 * - File system directories
 * - Applications
 * - Browser control
 * - System commands
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type AgentRole = 'jeremy' | 'rachel' | 'amy' | 'antigravity'

interface AgentPermissions {
  allowedDirectories: string[]
  deniedDirectories: string[]
  allowedApplications: string[]
  allowBrowserControl: boolean
  allowedBrowsers: ('chrome' | 'firefox' | 'safari' | 'edge')[]
  allowedCommands: string[]
  deniedCommands: string[]
  allowNetworkAccess: boolean
}

export default function AgentPermissionsPage() {
  const [selectedRole, setSelectedRole] = useState<AgentRole>('jeremy')
  const [permissions, setPermissions] = useState<AgentPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [newDirectory, setNewDirectory] = useState('')
  const [newApp, setNewApp] = useState('')

  // Load permissions
  useEffect(() => {
    loadPermissions()
  }, [selectedRole])

  async function loadPermissions() {
    setLoading(true)
    try {
      const res = await fetch(`/api/agent-permissions?role=${selectedRole}`)
      const data = await res.json()
      if (data.success) {
        setPermissions(data.permissions)
      }
    } catch (error) {
      console.error('Failed to load permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  async function addDirectory() {
    if (!newDirectory) return

    try {
      const res = await fetch('/api/agent-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          type: 'directory',
          value: newDirectory,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPermissions(data.permissions)
        setNewDirectory('')
      }
    } catch (error) {
      console.error('Failed to add directory:', error)
    }
  }

  async function removeDirectory(dir: string) {
    try {
      const res = await fetch('/api/agent-permissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          type: 'directory',
          value: dir,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPermissions(data.permissions)
      }
    } catch (error) {
      console.error('Failed to remove directory:', error)
    }
  }

  async function addApplication() {
    if (!newApp) return

    try {
      const res = await fetch('/api/agent-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          type: 'application',
          value: newApp,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPermissions(data.permissions)
        setNewApp('')
      }
    } catch (error) {
      console.error('Failed to add application:', error)
    }
  }

  async function removeApplication(app: string) {
    try {
      const res = await fetch('/api/agent-permissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          type: 'application',
          value: app,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPermissions(data.permissions)
      }
    } catch (error) {
      console.error('Failed to remove application:', error)
    }
  }

  async function toggleBrowserControl(enabled: boolean) {
    try {
      const res = await fetch('/api/agent-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          permissions: { allowBrowserControl: enabled },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPermissions(data.permissions)
      }
    } catch (error) {
      console.error('Failed to toggle browser control:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading permissions...</div>
      </div>
    )
  }

  if (!permissions) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">Failed to load permissions</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Agent Permissions</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Configure what your agents can access on your system
        </p>

        {/* Role Selector */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Select Agent Role</h2>
          <div className="flex gap-2">
            {(['jeremy', 'rachel', 'amy', 'antigravity'] as AgentRole[]).map(role => (
              <Button
                key={role}
                variant={selectedRole === role ? 'default' : 'outline'}
                onClick={() => setSelectedRole(role)}
                className="capitalize"
              >
                {role}
              </Button>
            ))}
          </div>
        </Card>

        {/* Directories */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📁 Folder Access</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {selectedRole}가 접근할 수 있는 폴더
          </p>

          <div className="space-y-2 mb-4">
            {permissions.allowedDirectories.map(dir => (
              <div
                key={dir}
                className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <code className="text-sm flex-1">{dir}</code>
                <button
                  onClick={() => removeDirectory(dir)}
                  className="px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm font-medium"
                >
                  ❌ 제거
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newDirectory}
              onChange={e => setNewDirectory(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addDirectory()}
              placeholder="/Users/username/Documents"
              className="flex-1 px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
            <button
              onClick={addDirectory}
              className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition font-medium"
            >
              ✅ 추가
            </button>
          </div>
        </Card>

        {/* Applications */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🚀 App Control</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {selectedRole}가 실행할 수 있는 프로그램
          </p>

          <div className="space-y-2 mb-4">
            {permissions.allowedApplications.map(app => (
              <div
                key={app}
                className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                <code className="text-sm flex-1">{app}</code>
                <button
                  onClick={() => removeApplication(app)}
                  className="px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm font-medium"
                >
                  ❌ 제거
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newApp}
              onChange={e => setNewApp(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addApplication()}
              placeholder="/Applications/Visual Studio Code.app"
              className="flex-1 px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
            <button
              onClick={addApplication}
              className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition font-medium"
            >
              ✅ 추가
            </button>
          </div>
        </Card>

        {/* Browser Control */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🌐 Browser Control</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Allow {selectedRole} to control web browsers
          </p>

          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={permissions.allowBrowserControl}
                onChange={e => toggleBrowserControl(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Enable browser control</span>
            </label>
          </div>

          {permissions.allowBrowserControl && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">Allowed browsers:</p>
              <div className="flex gap-2">
                {permissions.allowedBrowsers.map(browser => (
                  <div
                    key={browser}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded capitalize"
                  >
                    {browser}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Commands */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">⌨️ Allowed Commands</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Terminal commands that {selectedRole} can execute
          </p>

          <div className="flex flex-wrap gap-2">
            {permissions.allowedCommands.map(cmd => (
              <div
                key={cmd}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm"
              >
                {cmd}
              </div>
            ))}
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-6 mt-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold mb-2">ℹ️ How to use</h3>
          <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
            <li>• Use <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">/api/claude-code/system</code> for full system access</li>
            <li>• Permissions are saved to <code className="px-1 bg-blue-100 dark:bg-blue-900 rounded">~/.glowus/agent-permissions.json</code></li>
            <li>• Agents can only access directories and apps you explicitly allow</li>
            <li>• Browser control requires Stagehand to be running</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
