-- ============================================
-- 직원 확장 필드 추가 (Employee Extended Fields)
-- 사원 등록 폼의 모든 필드를 지원하기 위한 마이그레이션
-- ============================================

-- 로그인/계정 관련
ALTER TABLE employees ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'active'; -- active, suspended, dormant
ALTER TABLE employees ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'ko';

-- 입사 관련
ALTER TABLE employees ADD COLUMN IF NOT EXISTS recognized_hire_date DATE; -- 인정입사일자
ALTER TABLE employees ADD COLUMN IF NOT EXISTS external_email VARCHAR(200); -- 외부 이메일

-- 생일/기념일
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birthday_type VARCHAR(10) DEFAULT 'solar'; -- solar, lunar
ALTER TABLE employees ADD COLUMN IF NOT EXISTS anniversary DATE; -- 기념일

-- 연락처 확장
ALTER TABLE employees ADD COLUMN IF NOT EXISTS direct_phone VARCHAR(20); -- 직통전화
ALTER TABLE employees ADD COLUMN IF NOT EXISTS main_phone VARCHAR(20); -- 대표번호
ALTER TABLE employees ADD COLUMN IF NOT EXISTS fax VARCHAR(20); -- FAX

-- 프로필 확장
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title VARCHAR(100); -- 직무
ALTER TABLE employees ADD COLUMN IF NOT EXISTS location_name VARCHAR(200); -- 위치 (문자열)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS homepage VARCHAR(500); -- 홈페이지
ALTER TABLE employees ADD COLUMN IF NOT EXISTS messenger VARCHAR(200); -- 메신저
ALTER TABLE employees ADD COLUMN IF NOT EXISTS introduction TEXT; -- 자기소개
ALTER TABLE employees ADD COLUMN IF NOT EXISTS notes TEXT; -- 메모

-- 주민등록번호 분리 저장 (보안)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resident_number_front VARCHAR(10); -- 앞 6자리
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resident_number_back VARCHAR(10); -- 뒷 7자리 (암호화 필요)

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);
CREATE INDEX IF NOT EXISTS idx_employees_account_status ON employees(account_status);
CREATE INDEX IF NOT EXISTS idx_employees_external_email ON employees(external_email);

-- 컬럼 코멘트
COMMENT ON COLUMN employees.username IS '시스템 로그인 아이디';
COMMENT ON COLUMN employees.account_status IS '계정 상태 (active: 정상, suspended: 중지, dormant: 휴면)';
COMMENT ON COLUMN employees.language IS '사용 언어 (ko, en, ja, zh)';
COMMENT ON COLUMN employees.recognized_hire_date IS '인정입사일자 (근속연수 계산용)';
COMMENT ON COLUMN employees.external_email IS '외부 이메일 (회사 이메일 외)';
COMMENT ON COLUMN employees.birthday_type IS '생일 유형 (solar: 양력, lunar: 음력)';
COMMENT ON COLUMN employees.anniversary IS '기념일';
COMMENT ON COLUMN employees.direct_phone IS '직통전화번호';
COMMENT ON COLUMN employees.main_phone IS '대표전화번호';
COMMENT ON COLUMN employees.fax IS 'FAX 번호';
COMMENT ON COLUMN employees.job_title IS '직무';
COMMENT ON COLUMN employees.location_name IS '근무 위치 (문자열)';
COMMENT ON COLUMN employees.homepage IS '개인 홈페이지';
COMMENT ON COLUMN employees.messenger IS '메신저 ID';
COMMENT ON COLUMN employees.introduction IS '자기소개';
COMMENT ON COLUMN employees.notes IS '관리자 메모';
COMMENT ON COLUMN employees.resident_number_front IS '주민등록번호 앞 6자리';
COMMENT ON COLUMN employees.resident_number_back IS '주민등록번호 뒷 7자리 (암호화 저장)';
