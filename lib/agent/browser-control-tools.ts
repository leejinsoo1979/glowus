/**
 * Browser Control Tools
 *
 * Control web browsers using Stagehand for automation.
 */

import { isBrowserControlAllowed, type AgentRole } from './permissions'

// Stagehand client will be imported dynamically to avoid SSR issues
type StagehandClient = any

// Track browser sessions
const browserSessions = new Map<string, StagehandClient>()

// ============================================
// Browser Session Management
// ============================================

/**
 * Start a browser session
 */
export async function startBrowserSession(
  browser: 'chrome' | 'firefox' | 'safari' | 'edge',
  role: AgentRole,
  options?: {
    headless?: boolean
    url?: string
  }
): Promise<{ sessionId: string; message: string }> {
  if (!isBrowserControlAllowed(role, browser)) {
    throw new Error(`Permission denied: ${role} cannot control ${browser}`)
  }

  try {
    // Dynamic import to avoid SSR issues
    const { Stagehand } = await import('@browserbasehq/stagehand')

    const client = new Stagehand({
      env: process.env.NODE_ENV === 'production' ? 'BROWSERBASE' : 'LOCAL',
      verbose: 1,
    })

    await client.init()

    const sessionId = `${browser}-${Date.now()}`
    browserSessions.set(sessionId, client)

    // Navigate to URL if provided
    if (options?.url) {
      const page = client.context.pages()[0]
      await page.goto(options.url)
    }

    return {
      sessionId,
      message: `Started ${browser} session${options?.url ? ` at ${options.url}` : ''}`,
    }
  } catch (error: any) {
    throw new Error(`Failed to start browser session: ${error.message}`)
  }
}

/**
 * Close a browser session
 */
export async function closeBrowserSession(
  sessionId: string,
  role: AgentRole
): Promise<{ message: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    await client.close()
    browserSessions.delete(sessionId)

    return {
      message: `Closed browser session ${sessionId}`,
    }
  } catch (error: any) {
    throw new Error(`Failed to close browser session: ${error.message}`)
  }
}

/**
 * Get list of active browser sessions
 */
export async function listBrowserSessions(
  role: AgentRole
): Promise<{ sessionId: string; active: boolean }[]> {
  const sessions: { sessionId: string; active: boolean }[] = []

  for (const [sessionId, client] of browserSessions.entries()) {
    sessions.push({
      sessionId,
      active: !!client,
    })
  }

  return sessions
}

// ============================================
// Browser Navigation
// ============================================

/**
 * Navigate to a URL
 */
export async function navigateToURL(
  sessionId: string,
  url: string,
  role: AgentRole
): Promise<{ message: string; url: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    const page = client.context.pages()[0]
    await page.goto(url)

    return {
      message: `Navigated to ${url}`,
      url,
    }
  } catch (error: any) {
    throw new Error(`Failed to navigate: ${error.message}`)
  }
}

/**
 * Get current URL
 */
export async function getCurrentURL(
  sessionId: string,
  role: AgentRole
): Promise<{ url: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    const page = client.context.pages()[0]
    const url = page.url()

    return { url }
  } catch (error: any) {
    throw new Error(`Failed to get URL: ${error.message}`)
  }
}

/**
 * Go back in browser history
 */
export async function goBack(
  sessionId: string,
  role: AgentRole
): Promise<{ message: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    const page = client.context.pages()[0]
    await page.goBack()

    return {
      message: 'Navigated back',
    }
  } catch (error: any) {
    throw new Error(`Failed to go back: ${error.message}`)
  }
}

/**
 * Go forward in browser history
 */
export async function goForward(
  sessionId: string,
  role: AgentRole
): Promise<{ message: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    const page = client.context.pages()[0]
    await page.goForward()

    return {
      message: 'Navigated forward',
    }
  } catch (error: any) {
    throw new Error(`Failed to go forward: ${error.message}`)
  }
}

/**
 * Refresh the page
 */
export async function refreshPage(
  sessionId: string,
  role: AgentRole
): Promise<{ message: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    const page = client.context.pages()[0]
    await page.reload()

    return {
      message: 'Page refreshed',
    }
  } catch (error: any) {
    throw new Error(`Failed to refresh page: ${error.message}`)
  }
}

// ============================================
// Browser Interaction
// ============================================

/**
 * Click an element using AI (Stagehand)
 */
export async function clickElement(
  sessionId: string,
  description: string,
  role: AgentRole
): Promise<{ message: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    await client.act(`click on ${description}`)

    return {
      message: `Clicked on "${description}"`,
    }
  } catch (error: any) {
    throw new Error(`Failed to click element: ${error.message}`)
  }
}

/**
 * Type text into an input field
 */
export async function typeText(
  sessionId: string,
  description: string,
  text: string,
  role: AgentRole
): Promise<{ message: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    await client.act(`type "${text}" into ${description}`)

    return {
      message: `Typed "${text}" into "${description}"`,
    }
  } catch (error: any) {
    throw new Error(`Failed to type text: ${error.message}`)
  }
}

/**
 * Extract text from the page
 */
export async function extractText(
  sessionId: string,
  description: string,
  role: AgentRole
): Promise<{ text: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    const result = await client.extract(`extract ${description}`)

    return {
      text: JSON.stringify(result, null, 2),
    }
  } catch (error: any) {
    throw new Error(`Failed to extract text: ${error.message}`)
  }
}

/**
 * Take a screenshot
 */
export async function takeScreenshot(
  sessionId: string,
  role: AgentRole
): Promise<{ screenshot: string; message: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    const page = client.context.pages()[0]
    const screenshot = await page.screenshot({ encoding: 'base64' })

    return {
      screenshot: screenshot as string,
      message: 'Screenshot taken',
    }
  } catch (error: any) {
    throw new Error(`Failed to take screenshot: ${error.message}`)
  }
}

/**
 * Execute custom action (natural language)
 */
export async function executeAction(
  sessionId: string,
  action: string,
  role: AgentRole
): Promise<{ message: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    await client.act(action)

    return {
      message: `Executed action: ${action}`,
    }
  } catch (error: any) {
    throw new Error(`Failed to execute action: ${error.message}`)
  }
}

/**
 * Get page content
 */
export async function getPageContent(
  sessionId: string,
  role: AgentRole
): Promise<{ title: string; html: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    const page = client.context.pages()[0]
    const title = await page.title()
    const html = await page.content()

    return {
      title,
      html,
    }
  } catch (error: any) {
    throw new Error(`Failed to get page content: ${error.message}`)
  }
}

/**
 * Wait for element
 */
export async function waitForElement(
  sessionId: string,
  selector: string,
  role: AgentRole,
  timeout: number = 30000
): Promise<{ message: string }> {
  const client = browserSessions.get(sessionId)

  if (!client) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }

  try {
    const page = client.context.pages()[0]
    await page.waitForSelector(selector, { timeout })

    return {
      message: `Element "${selector}" appeared`,
    }
  } catch (error: any) {
    throw new Error(`Failed to wait for element: ${error.message}`)
  }
}
