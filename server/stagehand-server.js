/**
 * Stagehand Browser Automation Server
 *
 * 독립 실행 서버로 Next.js 핫 리로딩 충돌을 방지합니다.
 * 포트: 45679
 */

const http = require('http')
const path = require('path')
const fs = require('fs')

// Load .env.local manually (since dotenv might not be installed)
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    content.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
      }
    })
    console.log('[Stagehand Server] Loaded .env.local')
  }
}
loadEnvFile()

let Stagehand = null
let stagehandInstance = null
let isInitializing = false

const PORT = 45679

/**
 * Dynamic import Stagehand
 */
async function getStagehand() {
  if (!Stagehand) {
    const module = await import('@browserbasehq/stagehand')
    Stagehand = module.Stagehand || module.default
    console.log('[Stagehand Server] Loaded Stagehand class')
  }
  return Stagehand
}

/**
 * Initialize Stagehand instance
 */
async function initStagehand(config = {}) {
  if (stagehandInstance) {
    return stagehandInstance
  }

  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (stagehandInstance) return stagehandInstance
  }

  isInitializing = true

  try {
    console.log('[Stagehand Server] Initializing...')
    const StagehandClass = await getStagehand()

    stagehandInstance = new StagehandClass({
      env: 'LOCAL',
      enableCaching: true,
      headless: false,  // 🔥 실제 브라우저 창 표시
      verbose: config.verbose ?? 1,
      modelName: config.model || 'gpt-4o',
      modelClientOptions: {
        apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
      },
      localBrowserLaunchOptions: {
        headless: false,  // 🔥 실제 브라우저 창 표시
        viewport: { width: 1280, height: 800 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          // 🔥 봇 탐지 우회 옵션
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--window-size=1280,800',
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      },
    })

    await stagehandInstance.init()
    console.log('[Stagehand Server] ✅ Initialized successfully')

    // 🛡️ 초기 페이지에 스텔스 스크립트 적용
    try {
      const page = stagehandInstance.context.pages()[0]
      if (page) {
        await applyStealthScripts(page)
      }
    } catch (e) {
      // 무시
    }

    return stagehandInstance
  } catch (error) {
    console.error('[Stagehand Server] ❌ Initialization failed:', error)
    stagehandInstance = null
    throw error
  } finally {
    isInitializing = false
  }
}

/**
 * Close Stagehand instance
 */
async function closeStagehand() {
  if (stagehandInstance) {
    await stagehandInstance.close()
    stagehandInstance = null
    console.log('[Stagehand Server] Closed')
  }
}

/**
 * 🔥 봇 탐지 우회 스크립트 실행 (쿠팡/야놀자 등 대응)
 */
async function applyStealthScripts(page) {
  try {
    await page.evaluate(() => {
      // 1. webdriver 속성 제거 (가장 중요)
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      })

      // Playwright/Puppeteer 속성 제거
      delete navigator.__proto__.webdriver

      // 2. chrome 객체 위장 (더 완벽하게)
      window.chrome = {
        runtime: {
          PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
          PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
          RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
          OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
          OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
          connect: function() {},
          sendMessage: function() {},
        },
        loadTimes: function() { return {} },
        csi: function() { return {} },
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
        }
      }

      // 3. permissions 위장
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters)

      // 4. plugins 위장 (실제 Chrome처럼)
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
          ]
          plugins.item = function(index) { return this[index] || null }
          plugins.namedItem = function(name) { return this.find(p => p.name === name) || null }
          plugins.refresh = function() {}
          return plugins
        },
        configurable: true
      })

      // 5. languages 위장
      Object.defineProperty(navigator, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en'],
        configurable: true
      })

      // 6. platform 위장
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel',
        configurable: true
      })

      // 7. hardwareConcurrency 위장 (실제 CPU 코어처럼)
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
        configurable: true
      })

      // 8. deviceMemory 위장
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
        configurable: true
      })

      // 9. maxTouchPoints 위장 (데스크탑)
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
        configurable: true
      })

      // 10. WebGL Vendor/Renderer 위장
      const getParameter = WebGLRenderingContext.prototype.getParameter
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.'
        if (parameter === 37446) return 'Intel Iris OpenGL Engine'
        return getParameter.call(this, parameter)
      }

      // 11. Canvas fingerprint 랜덤화
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL
      HTMLCanvasElement.prototype.toDataURL = function(type) {
        if (type === 'image/png' && this.width === 16 && this.height === 16) {
          // 작은 fingerprint 캔버스인 경우 약간의 노이즈 추가
          const context = this.getContext('2d')
          if (context) {
            const imageData = context.getImageData(0, 0, this.width, this.height)
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] = imageData.data[i] ^ (Math.random() > 0.99 ? 1 : 0)
            }
            context.putImageData(imageData, 0, 0)
          }
        }
        return originalToDataURL.apply(this, arguments)
      }

      // 12. Automation 관련 속성 제거
      const automationProps = [
        '_Selenium_IDE_Recorder',
        '_selenium',
        'callSelenium',
        '__webdriver_script_fn',
        '__driver_evaluate',
        '__webdriver_evaluate',
        '__selenium_evaluate',
        '__fxdriver_evaluate',
        '__driver_unwrapped',
        '__webdriver_unwrapped',
        '__selenium_unwrapped',
        '__fxdriver_unwrapped',
        '__webdriver_script_func',
        'document.$cdc_asdjflasutopfhvcZLmcfl_',
        'document.documentElement.getAttribute("webdriver")',
      ]
      automationProps.forEach(prop => {
        try {
          if (prop.includes('.')) {
            const parts = prop.split('.')
            let obj = window
            for (let i = 0; i < parts.length - 1; i++) {
              obj = obj[parts[i]]
            }
            if (obj) delete obj[parts[parts.length - 1]]
          } else {
            delete window[prop]
          }
        } catch (e) {}
      })

      console.log('[Stealth] All anti-detection measures applied')
    })
    console.log('[Stagehand Server] 🛡️ Stealth scripts applied')
  } catch (e) {
    console.log('[Stagehand Server] Stealth script warning:', e.message)
    // 무시 - 일부 페이지에서 실패할 수 있음
  }
}

/**
 * Handle API requests
 */
async function handleRequest(action, params) {
  switch (action) {
    case 'navigate': {
      const stagehand = await initStagehand()
      const page = stagehand.context.pages()[0]
      await page.goto(params.url, { waitUntil: 'domcontentloaded' })
      await applyStealthScripts(page)  // 🛡️ 봇 탐지 우회
      return {
        success: true,
        url: page.url(),
        title: await page.title(),
      }
    }

    case 'act': {
      const stagehand = await initStagehand()
      console.log('[Stagehand Server] Act:', params.instruction)
      await stagehand.act(params.instruction)

      const page = stagehand.context.pages()[0]
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 })

      return {
        success: true,
        message: `완료: ${params.instruction}`,
        screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      }
    }

    case 'extract': {
      const stagehand = await initStagehand()
      console.log('[Stagehand Server] Extract:', params.instruction)

      const data = await stagehand.extract(params.instruction)
      const page = stagehand.context.pages()[0]
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 })

      return {
        success: true,
        data,
        screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      }
    }

    case 'observe': {
      const stagehand = await initStagehand()
      console.log('[Stagehand Server] Observe:', params.instruction)
      const elements = await stagehand.observe(params.instruction)

      return {
        success: true,
        elements: elements.map(el => ({
          description: el.description,
          selector: el.selector,
          action: el.action,
        })),
      }
    }

    case 'agent': {
      const stagehand = await initStagehand()
      console.log('[Stagehand Server] Agent task:', params.task)

      const page = stagehand.context.pages()[0]

      // Enhanced agent: navigate → multi-step act → extract
      const steps = []
      let result = ''

      // Site detection map
      const siteMap = {
        '쿠팡|coupang': 'https://www.coupang.com',
        '네이버|naver': 'https://www.naver.com',
        '구글|google': 'https://www.google.com',
        '야놀자|yanolja': 'https://www.yanolja.com',
        '11번가|11st': 'https://www.11st.co.kr',
        'g마켓|gmarket': 'https://www.gmarket.co.kr',
        '옥션|auction': 'https://www.auction.co.kr',
        '무신사|musinsa': 'https://www.musinsa.com',
        '올리브영|oliveyoung': 'https://www.oliveyoung.co.kr',
        '배민|배달의민족|baemin': 'https://www.baemin.com',
        '여기어때|yeogi': 'https://www.yeogi.com',
        '인터파크|interpark': 'https://www.interpark.com',
        '티몬|tmon': 'https://www.tmon.co.kr',
        '위메프|wemakeprice': 'https://www.wemakeprice.com',
        '아마존|amazon': 'https://www.amazon.com',
        '이베이|ebay': 'https://www.ebay.com',
      }

      try {
        // 1. Check current page - if already on a shopping site, stay there
        const currentUrl = page.url()
        const shoppingDomains = ['coupang.com', '11st.co.kr', 'gmarket.co.kr', 'auction.co.kr', 'naver.com', 'musinsa.com', 'oliveyoung.co.kr', 'amazon.com', 'ebay.com']
        const isOnShoppingSite = shoppingDomains.some(d => currentUrl.includes(d))

        let navigated = false

        // If already on shopping site and no explicit site mentioned, stay there
        if (isOnShoppingSite) {
          const explicitSiteMentioned = Object.keys(siteMap).some(pattern =>
            new RegExp(pattern, 'i').test(params.task)
          )
          if (!explicitSiteMentioned) {
            console.log('[Stagehand Server] Already on shopping site, staying:', currentUrl)
            steps.push({ action: 'stay', result: `Staying on: ${currentUrl}` })
            navigated = true
          }
        }

        // Navigate if explicit URL or site mentioned
        if (!navigated) {
          const urlMatch = params.task.match(/https?:\/\/[^\s]+/)
          if (urlMatch) {
            await page.goto(urlMatch[0], { waitUntil: 'domcontentloaded' })
            await applyStealthScripts(page)  // 🛡️ 봇 탐지 우회
            steps.push({ action: 'navigate', result: urlMatch[0] })
            navigated = true
          } else {
            for (const [pattern, url] of Object.entries(siteMap)) {
              if (new RegExp(pattern, 'i').test(params.task)) {
                await page.goto(url, { waitUntil: 'domcontentloaded' })
                await applyStealthScripts(page)  // 🛡️ 봇 탐지 우회
                steps.push({ action: 'navigate', result: url })
                navigated = true
                break
              }
            }
          }
        }

        if (!navigated) {
          // Default to Coupang if no site specified (most common shopping)
          await page.goto('https://www.coupang.com', { waitUntil: 'domcontentloaded' })
          await applyStealthScripts(page)  // 🛡️ 봇 탐지 우회
          steps.push({ action: 'navigate', result: 'https://www.coupang.com (default)' })
        }

        // 2. Wait for page to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000))

        // 3. Execute multi-step actions based on task keywords
        const taskLower = params.task.toLowerCase()

        // Helper: Safe act with retry
        const safeAct = async (instruction, retries = 2) => {
          for (let i = 0; i < retries; i++) {
            try {
              await stagehand.act(instruction)
              return true
            } catch (e) {
              console.log(`[Stagehand Server] Act attempt ${i + 1} failed: ${e.message}`)
              if (i === retries - 1) return false
              await new Promise(r => setTimeout(r, 1000))
            }
          }
          return false
        }

        // Extract search keyword from task
        const extractKeyword = (task) => {
          // 명확한 따옴표 패턴 우선: '아이폰 케이스' or "아이폰 케이스"
          let match = task.match(/['"]([^'"]+)['"]/)
          if (match) return match[1]

          // Stop words - 사이트명, 동사, 조사 등
          const stopWords = [
            '에서', '하고', '해줘', '해주세요', '장바구니', '검색', '클릭', '상품', '첫번째', '담아', '찾아',
            '줘', '좀', '에', '를', '을', '이', '가', '의', '로', '으로', '도', '만',
            '쿠팡', '네이버', '구글', '11번가', '지마켓', '옥션', '무신사', '올리브영',
            '사이트', '접속', '이동', '가서', '열어', '들어가', '방문',
            '입력', '버튼', '페이지', '결과', '메인', '홈',
            '확인', '알려', '보여', '인기', '몇개', '몇',
          ]

          // "X 검색해줘" or "X 찾아줘" 패턴
          match = task.match(/([가-힣a-zA-Z0-9\s]+?)(?:\s*(?:검색|찾아|찾기|검색해줘|검색하고))/)
          if (match) {
            // stopWords 제거 후 남는 단어들
            const words = match[1].split(/\s+/).filter(w =>
              w.length > 1 && !stopWords.some(sw => w === sw || w.includes(sw))
            )
            if (words.length > 0) return words.join(' ')
          }

          // 명사 패턴: 제품명 (아이폰, 갤럭시, 에어팟 등)
          const productPatterns = [
            /아이폰\s*\d*\s*(?:프로|맥스|미니|케이스|충전기)?/gi,
            /갤럭시\s*(?:S|A|Z|노트)?\s*\d*\s*(?:울트라|플러스|케이스)?/gi,
            /에어팟\s*(?:프로|맥스)?\s*\d*/gi,
            /맥북\s*(?:프로|에어)?\s*\d*/gi,
            /([가-힣]+(?:\s+[가-힣]+)*)\s*케이스/gi,
          ]

          for (const pattern of productPatterns) {
            match = task.match(pattern)
            if (match && match[0]) return match[0].trim()
          }

          // Fallback: 가장 긴 명사구 추출
          const words = task.split(/\s+/).filter(w =>
            w.length >= 2 &&
            !stopWords.some(sw => w === sw) &&
            !/^(하고|해서|해줘|담아|클릭|검색|이동|접속|열어|입력)/.test(w)
          )
          if (words.length > 0) {
            // 제품명 같은 단어 우선
            const productWord = words.find(w => /케이스|충전기|이어폰|폰|북|패드|워치/.test(w))
            if (productWord) {
              const idx = words.indexOf(productWord)
              return words.slice(Math.max(0, idx - 1), idx + 1).join(' ')
            }
            return words.slice(0, 2).join(' ')
          }

          return ''
        }

        const keyword = extractKeyword(params.task)
        console.log('[Stagehand Server] Task:', params.task)
        console.log('[Stagehand Server] Extracted keyword:', keyword)

        // Step A: Search if needed
        if (/검색|search|찾|find/.test(taskLower) && keyword) {
          console.log('[Stagehand Server] Performing search action for:', keyword)

          // 1단계: 검색창에 입력
          const fillSuccess = await safeAct(`Find the search input field and type "${keyword}"`)
          if (fillSuccess) {
            console.log('[Stagehand Server] Search input filled')
            await new Promise(resolve => setTimeout(resolve, 500))

            // 2단계: Enter 키 누르기 (검색 제출)
            try {
              await page.keyboard.press('Enter')
              console.log('[Stagehand Server] Enter key pressed')
              await new Promise(resolve => setTimeout(resolve, 4000))  // 검색 결과 로딩 대기
              await applyStealthScripts(page)  // 🛡️ 검색 결과 페이지에 스텔스 적용
              steps.push({ action: 'search', result: `Searched for: ${keyword}` })
            } catch (e) {
              console.log('[Stagehand Server] Enter failed, trying search button')
              const buttonSuccess = await safeAct('Click the search button')
              if (buttonSuccess) {
                await new Promise(resolve => setTimeout(resolve, 4000))
                await applyStealthScripts(page)
                steps.push({ action: 'search', result: `Searched for: ${keyword}` })
              } else {
                steps.push({ action: 'search', result: 'Search submit failed' })
              }
            }
          } else {
            steps.push({ action: 'search', result: 'Search failed, continuing...' })
          }
        }

        // Step B: Click product if needed
        if (/첫번째|first|클릭|click|선택|select/.test(taskLower)) {
          console.log('[Stagehand Server] Clicking first result')

          // 검색 결과에서 첫 번째 상품 클릭 (광고/프로모션 배너 제외)
          const clickSuccess = await safeAct(
            'In the search results grid, click on the FIRST actual product card that shows a product image, price, and title. ' +
            'Ignore any promotional banners, advertisements, or sponsored content at the top. ' +
            'Look for product listings with prices like "₩" or "원".'
          )

          if (clickSuccess) {
            await new Promise(resolve => setTimeout(resolve, 3000))
            await applyStealthScripts(page)  // 🛡️ 상품 페이지에 스텔스 적용
            steps.push({ action: 'click', result: 'Clicked first product' })
          } else {
            // 대안: 더 간단한 셀렉터 시도
            console.log('[Stagehand Server] Trying alternative click')
            const altSuccess = await safeAct('Click on the first item with a price tag in the product list')
            if (altSuccess) {
              await new Promise(resolve => setTimeout(resolve, 3000))
              await applyStealthScripts(page)
              steps.push({ action: 'click', result: 'Clicked product (alt)' })
            } else {
              steps.push({ action: 'click', result: 'Click failed' })
            }
          }
        }

        // Step C: Add to cart if needed
        if (/장바구니|cart|담|add|구매|buy/.test(taskLower)) {
          console.log('[Stagehand Server] Adding to cart')
          const cartSuccess = await safeAct('Click the "장바구니" or "Add to Cart" or "담기" button')
          if (cartSuccess) {
            steps.push({ action: 'cart', result: 'Added to cart' })
            await new Promise(resolve => setTimeout(resolve, 2000))
          } else {
            steps.push({ action: 'cart', result: 'Cart action failed' })
          }
        }

        // 4. Try to extract result, with fallback
        try {
          const extracted = await stagehand.extract({
            instruction: 'Extract the main content: product name, price, and any status message',
            schema: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                price: { type: 'string' },
                status: { type: 'string' }
              }
            }
          })
          result = typeof extracted === 'string' ? extracted : JSON.stringify(extracted, null, 2)
        } catch (extractError) {
          console.log('[Stagehand Server] Structured extract failed, using simple extract')
          result = await page.title() + ' - ' + page.url()
        }
        steps.push({ action: 'extract', result: result.substring(0, 500) })

      } catch (error) {
        console.error('[Stagehand Server] Agent error:', error.message)
        result = `작업 중 오류 발생: ${error.message}`
      }

      // 스크린샷은 토큰을 많이 사용하므로 기본 비활성화
      // 필요시 params.screenshot=true로 요청 가능
      let screenshot = null
      if (params.screenshot) {
        const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 50 })
        screenshot = `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`
      }

      // 결과 크기 제한 (토큰 오버플로우 방지)
      let limitedResult = result
      if (result && result.length > 2000) {
        limitedResult = result.substring(0, 2000) + '...'
      }

      return {
        success: true,
        result: limitedResult,
        steps: steps.slice(0, 5).map(s => ({ action: s.action, result: (s.result || '').substring(0, 100) })),
        currentUrl: page.url(),
        ...(screenshot && { screenshot }),
      }
    }

    case 'info': {
      const stagehand = await initStagehand()
      const page = stagehand.context.pages()[0]
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 })

      return {
        url: page.url(),
        title: await page.title(),
        screenshot: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      }
    }

    case 'close': {
      await closeStagehand()
      return { success: true, message: '브라우저가 종료되었습니다' }
    }

    case 'login': {
      // 수동 로그인을 위해 로그인 페이지로 이동
      const stagehand = await initStagehand()
      const page = stagehand.context.pages()[0]

      const loginUrls = {
        '쿠팡|coupang': 'https://login.coupang.com/login/login.pang',
        '네이버|naver': 'https://nid.naver.com/nidlogin.login',
        '11번가|11st': 'https://login.11st.co.kr/auth/front/login.tmall',
        '구글|google': 'https://accounts.google.com',
      }

      let navigated = false
      const site = params.site || params.task || ''

      for (const [pattern, url] of Object.entries(loginUrls)) {
        if (new RegExp(pattern, 'i').test(site)) {
          await page.goto(url, { waitUntil: 'domcontentloaded' })
          await applyStealthScripts(page)  // 🛡️ 봇 탐지 우회
          navigated = true
          break
        }
      }

      if (!navigated && params.url) {
        await page.goto(params.url, { waitUntil: 'domcontentloaded' })
        await applyStealthScripts(page)  // 🛡️ 봇 탐지 우회
      }

      return {
        success: true,
        message: '로그인 페이지로 이동했습니다. 브라우저에서 직접 로그인해주세요.',
        url: page.url(),
        hint: '로그인 완료 후 다시 작업을 요청하세요.'
      }
    }

    case 'check-login': {
      // 로그인 상태 확인
      const stagehand = await initStagehand()
      const page = stagehand.context.pages()[0]
      const cookies = await page.context().cookies()

      const hasSession = cookies.some(c =>
        c.name.includes('session') ||
        c.name.includes('token') ||
        c.name.includes('login')
      )

      return {
        success: true,
        loggedIn: hasSession,
        url: page.url(),
        cookieCount: cookies.length
      }
    }

    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // GET - status check
  if (req.method === 'GET') {
    try {
      if (stagehandInstance) {
        const page = stagehandInstance.context.pages()[0]
        res.writeHead(200)
        res.end(JSON.stringify({
          status: 'active',
          url: page.url(),
        }))
      } else {
        res.writeHead(200)
        res.end(JSON.stringify({
          status: 'inactive',
          message: 'Stagehand가 초기화되지 않았습니다',
        }))
      }
    } catch (error) {
      res.writeHead(200)
      res.end(JSON.stringify({
        status: 'error',
        message: error.message,
      }))
    }
    return
  }

  // DELETE - close
  if (req.method === 'DELETE') {
    await closeStagehand()
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, message: '브라우저가 종료되었습니다' }))
    return
  }

  // POST - actions
  if (req.method !== 'POST') {
    res.writeHead(405)
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', async () => {
    try {
      const data = JSON.parse(body)
      const { action, ...params } = data

      console.log('[Stagehand Server] Request:', action, params)

      const result = await handleRequest(action, params)
      res.writeHead(200)
      res.end(JSON.stringify(result))

    } catch (error) {
      console.error('[Stagehand Server] Error:', error.message)
      res.writeHead(500)
      res.end(JSON.stringify({ error: error.message }))
    }
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Stagehand Server] 🚀 Running on http://127.0.0.1:${PORT}`)
})

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('[Stagehand Server] Shutting down...')
  await closeStagehand()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('[Stagehand Server] Shutting down...')
  await closeStagehand()
  process.exit(0)
})
