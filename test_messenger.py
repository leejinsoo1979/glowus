from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Enable console logging
    page.on("console", lambda msg: print(f"[Console] {msg.type}: {msg.text}"))

    print("Navigating to messenger...")
    page.goto('http://localhost:3000/dashboard-group/messenger')

    print("Waiting for network idle...")
    try:
        page.wait_for_load_state('networkidle', timeout=30000)
        print("Network idle reached")
    except Exception as e:
        print(f"Timeout waiting for networkidle: {e}")

    # Take screenshot
    page.screenshot(path='.playwright-mcp/messenger-test.png', full_page=True)
    print("Screenshot saved to .playwright-mcp/messenger-test.png")

    # Check for loading spinner
    loading = page.locator('.animate-spin').count()
    print(f"Loading spinners found: {loading}")

    # Check for chat rooms or empty state
    empty_msg = page.locator('text=채팅이 없습니다').count()
    print(f"Empty message found: {empty_msg}")

    # Get page content for debugging
    content = page.content()
    if 'Loader2' in content or 'animate-spin' in content:
        print("WARNING: Page still has loading indicators!")

    browser.close()
    print("Test complete")
