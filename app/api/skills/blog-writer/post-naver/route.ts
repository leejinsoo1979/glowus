import { NextRequest, NextResponse } from 'next/server'
import puppeteer, { Browser, Page, Frame } from 'puppeteer-core'

/**
 * 네이버 블로그 자동 포스팅 API (Puppeteer 버전)
 *
 * Chrome 디버깅 모드 (9222 포트)에 연결하여
 * 실제 네이버 블로그에 글을 작성합니다.
 */

interface PostNaverRequest {
  action: 'connect' | 'login' | 'post' | 'status' | 'checkLogin'
  credentials?: {
    username: string
    password: string
  }
  post?: {
    title: string
    content: string
    tags: string[]
  }
}

// 전역 브라우저/페이지 상태 관리
let browser: Browser | null = null
let page: Page | null = null
let isLoggedIn = false

// 콘텐츠에서 이미지 마커 파싱
interface ContentPart {
  type: 'text' | 'image'
  content: string
}

function parseContentWithImages(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  const imagePattern = /\[IMAGE:(data:image\/[^;]+;base64,[^\]]+)\]/g
  let lastIndex = 0
  let match

  while ((match = imagePattern.exec(content)) !== null) {
    // 이미지 전의 텍스트
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) {
        parts.push({ type: 'text', content: text })
      }
    }
    // 이미지
    parts.push({ type: 'image', content: match[1] })
    lastIndex = match.index + match[0].length
  }

  // 마지막 텍스트
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) {
      parts.push({ type: 'text', content: text })
    }
  }

  return parts
}

// 유틸리티: 딜레이
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Chrome CDP 연결 (Puppeteer) - 새 페이지 생성 방식
async function connectToChrome(): Promise<{ success: boolean; message: string }> {
  try {
    // 기존 연결이 유효한지 확인
    if (browser && page) {
      try {
        await Promise.race([
          page.evaluate(() => document.title),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ])
        console.log('[BlogWriter] 기존 연결 재사용')
        return { success: true, message: '연결됨' }
      } catch {
        console.log('[BlogWriter] 기존 연결 끊어짐, 재연결...')
        try {
          if (page) await page.close().catch(() => {})
          await browser.disconnect()
        } catch {}
        browser = null
        page = null
      }
    }

    console.log('[BlogWriter] Puppeteer로 Chrome CDP 연결 시도...')

    // Get WebSocket URL first
    const versionRes = await fetch('http://127.0.0.1:9222/json/version')
    if (!versionRes.ok) {
      throw new Error('Chrome이 디버깅 모드로 실행되지 않았습니다.')
    }
    const version = await versionRes.json()
    const wsUrl = version.webSocketDebuggerUrl

    console.log('[BlogWriter] WebSocket URL:', wsUrl)

    // Puppeteer로 연결 (긴 protocolTimeout 설정)
    browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      defaultViewport: null,
      protocolTimeout: 120000  // 2분 타임아웃
    })

    // 새 페이지 생성 (기존 페이지 사용하면 타임아웃 발생)
    console.log('[BlogWriter] 새 페이지 생성 중...')
    page = await browser.newPage()

    console.log('[BlogWriter] Chrome CDP 연결 성공 (Puppeteer)')
    return { success: true, message: 'Chrome 연결 성공!' }
  } catch (error: any) {
    console.error('[BlogWriter] Chrome 연결 실패:', error.message)
    browser = null
    page = null
    return {
      success: false,
      message: `Chrome 연결 실패: ${error.message}\n\nChrome을 디버깅 모드로 실행해주세요:\n/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222`
    }
  }
}

// 네이버 로그인
async function loginNaver(username: string, password: string): Promise<{ success: boolean; message: string }> {
  if (!page) {
    return { success: false, message: 'Chrome에 먼저 연결해주세요.' }
  }

  try {
    // 네이버 로그인 페이지로 이동
    await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'networkidle0' })

    // 이미 로그인되어 있는지 확인
    const currentUrl = page.url()
    if (!currentUrl.includes('nidlogin')) {
      isLoggedIn = true
      return { success: true, message: '이미 로그인되어 있습니다.' }
    }

    // JavaScript로 직접 값 설정 (자동화 감지 우회)
    await page.evaluate(({ id, pw }) => {
      const idInput = document.querySelector('#id') as HTMLInputElement
      const pwInput = document.querySelector('#pw') as HTMLInputElement
      if (idInput) {
        idInput.value = id
        idInput.dispatchEvent(new Event('input', { bubbles: true }))
      }
      if (pwInput) {
        pwInput.value = pw
        pwInput.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, { id: username, pw: password })

    await delay(1000)

    // 로그인 버튼 클릭
    const loginBtn = await page.$('.btn_login, #log\\.login, button[type="submit"]')
    if (loginBtn) {
      await loginBtn.click()
    }

    // 로그인 결과 확인 (더 긴 대기)
    await delay(5000)

    const afterUrl = page.url()
    console.log('[BlogWriter] 로그인 후 URL:', afterUrl)

    // 로그인 성공 여부 확인
    if (afterUrl.includes('nid.naver.com') && (afterUrl.includes('nidlogin') || afterUrl.includes('login'))) {
      // 캡챠나 에러 메시지 확인
      const errorMsg = await page.$eval('.error_message, .err_common', el => el.textContent).catch(() => null)
      if (errorMsg) {
        return { success: false, message: `로그인 실패: ${errorMsg}` }
      }
      return { success: false, message: '로그인 실패. 아이디/비밀번호를 확인하거나 Chrome에서 직접 로그인해주세요.' }
    }

    // 2단계 인증 체크
    if (afterUrl.includes('challenge') || afterUrl.includes('protect')) {
      return { success: false, message: '2단계 인증이 필요합니다. Chrome에서 직접 인증을 완료해주세요.' }
    }

    // 새 기기 등록 체크
    if (afterUrl.includes('new_device') || afterUrl.includes('device')) {
      return { success: false, message: '새 기기 등록이 필요합니다. Chrome에서 직접 등록을 완료해주세요.' }
    }

    isLoggedIn = true
    console.log('[BlogWriter] 네이버 로그인 성공')
    return { success: true, message: '네이버 로그인 성공!' }
  } catch (error: any) {
    console.error('[BlogWriter] 로그인 실패:', error.message)
    return { success: false, message: `로그인 실패: ${error.message}` }
  }
}

// 블로그 글 작성
async function postToBlog(title: string, content: string, tags: string[]): Promise<{ success: boolean; message: string }> {
  if (!page) {
    return { success: false, message: 'Chrome에 먼저 연결해주세요.' }
  }

  try {
    // 블로그 글쓰기 페이지로 이동 (새 에디터 URL)
    console.log('[BlogWriter] 블로그 글쓰기 페이지로 이동...')
    await page.goto('https://blog.naver.com/GoBlogWrite.naver', { waitUntil: 'domcontentloaded' })
    await delay(3000)

    const currentUrl = page.url()
    console.log('[BlogWriter] 현재 URL:', currentUrl)

    // SmartEditor ONE (SE3) 또는 새 에디터 처리
    // 팝업 닫기 시도
    try {
      const closeButtons = await page.$$('button.btn_close, .layer_close, [class*="close"]')
      for (const btn of closeButtons) {
        try {
          await btn.click()
          await delay(300)
        } catch {}
      }
    } catch (e) {
      // 팝업 없으면 무시
    }

    await delay(1000)

    // iframe이 있는지 확인
    const mainFrame = await page.$('#mainFrame')
    const hasIframe = mainFrame !== null
    console.log('[BlogWriter] iframe 존재:', hasIframe)

    if (hasIframe) {
      // iframe 기반 에디터
      const frameHandle = await mainFrame.contentFrame()
      if (!frameHandle) {
        return { success: false, message: 'iframe에 접근할 수 없습니다.' }
      }

      // 에디터가 로드될 때까지 대기
      await delay(3000)

      // 제목 입력 - 다양한 셀렉터 시도
      console.log('[BlogWriter] 제목 입력 중... (iframe)')

      // 네이버 SE ONE 에디터 - 제목 영역 셀렉터
      const titleSelectors = [
        '.se-documentTitle-editView .se-text-paragraph',
        '.se-documentTitle-editView',
        '.se-title-text',
        '.se-component-content[contenteditable="true"]',
        '[data-placeholder="제목"]',
        '.se-section-documentTitle .se-text-paragraph span',
        '.se-module-title'
      ]

      let titleClicked = false
      for (const selector of titleSelectors) {
        try {
          const el = await frameHandle.$(selector)
          if (el) {
            console.log('[BlogWriter] 제목 셀렉터 발견:', selector)
            await el.click()
            await delay(500)
            titleClicked = true
            break
          }
        } catch (e) {
          continue
        }
      }

      if (!titleClicked) {
        // 제목 영역 좌표로 클릭 (상단 중앙)
        console.log('[BlogWriter] 제목 영역 좌표 클릭 시도...')
        await frameHandle.click('body', { offset: { x: 400, y: 80 } }).catch(() => {})
        await delay(500)
      }

      // 기존 내용 지우기 (혹시 있을 경우)
      await page.keyboard.down('Meta')
      await page.keyboard.press('a')
      await page.keyboard.up('Meta')
      await delay(100)

      // 사람처럼 자연스러운 속도로 제목 입력 (80-120ms 랜덤)
      console.log('[BlogWriter] 제목 타이핑:', title)
      for (const char of title) {
        await page.keyboard.type(char, { delay: 80 + Math.random() * 40 })
      }
      await delay(800)

      // 본문 영역으로 이동 - Tab 대신 본문 영역 직접 클릭
      console.log('[BlogWriter] 본문 영역으로 이동...')
      const contentSelectors = [
        '.se-component.se-text .se-text-paragraph',
        '.se-section:not(.se-section-documentTitle) .se-text-paragraph',
        '.se-content .se-text-paragraph',
        '.se-module-text .se-text-paragraph'
      ]

      let contentClicked = false
      for (const selector of contentSelectors) {
        try {
          const el = await frameHandle.$(selector)
          if (el) {
            console.log('[BlogWriter] 본문 셀렉터 발견:', selector)
            await el.click()
            await delay(500)
            contentClicked = true
            break
          }
        } catch (e) {
          continue
        }
      }

      if (!contentClicked) {
        // 본문 영역 좌표로 클릭 (중앙)
        console.log('[BlogWriter] 본문 영역 좌표 클릭...')
        await frameHandle.click('body', { offset: { x: 400, y: 300 } }).catch(() => {})
        await delay(500)
      }

      console.log('[BlogWriter] 본문 입력 중...')

      // 콘텐츠를 텍스트와 이미지로 파싱
      const contentParts = parseContentWithImages(content)
      console.log('[BlogWriter] 콘텐츠 파트 수:', contentParts.length)

      for (const part of contentParts) {
        if (part.type === 'text') {
          // 텍스트 입력 (사람처럼 자연스러운 속도)
          for (const char of part.content) {
            await page.keyboard.type(char, { delay: 50 + Math.random() * 50 })
          }
          await delay(500)
          // 다음 파트 전에 줄바꿈
          await page.keyboard.press('Enter')
          await page.keyboard.press('Enter')
          await delay(300)
        } else if (part.type === 'image') {
          // 이미지 삽입 - 클립보드 붙여넣기 방식
          console.log('[BlogWriter] 이미지 삽입 중 (클립보드 방식)...')
          try {
            const imageDataUrl = part.content
            const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')

            // 본문 영역 포커스
            for (const selector of contentSelectors) {
              try {
                const el = await frameHandle.$(selector)
                if (el) {
                  await el.click()
                  break
                }
              } catch { continue }
            }
            await delay(500)

            // JavaScript로 클립보드에 이미지 복사 후 붙여넣기 이벤트 발생
            const imageInserted = await frameHandle.evaluate(async (b64: string) => {
              try {
                // base64를 Blob으로 변환
                const byteCharacters = atob(b64)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: 'image/png' })

                // DataTransfer로 파일 추가
                const dataTransfer = new DataTransfer()
                const file = new File([blob], 'image.png', { type: 'image/png' })
                dataTransfer.items.add(file)

                // 에디터 영역 찾기
                const editableArea = document.querySelector('.se-text-paragraph, [contenteditable="true"], .se-component-content')
                if (editableArea) {
                  // paste 이벤트 발생
                  const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dataTransfer
                  })
                  editableArea.dispatchEvent(pasteEvent)
                  return 'paste'
                }
                return 'no-area'
              } catch (e: any) {
                return 'error:' + e.message
              }
            }, base64Data)

            console.log('[BlogWriter] 클립보드 붙여넣기 결과:', imageInserted)

            if (imageInserted === 'paste') {
              await delay(3000) // 네이버 서버 업로드 대기
              console.log('[BlogWriter] 이미지 붙여넣기 완료')
            } else {
              // 대안: 이미지 버튼 클릭 + 파일 업로드
              console.log('[BlogWriter] 붙여넣기 실패, 파일 업로드 시도...')

              // 이미지 버튼 찾기 (메인 페이지에서)
              const imageButton = await page.$('button[data-name="image"], .se-toolbar-button-image, [class*="ImageButton"]')
              if (imageButton) {
                await imageButton.click()
                await delay(1000)
              }

              // 파일 input 찾기
              const fileInputs = await page.$$('input[type="file"]')
              console.log('[BlogWriter] 찾은 파일 input 수:', fileInputs.length)

              for (const input of fileInputs) {
                try {
                  const accept = await input.evaluate(el => el.getAttribute('accept'))
                  if (accept && accept.includes('image')) {
                    const buffer = Buffer.from(base64Data, 'base64')
                    // Puppeteer의 uploadFile 사용 - 임시 파일 필요
                    const tmpPath = `/tmp/blog_image_${Date.now()}.png`
                    const fs = await import('fs/promises')
                    await fs.writeFile(tmpPath, buffer)
                    await input.uploadFile(tmpPath)
                    await fs.unlink(tmpPath).catch(() => {})
                    console.log('[BlogWriter] 파일 input으로 업로드 시도')
                    await delay(3000)
                    break
                  }
                } catch { continue }
              }
            }

            // 이미지 후 줄바꿈
            await page.keyboard.press('Enter')
            await page.keyboard.press('Enter')
            await delay(500)
          } catch (imgError: any) {
            console.log('[BlogWriter] 이미지 삽입 실패:', imgError.message)
            await page.keyboard.press('Enter')
          }
        }
      }

      await delay(1000)

      // 발행 버튼 클릭
      console.log('[BlogWriter] 발행 버튼 클릭...')
      const publishSelectors = [
        'button.se-publish-btn',
        '.btn_publish',
        '.publish_btn',
        '[class*="PublishBtn"]'
      ]

      // 먼저 iframe 내부에서 찾기
      for (const selector of publishSelectors) {
        try {
          const btn = await frameHandle.$(selector)
          if (btn) {
            console.log('[BlogWriter] 발행 버튼 발견 (iframe):', selector)
            await btn.click()
            break
          }
        } catch (e) {
          continue
        }
      }

      // 메인 페이지에서도 찾기
      for (const selector of publishSelectors) {
        try {
          const btn = await page.$(selector)
          if (btn) {
            console.log('[BlogWriter] 발행 버튼 발견 (메인):', selector)
            await btn.click()
            break
          }
        } catch (e) {
          continue
        }
      }

      // 텍스트로 찾기
      const publishByText = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return buttons.find(b => b.textContent?.includes('발행'))
      })
      if (publishByText) {
        await (publishByText as any).click?.().catch(() => {})
      }

    } else {
      // 새 에디터 (iframe 없음)
      console.log('[BlogWriter] 새 에디터 감지')

      // 제목 입력
      console.log('[BlogWriter] 제목 입력 중... (새 에디터)')
      const titleInput = await page.$('.se-title-input, [data-placeholder*="제목"], .title_area textarea, input[placeholder*="제목"]')
      if (titleInput) {
        await titleInput.click()
      }

      // 사람처럼 자연스러운 속도로 제목 입력
      for (const char of title) {
        await page.keyboard.type(char, { delay: 80 + Math.random() * 40 })
      }

      await delay(800)

      // 본문 영역 클릭 및 입력
      console.log('[BlogWriter] 본문 입력 중...')
      const contentArea = await page.$('.se-content, [contenteditable="true"], .se-text-paragraph')
      if (contentArea) {
        await contentArea.click()
      }
      await delay(500)

      // 콘텐츠를 텍스트와 이미지로 파싱
      const contentParts = parseContentWithImages(content)
      for (const part of contentParts) {
        if (part.type === 'text') {
          for (const char of part.content) {
            await page.keyboard.type(char, { delay: 50 + Math.random() * 50 })
          }
          await page.keyboard.press('Enter')
          await page.keyboard.press('Enter')
          await delay(300)
        } else if (part.type === 'image') {
          // 이미지 삽입 - 새 에디터
          console.log('[BlogWriter] 이미지 삽입 중 (새 에디터)...')
          try {
            // 이미지 버튼 찾기
            const imageButtonSelectors = [
              'button[data-name="image"]',
              '.se-image-button',
              'button.se-toolbar-button-image',
              '[class*="ImageButton"]',
              'button[aria-label*="사진"]'
            ]

            let imageButtonClicked = false
            for (const selector of imageButtonSelectors) {
              try {
                const btn = await page.$(selector)
                if (btn) {
                  await btn.click()
                  imageButtonClicked = true
                  console.log('[BlogWriter] 이미지 버튼 클릭 (새 에디터):', selector)
                  break
                }
              } catch { continue }
            }

            if (imageButtonClicked) {
              await delay(1000)

              // 파일 input 찾기
              const fileInput = await page.$('input[type="file"][accept*="image"]')
              if (fileInput) {
                const base64Data = part.content.replace(/^data:image\/\w+;base64,/, '')
                const buffer = Buffer.from(base64Data, 'base64')
                const tmpPath = `/tmp/blog_image_${Date.now()}.png`
                const fs = await import('fs/promises')
                await fs.writeFile(tmpPath, buffer)
                await fileInput.uploadFile(tmpPath)
                await fs.unlink(tmpPath).catch(() => {})

                console.log('[BlogWriter] 이미지 업로드 완료 (새 에디터)')
                await delay(2000)

                // 확인 버튼 클릭
                const confirmBtns = await page.$$('button')
                for (const btn of confirmBtns) {
                  const text = await btn.evaluate(el => el.textContent)
                  if (text && (text.includes('확인') || text.includes('완료') || text.includes('삽입'))) {
                    await btn.click()
                    await delay(1000)
                    break
                  }
                }
              }
            }

            await page.keyboard.press('Enter')
            await page.keyboard.press('Enter')
          } catch (imgError: any) {
            console.log('[BlogWriter] 이미지 삽입 실패 (새 에디터):', imgError.message)
            await page.keyboard.press('Enter')
          }
        }
      }

      await delay(1000)

      // 발행 버튼 클릭
      console.log('[BlogWriter] 발행 버튼 클릭...')
      const publishButton = await page.$('button.publish_btn, [class*="publish"]')
      if (publishButton) {
        await publishButton.click()
      } else {
        // 텍스트로 찾기
        const buttons = await page.$$('button')
        for (const btn of buttons) {
          const text = await btn.evaluate(el => el.textContent)
          if (text && text.includes('발행')) {
            await btn.click()
            break
          }
        }
      }
    }

    await delay(3000)

    // 발행 확인 팝업 처리
    try {
      const buttons = await page.$$('button')
      for (const btn of buttons) {
        const text = await btn.evaluate(el => el.textContent)
        if (text && (text.includes('확인') || text.includes('발행'))) {
          await btn.click()
          await delay(2000)
          break
        }
      }
    } catch (e) {
      console.log('[BlogWriter] 발행 확인 팝업 없음')
    }

    console.log('[BlogWriter] 포스팅 완료!')
    return { success: true, message: '블로그 글이 발행되었습니다!' }
  } catch (error: any) {
    console.error('[BlogWriter] 포스팅 실패:', error.message)
    return { success: false, message: `포스팅 실패: ${error.message}` }
  }
}

// 상태 확인
function getStatus(): { connected: boolean; loggedIn: boolean } {
  return {
    connected: browser !== null && page !== null,
    loggedIn: isLoggedIn
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: PostNaverRequest = await request.json()
    const { action, credentials, post } = body

    console.log('[BlogWriter] Action:', action)

    switch (action) {
      case 'connect':
        const connectResult = await connectToChrome()
        return NextResponse.json(connectResult)

      case 'login':
        if (!credentials?.username || !credentials?.password) {
          return NextResponse.json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' })
        }
        const loginResult = await loginNaver(credentials.username, credentials.password)
        return NextResponse.json(loginResult)

      case 'post':
        if (!post?.title || !post?.content) {
          return NextResponse.json({ success: false, message: '제목과 내용이 필요합니다.' })
        }
        const postResult = await postToBlog(post.title, post.content, post.tags || [])
        return NextResponse.json(postResult)

      case 'status':
        return NextResponse.json({ success: true, ...getStatus() })

      case 'checkLogin':
        // 네이버 로그인 상태 확인
        if (!page) {
          return NextResponse.json({ success: false, loggedIn: false, message: 'Chrome에 먼저 연결해주세요.' })
        }
        try {
          // 네이버 로그인 페이지로 가서 상태 확인
          await page.goto('https://nid.naver.com/nidlogin.login', { timeout: 5000 })
          await delay(1500)

          const currentUrl = page.url()
          console.log('[BlogWriter] 로그인 확인 URL:', currentUrl)

          // 로그인 페이지에서 리다이렉트되면 이미 로그인됨
          if (!currentUrl.includes('nidlogin.login') && !currentUrl.includes('nidlogin')) {
            isLoggedIn = true
            return NextResponse.json({ success: true, loggedIn: true, message: '이미 로그인되어 있습니다.' })
          }

          // 로그인 폼이 있으면 미로그인
          const loginForm = await page.$('#id, input[name="id"], .input_id')
          const hasLoginForm = loginForm !== null
          console.log('[BlogWriter] 로그인 폼 존재:', hasLoginForm)

          if (hasLoginForm) {
            return NextResponse.json({ success: true, loggedIn: false, message: '로그인이 필요합니다.' })
          }

          // 불확실한 경우 미로그인으로 처리
          return NextResponse.json({ success: true, loggedIn: false, message: '로그인이 필요합니다.' })
        } catch (error: any) {
          console.error('[BlogWriter] 로그인 상태 확인 실패:', error.message)
          return NextResponse.json({ success: false, loggedIn: false, message: '로그인 상태 확인 실패' })
        }

      default:
        return NextResponse.json({ success: false, message: '알 수 없는 action입니다.' })
    }
  } catch (error: any) {
    console.error('[BlogWriter] API Error:', error)
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
