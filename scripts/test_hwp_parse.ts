/**
 * HWP 파싱 테스트 - 텍스트 추출
 */

async function testHwpParsing() {
  console.log('=== HWP 파싱 테스트 ===\n')

  const hwpUrl = 'https://www.k-startup.go.kr/afile/fileDownload/SqiLn'

  console.log('1. HWP 파일 다운로드...')
  const response = await fetch(hwpUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  console.log(`   다운로드 완료: ${buffer.length} bytes`)

  // HWP 파싱
  console.log('\n2. HWP 파싱...')
  const HWP = await import('hwp.js')
  const doc = HWP.parse(buffer, { type: 'buffer' } as any)
  console.log('   파싱 성공!')

  // CFB에서 PrvText 추출
  console.log('\n3. PrvText (미리보기 텍스트) 추출...')
  const cfb = await import('cfb')
  const container = cfb.read(buffer, { type: 'buffer' })

  // find 함수 사용
  const prvTextEntry = cfb.find(container, '/PrvText')
  if (prvTextEntry) {
    const decoder = new TextDecoder('utf-16le')
    const text = decoder.decode(prvTextEntry.content as any)
    console.log('   PrvText 추출 성공!')
    console.log(`   텍스트 길이: ${text.length}자`)
    console.log('\n---PrvText 내용---')
    console.log(text)
    console.log('---끝---')
  } else {
    console.log('   PrvText를 찾을 수 없음')
  }

  // 본문에서 직접 텍스트 추출
  console.log('\n4. 본문에서 텍스트 추출...')

  let fullText = ''

  if (doc.sections) {
    for (const section of doc.sections) {
      if (section.content) {
        for (const paragraph of section.content) {
          if (paragraph.content && Array.isArray(paragraph.content)) {
            for (const charInfo of paragraph.content) {
              // type 0 = 일반 문자, value = 문자 코드
              if (charInfo.type === 0 && typeof charInfo.value === 'number') {
                // 일반 ASCII/유니코드 문자
                if (charInfo.value >= 32 && charInfo.value < 0xFFFF) {
                  fullText += String.fromCharCode(charInfo.value)
                }
              } else if (charInfo.type === 2) {
                // 제어 문자 (2=줄바꿈 등)
                if (charInfo.value === 2) fullText += ' '  // 섹션 구분
                if (charInfo.value === 10 || charInfo.value === 13) fullText += '\n'
              }
            }
          }
          fullText += '\n'  // 문단 구분
        }
      }
    }
  }

  fullText = fullText.replace(/\n{3,}/g, '\n\n').trim()

  console.log(`   추출된 텍스트 길이: ${fullText.length}자`)
  console.log('\n---본문 텍스트---')
  console.log(fullText.substring(0, 5000))
  console.log('---끝---')
}

testHwpParsing()
