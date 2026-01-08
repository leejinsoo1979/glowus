const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: process.cwd() + '/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // 가장 최근 DIPS 사업계획서 확인
  const { data, error } = await supabase
    .from('business_plans')
    .select('id, title, sections')
    .eq('id', '7ca9a1cb-bd92-41c5-b629-0be5e7ef593b')
    .single()

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('Title:', data.title)
  console.log('\nSections with content:')

  const sections = data.sections || {}
  for (const key of Object.keys(sections).sort()) {
    const s = sections[key]
    const hasContent = s.content && s.content.length > 0
    console.log(key + ': ' + s.title + ' - ' + (hasContent ? s.content.substring(0, 50) + '...' : '(빈 섹션)'))
  }
}

main()
