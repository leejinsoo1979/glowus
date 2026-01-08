// 파이프라인 API 직접 테스트
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const BASE_URL = 'http://localhost:3000'

async function testPipelineAPI() {
  console.log('=== 파이프라인 API 테스트 ===\n')

  // 1. 새 사업계획서 생성
  console.log('1. 새 사업계획서 생성...')
  const createRes = await fetch(`${BASE_URL}/api/business-plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `API 테스트 사업계획서 ${new Date().toISOString()}`,
      program_id: 'cdf1f6ef-eb9b-4a85-9809-ffc48bbbb0db'  // 호서대학교 서울창업보육센터
    })
  })

  if (!createRes.ok) {
    const text = await createRes.text()
    console.error('   생성 실패:', text)
    return
  }

  const createData = await createRes.json()
  console.log('   응답:', JSON.stringify(createData).slice(0, 200))

  // 응답 형식에 따라 plan 추출
  const plan = createData.data || createData.plan || createData
  if (!plan?.id) {
    console.error('   플랜 ID를 찾을 수 없음:', createData)
    return
  }
  console.log(`   생성됨: ${plan.id}`)

  // 2. 파이프라인 시작
  console.log('\n2. 파이프라인 시작...')
  const startRes = await fetch(`${BASE_URL}/api/business-plans/${plan.id}/pipeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})  // 빈 객체라도 전송
  })

  if (!startRes.ok) {
    const text = await startRes.text()
    console.error('   파이프라인 시작 실패:', text)
    return
  }

  const startData = await startRes.json()
  console.log(`   Job 생성됨: ${startData.job_id}`)

  // 3. 진행 상황 폴링
  console.log('\n3. 진행 상황 모니터링 (30초)...')
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 5000))

    const statusRes = await fetch(`${BASE_URL}/api/business-plans/${plan.id}/pipeline`)
    if (statusRes.ok) {
      const statusData = await statusRes.json()
      const progress = statusData.overall_progress || 0
      const stage = statusData.current_stage || 0
      const status = statusData.pipeline_status

      console.log(`   [${i + 1}] 진행률: ${progress}%, 스테이지: ${stage}, 상태: ${status}`)

      // 스테이지별 상태 확인
      const stageStatuses = statusData.stages
        ?.filter((s: any) => s.stage >= 1 && s.stage <= 8)
        .map((s: any) => `S${s.stage}:${s.status === 'completed' ? '✅' : s.status === 'processing' ? '🔄' : s.status === 'failed' ? '❌' : '⏳'}`)
        .join(' ')

      if (stageStatuses) {
        console.log(`         ${stageStatuses}`)
      }

      // 에러 확인
      if (status === 'failed') {
        console.log('   ❌ 파이프라인 실패!')
        const failedStage = statusData.stages?.find((s: any) => s.status === 'failed')
        if (failedStage) {
          console.log(`   실패 스테이지: ${failedStage.stage} - ${failedStage.message}`)
        }
        break
      }

      // 완료 확인
      if (progress >= 100 || status === 'completed') {
        console.log('   ✅ 파이프라인 완료!')
        break
      }
    }
  }

  console.log('\n테스트 완료!')
}

testPipelineAPI().catch(console.error)
