#!/usr/bin/env python3
"""
Builder 페이지에서 실시간 파이프라인 진행률 UI 테스트
- 기존 사업계획서를 사용하여 테스트
"""
from playwright.sync_api import sync_playwright
import time
import requests

def test_pipeline_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=50)
        page = browser.new_page(viewport={'width': 1600, 'height': 1000})

        # 콘솔 로그 캡처
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        # 1. 새 사업계획서 API로 생성
        print("1. 새 사업계획서 API로 생성...")
        try:
            res = requests.post('http://localhost:3000/api/business-plans', json={
                'title': f'UI 테스트 사업계획서 {time.strftime("%H:%M:%S")}',
                'program_id': 'cdf1f6ef-eb9b-4a85-9809-ffc48bbbb0db'  # 호서대학교 서울창업보육센터
            })
            if res.ok:
                data = res.json()
                plan = data.get('plan') or data.get('data') or data
                plan_id = plan.get('id')
                print(f"   생성됨: {plan_id}")
            else:
                print(f"   생성 실패: {res.text[:100]}")
                plan_id = '44524d4b-d3c4-4e6d-9917-68257d4ca74f'  # 이전 테스트 ID 사용
        except Exception as e:
            print(f"   API 오류: {e}")
            plan_id = '44524d4b-d3c4-4e6d-9917-68257d4ca74f'

        # 2. Builder 페이지로 직접 이동
        print(f"\n2. Builder 페이지로 이동 (plan_id: {plan_id})...")
        page.goto(f'http://localhost:3000/dashboard-group/company/government-programs/business-plan/builder?id={plan_id}')
        page.wait_for_load_state('networkidle')
        time.sleep(3)

        page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/ui-test-1-builder.png')
        print(f"   현재 URL: {page.url}")

        # 3. 자동 생성 버튼 찾기
        print("\n3. '자동 생성' 버튼 찾기...")
        generate_btn = page.locator('button:has-text("자동 생성")')

        if generate_btn.count() > 0:
            print("   버튼 발견! 클릭...")
            generate_btn.click()
            time.sleep(2)

            page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/ui-test-2-overlay-start.png')
            print("   오버레이 시작!")

            # 4. 실시간 진행률 모니터링 (120초)
            print("\n4. 실시간 진행률 UI 모니터링...")
            print("   " + "="*50)

            for i in range(24):  # 120초 (5초 간격)
                time.sleep(5)

                # 진행률 확인 - 여러 셀렉터 시도
                progress_text = ""
                try:
                    # 큰 퍼센트 숫자 찾기
                    percent_el = page.locator('.text-3xl, .text-4xl, .text-5xl')
                    for j in range(percent_el.count()):
                        text = percent_el.nth(j).text_content()
                        if text and '%' in text:
                            progress_text = text.strip()
                            break
                except:
                    pass

                # 현재 스테이지 이름 확인
                stage_name = ""
                try:
                    # 스테이지 관련 텍스트 찾기
                    stage_el = page.locator('.text-lg, .text-xl').filter(has_text="Stage")
                    if stage_el.count() > 0:
                        stage_name = stage_el.first.text_content()[:30]
                except:
                    pass

                # 스테이지 상태 아이콘들 확인
                stage_status = []
                try:
                    # 완료된 스테이지 (체크 또는 녹색)
                    completed = page.locator('.text-green-400, .bg-green-500, svg.text-green').count()
                    # 진행 중 스테이지 (애니메이션)
                    processing = page.locator('.animate-pulse, .animate-spin').count()
                    stage_status = f"완료:{completed} 진행:{processing}"
                except:
                    pass

                # 출력
                print(f"   [{(i+1)*5:3d}초] {progress_text or '...':<10} | {stage_status}")

                # 스크린샷 (15초마다)
                if i % 3 == 0:
                    page.screenshot(path=f'/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/ui-test-progress-{i//3}.png')

                # 완료 확인
                if progress_text and '100' in progress_text:
                    print("\n   🎉 100% 완료!")
                    time.sleep(2)
                    break

                # 오버레이 사라짐 확인
                overlay = page.locator('.fixed.inset-0.z-50.bg-black')
                if overlay.count() == 0:
                    print("\n   ✅ 파이프라인 완료! (오버레이 사라짐)")
                    break

                # 에러 확인
                error_el = page.locator('.text-red-400, .text-red-500')
                if error_el.count() > 0:
                    error_text = error_el.first.text_content()
                    if error_text and len(error_text) > 3:
                        print(f"\n   ❌ 에러 발생: {error_text[:80]}")
                        break

            print("   " + "="*50)
            page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/ui-test-3-complete.png')
        else:
            print("   ❌ 자동 생성 버튼을 찾을 수 없음")
            # 버튼 목록 출력
            buttons = page.locator('button').all()
            print(f"   발견된 버튼들:")
            for btn in buttons[:10]:
                text = btn.text_content()
                if text:
                    print(f"     - {text[:40]}")
            page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/ui-test-no-btn.png')

        # 5. 최종 결과 확인
        print("\n5. 최종 상태 확인...")
        page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/ui-test-final.png', full_page=True)

        # 콘솔 에러 출력
        errors = [log for log in console_logs if '[error]' in log.lower()]
        if errors:
            print("\n6. 콘솔 에러:")
            for err in errors[-3:]:
                print(f"   {err[:120]}")

        print("\n✅ 테스트 완료!")
        time.sleep(2)
        browser.close()

if __name__ == "__main__":
    test_pipeline_ui()
