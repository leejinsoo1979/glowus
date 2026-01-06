const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CATEGORIES = {
  development: '11111111-1111-1111-1111-111111111111',
  document: '22222222-2222-2222-2222-222222222222',
  design: '33333333-3333-3333-3333-333333333333',
  business: '44444444-4444-4444-4444-444444444444',
};

function detectCategory(name) {
  const text = name.toLowerCase();
  if (/html|css|javascript|js|앱|app|웹|web|코드|code|프로그램|계산기|게임|카운터|메모장|todo|할일|퍼즐/.test(text)) {
    return CATEGORIES.development;
  }
  if (/문서|document|보고서|report|기획|plan|매뉴얼|manual|가이드|guide/.test(text)) {
    return CATEGORIES.document;
  }
  if (/디자인|design|ui|ux|로고|logo|아이콘|icon|이미지|image/.test(text)) {
    return CATEGORIES.design;
  }
  return CATEGORIES.business;
}

async function fix() {
  // Amy 프로젝트 가져오기
  const { data: links } = await supabase
    .from('project_agents')
    .select('project_id')
    .eq('agent_id', '4f873fbe-eba2-4d2d-bc7f-3a04f8f4361d');

  const projectIds = links?.map(l => l.project_id) || [];
  
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, category_id')
    .in('id', projectIds);

  console.log('=== Amy 프로젝트 카테고리 업데이트 ===');
  
  for (const p of projects || []) {
    if (!p.category_id) {
      const newCategory = detectCategory(p.name);
      const catName = Object.entries(CATEGORIES).find(([,v]) => v === newCategory)?.[0];
      
      const { error } = await supabase
        .from('projects')
        .update({ category_id: newCategory })
        .eq('id', p.id);
      
      if (error) {
        console.log('❌ ' + p.name + ': 실패 - ' + error.message);
      } else {
        console.log('✅ ' + p.name + ' → ' + catName);
      }
    } else {
      console.log('⏭️ ' + p.name + ' (이미 설정됨)');
    }
  }
}

fix();
