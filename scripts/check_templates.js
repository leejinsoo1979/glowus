const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: process.cwd() + '/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const { data, error } = await supabase
    .from('business_plan_templates')
    .select('id, name, template_name, program_id, is_active, section_structure')
    .limit(10)

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('Templates found:', data?.length || 0)
  for (const t of data || []) {
    const sections = t.section_structure || []
    console.log(`\n[${t.name || t.template_name}]`)
    console.log(`  - program_id: ${t.program_id || 'none'}`)
    console.log(`  - active: ${t.is_active}`)
    console.log(`  - sections: ${sections.length}`)
    if (sections.length > 0) {
      sections.slice(0, 5).forEach(s => console.log(`    * ${s.key}: ${s.title}`))
      if (sections.length > 5) console.log(`    ... and ${sections.length - 5} more`)
    }
  }
}

main()
