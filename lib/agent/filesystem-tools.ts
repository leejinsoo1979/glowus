/**
 * File System Access Tools
 *
 * Secure file operations with permission checks based on agent roles.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, unlinkSync, renameSync } from 'fs'
import { join, dirname, basename, extname } from 'path'
import { isPathAllowed, type AgentRole } from './permissions'

// ============================================
// File Operations
// ============================================

/**
 * Read file contents with permission check
 */
export async function readFileSecure(path: string, role: AgentRole): Promise<string> {
  if (!isPathAllowed(path, role)) {
    throw new Error(`Permission denied: ${role} cannot access ${path}`)
  }

  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`)
  }

  try {
    return readFileSync(path, 'utf-8')
  } catch (error: any) {
    throw new Error(`Failed to read file: ${error.message}`)
  }
}

/**
 * Write file contents with permission check
 */
export async function writeFileSecure(
  path: string,
  content: string,
  role: AgentRole
): Promise<void> {
  if (!isPathAllowed(path, role)) {
    throw new Error(`Permission denied: ${role} cannot write to ${path}`)
  }

  try {
    // Ensure directory exists
    const dir = dirname(path)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(path, content, 'utf-8')
  } catch (error: any) {
    throw new Error(`Failed to write file: ${error.message}`)
  }
}

/**
 * List directory contents with permission check
 */
export async function listDirectorySecure(
  path: string,
  role: AgentRole
): Promise<{ name: string; isDirectory: boolean; size: number }[]> {
  if (!isPathAllowed(path, role)) {
    throw new Error(`Permission denied: ${role} cannot access ${path}`)
  }

  if (!existsSync(path)) {
    throw new Error(`Directory not found: ${path}`)
  }

  try {
    const entries = readdirSync(path)
    return entries.map(name => {
      const fullPath = join(path, name)
      const stats = statSync(fullPath)
      return {
        name,
        isDirectory: stats.isDirectory(),
        size: stats.size,
      }
    })
  } catch (error: any) {
    throw new Error(`Failed to list directory: ${error.message}`)
  }
}

/**
 * Create directory with permission check
 */
export async function createDirectorySecure(
  path: string,
  role: AgentRole
): Promise<void> {
  if (!isPathAllowed(path, role)) {
    throw new Error(`Permission denied: ${role} cannot create directory at ${path}`)
  }

  try {
    mkdirSync(path, { recursive: true })
  } catch (error: any) {
    throw new Error(`Failed to create directory: ${error.message}`)
  }
}

/**
 * Delete file with permission check
 */
export async function deleteFileSecure(
  path: string,
  role: AgentRole
): Promise<void> {
  if (!isPathAllowed(path, role)) {
    throw new Error(`Permission denied: ${role} cannot delete ${path}`)
  }

  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`)
  }

  try {
    unlinkSync(path)
  } catch (error: any) {
    throw new Error(`Failed to delete file: ${error.message}`)
  }
}

/**
 * Move/rename file with permission check
 */
export async function moveFileSecure(
  sourcePath: string,
  destPath: string,
  role: AgentRole
): Promise<void> {
  if (!isPathAllowed(sourcePath, role)) {
    throw new Error(`Permission denied: ${role} cannot access source ${sourcePath}`)
  }

  if (!isPathAllowed(destPath, role)) {
    throw new Error(`Permission denied: ${role} cannot access destination ${destPath}`)
  }

  if (!existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`)
  }

  try {
    // Ensure destination directory exists
    const destDir = dirname(destPath)
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true })
    }

    renameSync(sourcePath, destPath)
  } catch (error: any) {
    throw new Error(`Failed to move file: ${error.message}`)
  }
}

/**
 * Copy file with permission check
 */
export async function copyFileSecure(
  sourcePath: string,
  destPath: string,
  role: AgentRole
): Promise<void> {
  if (!isPathAllowed(sourcePath, role)) {
    throw new Error(`Permission denied: ${role} cannot access source ${sourcePath}`)
  }

  if (!isPathAllowed(destPath, role)) {
    throw new Error(`Permission denied: ${role} cannot write to destination ${destPath}`)
  }

  if (!existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`)
  }

  try {
    // Ensure destination directory exists
    const destDir = dirname(destPath)
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true })
    }

    const content = readFileSync(sourcePath)
    writeFileSync(destPath, content)
  } catch (error: any) {
    throw new Error(`Failed to copy file: ${error.message}`)
  }
}

/**
 * Get file info with permission check
 */
export async function getFileInfoSecure(
  path: string,
  role: AgentRole
): Promise<{
  name: string
  path: string
  size: number
  isDirectory: boolean
  modified: Date
  extension: string
}> {
  if (!isPathAllowed(path, role)) {
    throw new Error(`Permission denied: ${role} cannot access ${path}`)
  }

  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`)
  }

  try {
    const stats = statSync(path)
    return {
      name: basename(path),
      path,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      modified: stats.mtime,
      extension: extname(path),
    }
  } catch (error: any) {
    throw new Error(`Failed to get file info: ${error.message}`)
  }
}

/**
 * Search files in directory with permission check
 */
export async function searchFilesSecure(
  directory: string,
  pattern: string,
  role: AgentRole
): Promise<string[]> {
  if (!isPathAllowed(directory, role)) {
    throw new Error(`Permission denied: ${role} cannot access ${directory}`)
  }

  if (!existsSync(directory)) {
    throw new Error(`Directory not found: ${directory}`)
  }

  const results: string[] = []
  const regex = new RegExp(pattern, 'i')

  function searchRecursive(dir: string) {
    try {
      const entries = readdirSync(dir)
      for (const entry of entries) {
        const fullPath = join(dir, entry)

        // Skip if not allowed
        if (!isPathAllowed(fullPath, role)) {
          continue
        }

        const stats = statSync(fullPath)

        if (stats.isDirectory()) {
          searchRecursive(fullPath)
        } else if (regex.test(entry)) {
          results.push(fullPath)
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  searchRecursive(directory)
  return results
}
