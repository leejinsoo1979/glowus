
const https = require('https');

// Simplified fetch for node environment
async function fetch(url, options) {
    return new Promise((resolve, reject) => {
        https.get(url, options || {}, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    text: () => Promise.resolve(data)
                });
            });
        }).on('error', reject);
    });
}

// Exact copy of scrapeBizinfoDetail from lib/government/bizinfo.ts
async function scrapeBizinfoDetail(detailUrl) {
    if (!detailUrl || !detailUrl.includes('bizinfo.go.kr')) {
        return null
    }

    try {
        // URL에서 ID 추출 및 보정 (PBLN_0000000000103367 -> PBLN_000000000103367)
        // 16자리 숫자(총 길이 21)인 경우 0을 하나 제거하여 15자리(총 길이 20)로 보정
        let targetUrl = detailUrl
        try {
            const urlObj = new URL(detailUrl)
            const pblancId = urlObj.searchParams.get('pblancId')
            if (pblancId && pblancId.length === 21 && pblancId.startsWith('PBLN_0')) {
                const fixedId = pblancId.replace('PBLN_0', 'PBLN_')
                targetUrl = detailUrl.replace(pblancId, fixedId)
                console.log(`[Bizinfo] 잘못된 ID 포맷 감지. URL 보정: ${targetUrl}`)
            }
        } catch (e) {
            // URL 파싱 에러 무시
        }

        console.log('[Bizinfo] 상세페이지 크롤링:', targetUrl)

        let fetchResponse = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        })

        // 404 발생 시, ID 길이 문제(0이 하나 더 들어간 경우) 체크하여 재시도
        if (!fetchResponse.ok && fetchResponse.status === 404) {
            const urlObj = new URL(detailUrl)
            const pblancId = urlObj.searchParams.get('pblancId')

            // 잘못된 ID 패턴 (PBLN_ + 16자리 숫자) 감지 -> 15자리로 수정
            // 예: PBLN_0000000000103367 (오류) -> PBLN_000000000103367 (정상)
            if (pblancId && pblancId.length === 21 && pblancId.startsWith('PBLN_0')) {
                const fixedId = pblancId.replace('PBLN_0', 'PBLN_')
                const fixedUrl = detailUrl.replace(pblancId, fixedId)
                console.log(`[Bizinfo] ID 포맷 오류 감지. 수정된 URL로 재시도: ${fixedUrl}`)

                fetchResponse = await fetch(fixedUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                })

                // 수정된 URL이 성공했다면 로그
                if (fetchResponse.ok) {
                    console.log('[Bizinfo] ID 자동 수정 성공')
                }
            }
        }

        if (!fetchResponse.ok) {
            console.error('[Bizinfo] 상세페이지 로드 실패:', fetchResponse.status)
            return null
        }

        const html = await fetchResponse.text()

        // 헬퍼 함수
        const cleanHtml = (str) =>
            str.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, "")
                .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, "")
                .replace(/<!--[\s\S]*?-->/g, "")
                .trim()

        const result = {}

        // 1. 본문 추출 (Nested Div 처리)
        // 기업마당 상세페이지는 보통 .view_cont 클래스를 사용
        let contentMatch = html.match(/<div class="view_cont"[^>]*>([\s\S]*?)<\/div>\s*<!--\s*\/\/\s*view_cont\s*-->/i)

        // Nested logic copied manually or assumed simple regex for now since verify script needs full implementation
        // I will execute the simplified one first to check connection, but ideally I want the complex one.
        // Let's stick to the current implementation in file which uses the complex loop.

        // Redefining loop based extraction for this script:
        const viewContMarker = 'class="view_cont"'
        let startIndex = html.indexOf(viewContMarker)

        // board_view, bbs_view 등 대체 클래스 확인
        if (startIndex === -1) {
            startIndex = html.indexOf('class="board_view"')
        }
        if (startIndex === -1) {
            startIndex = html.indexOf('class="bbs_view"')
        }

        if (startIndex !== -1) {
            // <div class="view_cont">의 시작점(<div) 찾기
            const openingDivStart = html.lastIndexOf('<div', startIndex)

            if (openingDivStart !== -1) {
                let depth = 0
                let currentIndex = openingDivStart
                let foundEnd = false
                const maxLen = html.length

                // 태그 밸런싱으로 닫는 태그 찾기
                while (currentIndex < maxLen) {
                    const nextOpen = html.indexOf('<div', currentIndex + 1)
                    const nextClose = html.indexOf('</div>', currentIndex + 1)

                    if (nextClose === -1) break

                    if (nextOpen !== -1 && nextOpen < nextClose) {
                        depth++
                        currentIndex = nextOpen
                    } else {
                        if (depth === 0) {
                            // 최상위 div 닫힘
                            const contentRaw = html.substring(openingDivStart, nextClose + 6)
                            result.content = `<div class="bizinfo-original">${cleanHtml(contentRaw)}</div>`
                            foundEnd = true
                            break
                        } else {
                            depth--
                            currentIndex = nextClose
                        }
                    }
                }
            }
        } else {
            // Fallback: 정규식 시도 (매우 단순한 구조일 경우)
            let contentMatch = html.match(/<div class="view_cont"[^>]*>([\s\S]*?)<\/div>\s*<!--\s*\/\/\s*view_cont\s*-->/i)
            if (contentMatch) {
                result.content = `<div class="bizinfo-original">${cleanHtml(contentMatch[1])}</div>`
            }
        }

        // 2. 첨부파일 추출
        const attachments = []

        // 파일 영역 찾기
        const fileAreaMatch = html.match(/<div class="add_file"[^>]*>([\s\S]*?)<\/div>/i) ||
            html.match(/<ul class="file_list"[^>]*>([\s\S]*?)<\/ul>/i)

        if (fileAreaMatch) {
            const fileHtml = fileAreaMatch[1]
            // 링크 추출
            const linkRegex = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
            let match
            while ((match = linkRegex.exec(fileHtml)) !== null) {
                const href = match[1] // url
                let text = match[2].replace(/<[^>]+>/g, '').trim() // filename

                // view.do? ... &attachSeq=... 같은 형식일 수 있음
                if (href.includes('down.do') || href.includes('download')) {
                    const fullUrl = href.startsWith('http') ? href : `https://www.bizinfo.go.kr${href.startsWith('/') ? '' : '/'}${href}`
                    if (text) attachments.push({ name: text, url: fullUrl })
                }
            }
        }

        if (attachments.length > 0) {
            result.attachments = attachments
        }

        return result
    } catch (error) {
        console.error('[Bizinfo] 크롤링 오류:', error)
        return null
    }
}

// Test with the ID from screenshot
const badId = 'PBLN_000000000092578';
// Relative URL as seen in screenshot
const badUrl = `/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=${badId}`;

console.log('--- Testing with Relative URL from Screenshot ---');
// Modify scraper to handle relative URL locally for this script since we copied it before the fix
// ... Actually I need to update the scrapeBizinfoDetail function in this script to include the relative URL fix I just pushed to prod.

// Redefining the scraper wrapper to simulate the fix:
async function scrapeBizinfoDetail_Fixed(detailUrl) {
    if (!detailUrl) return null

    // FIX: Handle relative URL
    if (detailUrl.startsWith('/')) {
        detailUrl = `https://www.bizinfo.go.kr${detailUrl}`
    }

    if (!detailUrl.includes('bizinfo.go.kr')) {
        return null
    }

    return scrapeBizinfoDetail(detailUrl); // Call the original logic with absolute URL
}

scrapeBizinfoDetail_Fixed(badUrl).then(result => {
    console.log('Result:', result ? 'SUCCESS' : 'FAILURE');
    if (result) {
        console.log('Content Length:', result.content ? result.content.length : 0);
        console.log('Attachments:', result.attachments ? result.attachments.length : 0);
    }
});
