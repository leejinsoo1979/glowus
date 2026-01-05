-- =====================================================
-- 정부지원사업 전체 스키마 마이그레이션
-- 2026-01-05
-- =====================================================

-- 1) 북마크 테이블
CREATE TABLE IF NOT EXISTS government_program_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,
  notes TEXT,
  priority INTEGER DEFAULT 0, -- 0: 일반, 1: 중요, 2: 매우중요
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

-- 2) 알림 설정 테이블
CREATE TABLE IF NOT EXISTS government_program_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'deadline', 'new_program', 'status_change', 'keyword'
  keywords TEXT[], -- 키워드 알림용
  categories TEXT[], -- 카테고리 필터
  is_active BOOLEAN DEFAULT true,
  notification_channels TEXT[] DEFAULT ARRAY['in_app'], -- 'in_app', 'email', 'push'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) 신청 체크리스트 템플릿
CREATE TABLE IF NOT EXISTS application_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_type TEXT NOT NULL, -- 'tips', 'rnd', 'voucher', 'general'
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]', -- [{name, description, required, order}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4) 사용자별 신청 체크리스트
CREATE TABLE IF NOT EXISTS application_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID REFERENCES government_programs(id) ON DELETE SET NULL,
  template_id UUID REFERENCES application_checklist_templates(id),
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]', -- [{name, description, required, completed, completed_at}]
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) 필요 서류 관리
CREATE TABLE IF NOT EXISTS required_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID REFERENCES government_programs(id) ON DELETE SET NULL,
  checklist_id UUID REFERENCES application_checklists(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  document_type TEXT, -- 'business_license', 'financial_statement', 'certificate', 'plan', 'other'
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  status TEXT DEFAULT 'pending', -- 'pending', 'uploaded', 'verified', 'rejected'
  expiry_date DATE, -- 서류 유효기간
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6) 신청서 (제출/접수)
CREATE TABLE IF NOT EXISTS program_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,
  business_plan_id UUID REFERENCES business_plans(id),

  -- 신청 정보
  application_number TEXT, -- 접수번호
  status TEXT DEFAULT 'draft', -- 'draft', 'submitted', 'under_review', 'selected', 'rejected', 'contracted'

  -- 신청 데이터
  form_data JSONB DEFAULT '{}', -- 신청서 폼 데이터
  documents JSONB DEFAULT '[]', -- 첨부 서류 목록

  -- 제출 정보
  submitted_at TIMESTAMPTZ,
  submission_method TEXT, -- 'online', 'offline', 'email'
  confirmation_number TEXT, -- 제출 확인번호

  -- 결과
  result_announced_at TIMESTAMPTZ,
  result_notes TEXT,
  score DECIMAL(5,2), -- 평가점수
  rank INTEGER, -- 순위

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7) 협약 관리
CREATE TABLE IF NOT EXISTS program_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES program_applications(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES government_programs(id) ON DELETE CASCADE,

  -- 협약 기본정보
  contract_number TEXT,
  contract_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'signed', 'active', 'completed', 'terminated'

  -- 협약 기간
  start_date DATE,
  end_date DATE,

  -- 지원금
  total_amount DECIMAL(15,2), -- 총 지원금
  government_amount DECIMAL(15,2), -- 정부지원금
  self_amount DECIMAL(15,2), -- 자부담금

  -- 협약 조건
  conditions JSONB DEFAULT '[]', -- 주요 협약조건
  milestones JSONB DEFAULT '[]', -- 마일스톤

  -- 서류
  contract_file_url TEXT,
  attachments JSONB DEFAULT '[]',

  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8) 마일스톤 관리
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES program_contracts(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  target_date DATE NOT NULL,
  completed_date DATE,

  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'delayed', 'at_risk'
  progress INTEGER DEFAULT 0, -- 0-100

  deliverables JSONB DEFAULT '[]', -- 산출물 목록
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9) 과제 진행 현황 (위험/지연 포함)
CREATE TABLE IF NOT EXISTS project_progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES program_contracts(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES project_milestones(id) ON DELETE SET NULL,

  log_type TEXT NOT NULL, -- 'progress', 'risk', 'delay', 'issue', 'resolution'
  title TEXT NOT NULL,
  description TEXT,

  severity TEXT, -- 'low', 'medium', 'high', 'critical' (for risks)
  impact TEXT, -- 영향도 설명
  mitigation TEXT, -- 대응방안

  attachments JSONB DEFAULT '[]',

  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10) 자료 보관함
CREATE TABLE IF NOT EXISTS project_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES program_contracts(id) ON DELETE SET NULL,

  category TEXT NOT NULL, -- 'document', 'report', 'evidence', 'correspondence', 'other'
  name TEXT NOT NULL,
  description TEXT,

  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,

  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11) 예산 관리
CREATE TABLE IF NOT EXISTS project_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES program_contracts(id) ON DELETE CASCADE,

  -- 예산 항목
  category TEXT NOT NULL, -- 'personnel', 'equipment', 'materials', 'outsourcing', 'travel', 'other'
  subcategory TEXT,
  name TEXT NOT NULL,

  -- 금액
  planned_amount DECIMAL(15,2) NOT NULL, -- 계획금액
  executed_amount DECIMAL(15,2) DEFAULT 0, -- 집행금액

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12) 지출 내역
CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES program_contracts(id) ON DELETE CASCADE,
  budget_id UUID REFERENCES project_budgets(id) ON DELETE SET NULL,

  -- 지출 정보
  expense_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,

  vendor TEXT, -- 거래처
  payment_method TEXT, -- 'card', 'transfer', 'cash'

  -- 증빙
  receipt_file_url TEXT,
  receipt_number TEXT,

  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13) 연동 계좌/카드
CREATE TABLE IF NOT EXISTS linked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES program_contracts(id) ON DELETE SET NULL,

  account_type TEXT NOT NULL, -- 'bank', 'card'
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL, -- 암호화 저장 권장
  account_holder TEXT,

  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  last_synced_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14) 보고서 관리
CREATE TABLE IF NOT EXISTS project_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES program_contracts(id) ON DELETE CASCADE,

  report_type TEXT NOT NULL, -- 'interim', 'final', 'quarterly', 'monthly'
  report_period_start DATE,
  report_period_end DATE,

  title TEXT NOT NULL,
  content JSONB DEFAULT '{}', -- 보고서 내용

  file_url TEXT,
  attachments JSONB DEFAULT '[]',

  status TEXT DEFAULT 'draft', -- 'draft', 'submitted', 'under_review', 'approved', 'revision_required'

  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15) 정산 관리
CREATE TABLE IF NOT EXISTS project_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES program_contracts(id) ON DELETE CASCADE,
  report_id UUID REFERENCES project_reports(id),

  settlement_type TEXT NOT NULL, -- 'interim', 'final'

  -- 정산 금액
  total_expenses DECIMAL(15,2),
  approved_expenses DECIMAL(15,2),
  return_amount DECIMAL(15,2), -- 반납금액

  -- 서류
  documents JSONB DEFAULT '[]',

  status TEXT DEFAULT 'draft', -- 'draft', 'submitted', 'under_review', 'approved', 'completed'

  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16) 성과물 - 특허/IP
CREATE TABLE IF NOT EXISTS project_patents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES program_contracts(id) ON DELETE SET NULL,

  patent_type TEXT NOT NULL, -- 'patent', 'utility_model', 'design', 'trademark', 'copyright', 'trade_secret'
  title TEXT NOT NULL,
  description TEXT,

  application_number TEXT,
  application_date DATE,
  registration_number TEXT,
  registration_date DATE,

  status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'registered', 'rejected', 'expired'

  inventors TEXT[], -- 발명자
  applicant TEXT, -- 출원인

  file_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17) 성과물 - 논문/출판물
CREATE TABLE IF NOT EXISTS project_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES program_contracts(id) ON DELETE SET NULL,

  publication_type TEXT NOT NULL, -- 'journal', 'conference', 'book', 'thesis', 'report', 'other'
  title TEXT NOT NULL,
  authors TEXT[],

  journal_name TEXT, -- 학술지명
  conference_name TEXT, -- 학회명
  publisher TEXT,

  publication_date DATE,
  volume TEXT,
  issue TEXT,
  pages TEXT,
  doi TEXT,
  url TEXT,

  is_sci BOOLEAN DEFAULT false,
  is_scopus BOOLEAN DEFAULT false,
  impact_factor DECIMAL(5,3),

  file_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18) 참여연구원
CREATE TABLE IF NOT EXISTS project_researchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES program_contracts(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'pi', 'co_pi', 'researcher', 'student', 'assistant'
  affiliation TEXT, -- 소속
  department TEXT,
  position TEXT, -- 직위

  email TEXT,
  phone TEXT,

  participation_rate DECIMAL(5,2), -- 참여율 (%)
  start_date DATE,
  end_date DATE,

  expertise TEXT[], -- 전문분야

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON government_program_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_program ON government_program_bookmarks(program_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON government_program_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_checklists_user ON application_checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON required_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user ON program_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_program ON program_applications(program_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON program_applications(status);
CREATE INDEX IF NOT EXISTS idx_contracts_user ON program_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON program_contracts(status);
CREATE INDEX IF NOT EXISTS idx_milestones_contract ON project_milestones(contract_id);
CREATE INDEX IF NOT EXISTS idx_progress_contract ON project_progress_logs(contract_id);
CREATE INDEX IF NOT EXISTS idx_archives_contract ON project_archives(contract_id);
CREATE INDEX IF NOT EXISTS idx_budgets_contract ON project_budgets(contract_id);
CREATE INDEX IF NOT EXISTS idx_expenses_contract ON project_expenses(contract_id);
CREATE INDEX IF NOT EXISTS idx_reports_contract ON project_reports(contract_id);
CREATE INDEX IF NOT EXISTS idx_settlements_contract ON project_settlements(contract_id);
CREATE INDEX IF NOT EXISTS idx_patents_contract ON project_patents(contract_id);
CREATE INDEX IF NOT EXISTS idx_publications_contract ON project_publications(contract_id);
CREATE INDEX IF NOT EXISTS idx_researchers_contract ON project_researchers(contract_id);

-- RLS 정책
ALTER TABLE government_program_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE government_program_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE required_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_patents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_researchers ENABLE ROW LEVEL SECURITY;

-- 기본 RLS 정책 (사용자 본인 데이터만 접근)
CREATE POLICY "Users can manage own bookmarks" ON government_program_bookmarks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own alerts" ON government_program_alerts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view checklist templates" ON application_checklist_templates FOR SELECT USING (true);
CREATE POLICY "Users can manage own checklists" ON application_checklists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own documents" ON required_documents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own applications" ON program_applications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own contracts" ON program_contracts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own milestones" ON project_milestones FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own progress logs" ON project_progress_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own archives" ON project_archives FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own budgets" ON project_budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own expenses" ON project_expenses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own linked accounts" ON linked_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own reports" ON project_reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own settlements" ON project_settlements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own patents" ON project_patents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own publications" ON project_publications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own researchers" ON project_researchers FOR ALL USING (auth.uid() = user_id);

-- 기본 체크리스트 템플릿 삽입
INSERT INTO application_checklist_templates (program_type, name, items) VALUES
('general', '일반 지원사업 체크리스트', '[
  {"name": "사업자등록증", "description": "최근 발급본", "required": true, "order": 1},
  {"name": "법인등기부등본", "description": "최근 3개월 이내", "required": true, "order": 2},
  {"name": "재무제표", "description": "최근 2개년", "required": true, "order": 3},
  {"name": "4대보험 가입증명", "description": "최근 발급본", "required": true, "order": 4},
  {"name": "사업계획서", "description": "지정 양식", "required": true, "order": 5},
  {"name": "대표자 신분증", "description": "주민등록증 또는 운전면허증", "required": true, "order": 6},
  {"name": "통장사본", "description": "법인 통장", "required": true, "order": 7}
]'),
('tips', 'TIPS 체크리스트', '[
  {"name": "사업자등록증", "description": "최근 발급본", "required": true, "order": 1},
  {"name": "법인등기부등본", "description": "최근 3개월 이내", "required": true, "order": 2},
  {"name": "재무제표", "description": "최근 2개년", "required": true, "order": 3},
  {"name": "기술 사업화 계획서", "description": "TIPS 양식", "required": true, "order": 4},
  {"name": "기술 보유 증빙", "description": "특허, 논문 등", "required": false, "order": 5},
  {"name": "팀원 이력서", "description": "핵심 인력", "required": true, "order": 6},
  {"name": "투자 유치 계획", "description": "엔젤투자 매칭", "required": true, "order": 7},
  {"name": "시제품/MVP", "description": "개발 현황", "required": false, "order": 8}
]'),
('rnd', 'R&D 지원사업 체크리스트', '[
  {"name": "사업자등록증", "description": "최근 발급본", "required": true, "order": 1},
  {"name": "법인등기부등본", "description": "최근 3개월 이내", "required": true, "order": 2},
  {"name": "재무제표", "description": "최근 3개년", "required": true, "order": 3},
  {"name": "연구개발계획서", "description": "지정 양식", "required": true, "order": 4},
  {"name": "연구인력 현황", "description": "연구원 명단 및 자격", "required": true, "order": 5},
  {"name": "기업부설연구소 인정서", "description": "해당시", "required": false, "order": 6},
  {"name": "선행기술조사서", "description": "특허 분석", "required": true, "order": 7},
  {"name": "기술료 납부 확약서", "description": "성공시 기술료", "required": true, "order": 8}
]'),
('voucher', '바우처 사업 체크리스트', '[
  {"name": "사업자등록증", "description": "최근 발급본", "required": true, "order": 1},
  {"name": "중소기업확인서", "description": "중소기업현황정보시스템", "required": true, "order": 2},
  {"name": "재무제표", "description": "최근 1개년", "required": true, "order": 3},
  {"name": "바우처 신청서", "description": "지정 양식", "required": true, "order": 4},
  {"name": "사업 활용 계획서", "description": "바우처 사용 계획", "required": true, "order": 5},
  {"name": "견적서", "description": "수행기관 견적", "required": false, "order": 6}
]')
ON CONFLICT DO NOTHING;
