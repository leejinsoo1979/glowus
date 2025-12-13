import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - 공공 API 프리셋 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    // 프리셋 조회
    let query = (supabase as any)
      .from('public_api_presets')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('name')

    if (category) {
      query = query.eq('category', category)
    }

    const { data: presets, error } = await query

    if (error) {
      // 테이블이 없으면 기본 프리셋 반환
      return NextResponse.json({ presets: getDefaultPresets(category) })
    }

    return NextResponse.json({ presets: presets || getDefaultPresets(category) })
  } catch (error) {
    console.error('Get public API presets error:', error)
    // 에러 시에도 기본 프리셋 반환
    return NextResponse.json({ presets: getDefaultPresets(null) })
  }
}

// 기본 프리셋 (DB가 없을 때 사용)
function getDefaultPresets(category: string | null) {
  const presets = [
    {
      id: 'data_go_kr',
      name: '공공데이터포털',
      description: '대한민국 정부 공공데이터 API',
      category: 'government',
      logo_url: null,
      base_url: 'https://apis.data.go.kr',
      auth_type: 'api_key',
      auth_config_template: { param_name: 'serviceKey', param_type: 'query' },
      endpoints: [
        {
          id: 'search',
          name: '데이터 검색',
          method: 'GET',
          path: '/search',
          description: '공공데이터 검색',
          parameters: [{ name: 'query', type: 'string', required: true }],
        },
      ],
      setup_guide: '1. 공공데이터포털 회원가입\n2. 원하는 API 활용신청\n3. 마이페이지에서 API 키 복사',
      api_key_url: 'https://www.data.go.kr/index.do',
      documentation_url: 'https://www.data.go.kr/',
    },
    {
      id: 'k_startup',
      name: 'K-Startup',
      description: '창업진흥원 스타트업 정보 API',
      category: 'startup',
      logo_url: null,
      base_url: 'https://www.k-startup.go.kr/api',
      auth_type: 'api_key',
      auth_config_template: { header_name: 'Authorization', prefix: 'Bearer ' },
      endpoints: [
        {
          id: 'startup_list',
          name: '스타트업 목록',
          method: 'GET',
          path: '/startups',
          description: '등록된 스타트업 목록 조회',
        },
        {
          id: 'support_programs',
          name: '지원사업 목록',
          method: 'GET',
          path: '/programs',
          description: '정부 지원사업 목록 조회',
        },
      ],
      setup_guide: '1. K-Startup 회원가입\n2. API 서비스 신청\n3. 승인 후 API 키 발급',
      api_key_url: 'https://www.k-startup.go.kr',
      documentation_url: 'https://www.k-startup.go.kr',
    },
    {
      id: 'gov24',
      name: '정부24',
      description: '정부24 민원 및 행정정보 API',
      category: 'government',
      logo_url: null,
      base_url: 'https://api.gov24.go.kr',
      auth_type: 'api_key',
      auth_config_template: { header_name: 'X-API-Key' },
      endpoints: [
        {
          id: 'services',
          name: '민원서비스 조회',
          method: 'GET',
          path: '/services',
          description: '민원서비스 목록 조회',
        },
      ],
      setup_guide: '1. 정부24 회원가입\n2. 오픈API 신청\n3. 승인 후 인증키 발급',
      api_key_url: 'https://www.gov.kr/portal/openApi',
      documentation_url: 'https://www.gov.kr/portal/openApi/apiInfo',
    },
    {
      id: 'kma_weather',
      name: '기상청 날씨',
      description: '기상청 날씨 정보 API',
      category: 'weather',
      logo_url: null,
      base_url: 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0',
      auth_type: 'api_key',
      auth_config_template: { param_name: 'serviceKey', param_type: 'query' },
      endpoints: [
        {
          id: 'forecast',
          name: '단기예보',
          method: 'GET',
          path: '/getVilageFcst',
          description: '단기 날씨 예보 조회',
          parameters: [
            { name: 'base_date', type: 'string', required: true },
            { name: 'base_time', type: 'string', required: true },
            { name: 'nx', type: 'number', required: true },
            { name: 'ny', type: 'number', required: true },
          ],
        },
      ],
      setup_guide: '1. 공공데이터포털에서 기상청 API 신청\n2. 활용신청 승인 대기\n3. API 키 발급',
      api_key_url: 'https://www.data.go.kr/data/15084084/openapi.do',
      documentation_url: 'https://www.data.go.kr/data/15084084/openapi.do',
    },
    {
      id: 'fss_corp',
      name: '금융감독원 기업정보',
      description: '금융감독원 기업공시 API (OpenDART)',
      category: 'finance',
      logo_url: null,
      base_url: 'https://opendart.fss.or.kr/api',
      auth_type: 'api_key',
      auth_config_template: { param_name: 'crtfc_key', param_type: 'query' },
      endpoints: [
        {
          id: 'company_info',
          name: '기업개황',
          method: 'GET',
          path: '/company.json',
          description: '기업 기본정보 조회',
          parameters: [{ name: 'corp_code', type: 'string', required: true }],
        },
        {
          id: 'disclosure',
          name: '공시검색',
          method: 'GET',
          path: '/list.json',
          description: '공시 목록 검색',
        },
      ],
      setup_guide: '1. OpenDART 회원가입\n2. API 인증키 신청\n3. 인증키 발급 (즉시)',
      api_key_url: 'https://opendart.fss.or.kr/',
      documentation_url: 'https://opendart.fss.or.kr/guide/main.do',
    },
    {
      id: 'naver_search',
      name: '네이버 검색',
      description: '네이버 검색 API',
      category: 'search',
      logo_url: null,
      base_url: 'https://openapi.naver.com/v1/search',
      auth_type: 'api_key',
      auth_config_template: { header_name: 'X-Naver-Client-Id', header_name_secret: 'X-Naver-Client-Secret' },
      endpoints: [
        {
          id: 'news',
          name: '뉴스 검색',
          method: 'GET',
          path: '/news.json',
          description: '네이버 뉴스 검색',
          parameters: [
            { name: 'query', type: 'string', required: true },
            { name: 'display', type: 'number', default: 10 },
          ],
        },
        {
          id: 'blog',
          name: '블로그 검색',
          method: 'GET',
          path: '/blog.json',
          description: '네이버 블로그 검색',
        },
      ],
      setup_guide: '1. 네이버 개발자센터 가입\n2. 애플리케이션 등록\n3. Client ID/Secret 발급',
      api_key_url: 'https://developers.naver.com/apps/#/register',
      documentation_url: 'https://developers.naver.com/docs/serviceapi/search/news/news.md',
    },
    {
      id: 'kakao_search',
      name: '카카오 검색',
      description: '카카오 검색 API',
      category: 'search',
      logo_url: null,
      base_url: 'https://dapi.kakao.com/v2/search',
      auth_type: 'api_key',
      auth_config_template: { header_name: 'Authorization', prefix: 'KakaoAK ' },
      endpoints: [
        {
          id: 'web',
          name: '웹문서 검색',
          method: 'GET',
          path: '/web',
          description: '카카오 웹문서 검색',
          parameters: [{ name: 'query', type: 'string', required: true }],
        },
        {
          id: 'blog',
          name: '블로그 검색',
          method: 'GET',
          path: '/blog',
          description: '블로그 검색',
        },
      ],
      setup_guide: '1. 카카오 개발자 사이트 가입\n2. 애플리케이션 등록\n3. REST API 키 발급',
      api_key_url: 'https://developers.kakao.com/console/app',
      documentation_url: 'https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide',
    },
  ]

  if (category) {
    return presets.filter((p) => p.category === category)
  }

  return presets
}
