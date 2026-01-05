import { createAdminClient } from '../lib/supabase/admin'

async function resetBizinfoContent() {
    const supabase = createAdminClient()

    console.log('기업마당 프로그램의 content를 초기화하는 중...')

    const { data, error } = await supabase
        .from('government_programs')
        .update({ content: null })
        .eq('source', 'bizinfo')
        .select('id, title')

    if (error) {
        console.error('❌ 오류:', error)
        return
    }

    console.log(`✅ ${data?.length || 0}개의 기업마당 프로그램 content를 초기화했습니다.`)
    console.log('이제 상세 페이지를 열면 자동으로 크롤링이 시작됩니다.')

    if (data && data.length > 0) {
        console.log('\n초기화된 프로그램 목록:')
        data.forEach((p, i) => {
            console.log(`${i + 1}. ${p.title}`)
        })
    }
}

resetBizinfoContent().then(() => process.exit(0)).catch(err => {
    console.error(err)
    process.exit(1)
})
