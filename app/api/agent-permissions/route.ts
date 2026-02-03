/**
 * Agent Permissions Management API
 *
 * Allows users to view and configure agent permissions
 * for file system access, applications, and browser control.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  loadPermissionsConfig,
  savePermissionsConfig,
  updatePermissions,
  getPermissions,
  initializePermissions,
  type AgentRole,
  type AgentPermissions,
} from '@/lib/agent/permissions'

// ============================================
// GET - Load Current Permissions
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Initialize permissions if needed
    initializePermissions()

    // Get role from query params
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') as AgentRole | null

    if (role) {
      // Return permissions for specific role
      const permissions = getPermissions(role)
      return NextResponse.json({
        success: true,
        role,
        permissions,
      })
    }

    // Return all permissions
    const config = loadPermissionsConfig()
    return NextResponse.json({
      success: true,
      config,
    })
  } catch (error: any) {
    console.error('[Agent Permissions API] GET Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to load permissions',
      },
      { status: 500 }
    )
  }
}

// ============================================
// POST - Update Permissions
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { role, permissions } = body as {
      role: AgentRole
      permissions: Partial<AgentPermissions>
    }

    if (!role || !permissions) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role and permissions are required',
        },
        { status: 400 }
      )
    }

    // Validate role
    if (!['jeremy', 'rachel', 'amy', 'antigravity'].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid role: ${role}`,
        },
        { status: 400 }
      )
    }

    // Update permissions
    updatePermissions(role, permissions)

    return NextResponse.json({
      success: true,
      message: `Permissions updated for ${role}`,
      role,
      permissions: getPermissions(role),
    })
  } catch (error: any) {
    console.error('[Agent Permissions API] POST Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update permissions',
      },
      { status: 500 }
    )
  }
}

// ============================================
// PUT - Add Directory or App
// ============================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { role, type, value } = body as {
      role: AgentRole
      type: 'directory' | 'application' | 'command' | 'browser'
      value: string
    }

    if (!role || !type || !value) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role, type, and value are required',
        },
        { status: 400 }
      )
    }

    const currentPermissions = getPermissions(role)
    const updatedPermissions: Partial<AgentPermissions> = {}

    switch (type) {
      case 'directory':
        updatedPermissions.allowedDirectories = [
          ...currentPermissions.allowedDirectories,
          value,
        ]
        break
      case 'application':
        updatedPermissions.allowedApplications = [
          ...currentPermissions.allowedApplications,
          value,
        ]
        break
      case 'command':
        updatedPermissions.allowedCommands = [
          ...currentPermissions.allowedCommands,
          value,
        ]
        break
      case 'browser':
        updatedPermissions.allowedBrowsers = [
          ...currentPermissions.allowedBrowsers,
          value as any,
        ]
        break
    }

    updatePermissions(role, updatedPermissions)

    return NextResponse.json({
      success: true,
      message: `Added ${type}: ${value} for ${role}`,
      permissions: getPermissions(role),
    })
  } catch (error: any) {
    console.error('[Agent Permissions API] PUT Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to add permission',
      },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Remove Directory or App
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { role, type, value } = body as {
      role: AgentRole
      type: 'directory' | 'application' | 'command' | 'browser'
      value: string
    }

    if (!role || !type || !value) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role, type, and value are required',
        },
        { status: 400 }
      )
    }

    const currentPermissions = getPermissions(role)
    const updatedPermissions: Partial<AgentPermissions> = {}

    switch (type) {
      case 'directory':
        updatedPermissions.allowedDirectories = currentPermissions.allowedDirectories.filter(
          d => d !== value
        )
        break
      case 'application':
        updatedPermissions.allowedApplications = currentPermissions.allowedApplications.filter(
          a => a !== value
        )
        break
      case 'command':
        updatedPermissions.allowedCommands = currentPermissions.allowedCommands.filter(
          c => c !== value
        )
        break
      case 'browser':
        updatedPermissions.allowedBrowsers = currentPermissions.allowedBrowsers.filter(
          b => b !== value
        )
        break
    }

    updatePermissions(role, updatedPermissions)

    return NextResponse.json({
      success: true,
      message: `Removed ${type}: ${value} for ${role}`,
      permissions: getPermissions(role),
    })
  } catch (error: any) {
    console.error('[Agent Permissions API] DELETE Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to remove permission',
      },
      { status: 500 }
    )
  }
}
