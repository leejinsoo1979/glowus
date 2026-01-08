// API를 통한 파이프라인 테스트
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const BASE_URL = 'http://localhost:3000'
const PROGRAM_ID = 'e63413fa-11cc-4b1b-8dae-e4c73bdb1a9c'

async function testPipeline() {
  console.log('=== 파이프라인 API 테스트 ===\n')

  // 1. 사업계획서 생성
  console.log('1. 사업계획서 생성 요청...')
  const createRes = await fetch(`${BASE_URL}/api/business-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'DIPS 창업기업 사업계획서 (API 테스트)',
      program_id: PROGRAM_ID
    })
  })

  if (!createRes.ok) {
    console.error('   생성 실패:', await createRes.text())
    return
  }

  const createData = await createRes.json()
  const plan = createData.plan || createData.data || createData
  if (!plan?.id) {
    console.error('   Plan ID를 찾을 수 없음:', JSON.stringify(createData))
    return
  }
  console.log('   ✅ 생성 완료 - Plan ID:', plan.id)

  // 2. 파이프라인 시작
  console.log('\n2. 파이프라인 시작...')
  const pipelineRes = await fetch(`${BASE_URL}/api/business-plans/${plan.id}/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'async',
      stages: [1, 2, 3, 4, 5, 6, 7, 8]  // 전체 파이프라인 실행
    })
  })

  if (!pipelineRes.ok) {
    console.error('   파이프라인 시작 실패:', await pipelineRes.text())
    return
  }

  const pipelineData = await pipelineRes.json()
  console.log('   ✅ Job ID:', pipelineData.job_id)
  console.log('   Stream URL:', pipelineData.stream_url)

  // 3. 진행 상황 모니터링
  console.log('\n3. 진행 상황 모니터링 (최대 2분)...\n')

  const completedStages = new Set<number>()

  for (let i = 0; i < 120; i++) {
    try {
      const statusRes = await fetch(`${BASE_URL}/api/business-plans/${plan.id}/pipeline`)
      if (!statusRes.ok) {
        await new Promise(r => setTimeout(r, 1000))
        continue
      }

      const status = await statusRes.json()

      // 각 스테이지 상태 출력
      if (status.stages) {
        for (const stage of status.stages) {
          if (stage.status === 'completed' && !completedStages.has(stage.stage)) {
            const msg = stage.message || ''
            console.log('   Stage ' + stage.stage + ': ✅ ' + msg)
            completedStages.add(stage.stage)
          } else if (stage.status === 'running') {
            const msg = stage.message || ''
            process.stdout.write('\r   Stage ' + stage.stage + ': 🔄 ' + msg + ' (' + stage.progress + '%)       ')
          }
        }
      }

      // 완료 확인
      if (status.status === 'completed' || completedStages.has(8)) {
        console.log('\n\n   ✅ 파이프라인 완료!')
        break
      }

      // 실패 확인
      if (status.status === 'failed') {
        console.log('\n\n   ❌ 파이프라인 실패:', status.error)
        break
      }
    } catch (e) {
      // 무시
    }

    await new Promise(r => setTimeout(r, 1000))
  }

  // 4. 최종 결과 확인
  console.log('\n4. 최종 결과 확인...')
  const finalRes = await fetch(`${BASE_URL}/api/business-plans/${plan.id}`)
  if (finalRes.ok) {
    const finalData = await finalRes.json()
    const docUrl = finalData.data?.document_url
    console.log('   문서 URL:', docUrl || '없음')

    if (docUrl) {
      // 문서 다운로드 테스트
      console.log('\n5. 문서 다운로드 테스트...')
      const docRes = await fetch(docUrl)
      if (docRes.ok) {
        const blob = await docRes.blob()
        console.log('   ✅ 문서 다운로드 성공:', blob.size, 'bytes')
      } else {
        console.log('   ❌ 문서 다운로드 실패:', docRes.status)
      }
    }
  }

  console.log('\n=== 테스트 완료 ===')
}

testPipeline().catch(console.error)
