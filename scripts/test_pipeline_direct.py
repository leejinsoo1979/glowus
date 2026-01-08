#!/usr/bin/env python3
"""
기존 사업계획서로 파이프라인 직접 테스트
"""
from playwright.sync_api import sync_playwright
import time

def test_pipeline_direct():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=100)
        page = browser.new_page(viewport={'width': 1600, 'height': 1000})

        # 콘솔 로그 캡처
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        # 기존 사업계획서 ID로 직접 접근
        plan_id = "be82fbf1-438f-43c4-8999-0bf902c06434"  # 이전 테스트에서 사용한 ID

        print(f"1. Builder 페이지로 직접 이동 (plan_id: {plan_id})...")
        page.goto(f'http://localhost:3000/dashboard-group/company/government-programs/business-plan/builder?id={plan_id}')
        page.wait_for_load_state('networkidle')
        time.sleep(3)

        page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/direct-test-initial.png')
        print("   초기 화면 캡처 완료")

        # 자동 생성 버튼 찾기
        print("2. '자동 생성' 버튼 찾기...")
        generate_btn = page.locator('button:has-text("자동 생성")')

        if generate_btn.count() > 0:
            print("   버튼 발견! 클릭...")
            generate_btn.click()
            time.sleep(2)

            page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/direct-test-started.png')

            print("3. 파이프라인 진행 상황 모니터링 (90초)...")
            error_found = False

            for i in range(18):  # 90초 동안 5초 간격
                time.sleep(5)

                # 진행률 확인
                try:
                    progress_el = page.locator('.text-3xl.font-bold.text-white.tabular-nums')
                    if progress_el.count() > 0:
                        progress_text = progress_el.text_content()
                        print(f"   [{i+1}] 진행률: {progress_text}")
                except Exception as e:
                    pass

                # 스테이지 상태 확인
                try:
                    stage_status_text = []
                    for idx in range(1, 9):  # Stage 1-8
                        selector = f'[data-stage="{idx}"]'
                        stage_el = page.locator(selector)
                        if stage_el.count() > 0:
                            # 상태 클래스 확인
                            classes = stage_el.get_attribute('class') or ''
                            if 'completed' in classes or 'bg-green' in classes:
                                stage_status_text.append(f"S{idx}:✅")
                            elif 'running' in classes or 'processing' in classes or 'animate' in classes:
                                stage_status_text.append(f"S{idx}:🔄")
                            elif 'failed' in classes or 'bg-red' in classes:
                                stage_status_text.append(f"S{idx}:❌")
                            else:
                                stage_status_text.append(f"S{idx}:⏳")

                    if stage_status_text:
                        print(f"         스테이지: {' '.join(stage_status_text)}")
                except Exception as e:
                    pass

                # 에러 확인
                error_el = page.locator('.bg-red-500\\/20, [class*="error"]')
                if error_el.count() > 0:
                    try:
                        error_text = error_el.first.text_content()
                        if error_text and len(error_text) > 5:
                            print(f"   ❌ 오류 발생: {error_text[:200]}")
                            error_found = True
                            page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/direct-test-error.png')
                            break
                    except:
                        pass

                # 콘솔 에러 확인
                recent_errors = [log for log in console_logs[-20:] if 'error' in log.lower() and 'formatting_rules' in log.lower()]
                if recent_errors:
                    print(f"   ⚠️ 콘솔 에러: {recent_errors[-1][:150]}")

                # 완료 확인
                overlay = page.locator('.fixed.inset-0.z-50')
                if overlay.count() == 0:
                    print("   ✅ 오버레이 사라짐 - 완료 또는 오류")
                    break

                page.screenshot(path=f'/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/direct-test-progress-{i+1}.png')

            if not error_found:
                print("   모니터링 완료")
        else:
            print("   자동 생성 버튼을 찾을 수 없음")
            # 에러 메시지 확인
            error_msg = page.locator('[class*="error"], [class*="alert"]')
            if error_msg.count() > 0:
                print(f"   에러 메시지: {error_msg.first.text_content()[:200]}")

        # 콘솔 로그 중 formatting_rules 관련 출력
        print("\n4. formatting_rules 관련 콘솔 로그:")
        formatting_logs = [log for log in console_logs if 'formatting' in log.lower()]
        for log in formatting_logs[-10:]:
            print(f"   {log[:200]}")

        # 에러 로그 출력
        print("\n5. 에러 로그:")
        error_logs = [log for log in console_logs if '[error]' in log.lower()]
        for log in error_logs[-10:]:
            print(f"   {log[:200]}")

        page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/direct-test-final.png')
        print("\n테스트 완료!")
        browser.close()

if __name__ == "__main__":
    test_pipeline_direct()
