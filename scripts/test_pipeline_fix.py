#!/usr/bin/env python3
"""
파이프라인 formatting_rules 수정 후 테스트
"""
from playwright.sync_api import sync_playwright
import time
import json

def test_pipeline_fix():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=100)
        page = browser.new_page(viewport={'width': 1600, 'height': 1000})

        # 콘솔 로그 캡처
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("1. 사업계획서 목록 페이지로 이동...")
        page.goto('http://localhost:3000/dashboard-group/company/government-programs/business-plan')
        page.wait_for_load_state('networkidle')
        time.sleep(2)

        # 새 사업계획서 생성 버튼 클릭
        print("2. '새 사업계획서' 버튼 찾기...")
        new_plan_btn = page.locator('button:has-text("새 사업계획서"), a:has-text("새 사업계획서")')
        if new_plan_btn.count() > 0:
            print("   버튼 발견!")
            new_plan_btn.first.click()
            page.wait_for_load_state('networkidle')
            time.sleep(2)

            # 프로그램 선택 (만약 모달이 있다면)
            print("3. URL 확인...")
            current_url = page.url
            print(f"   현재 URL: {current_url}")

            # builder 페이지인지 확인
            if 'builder' in current_url:
                print("   Builder 페이지로 이동됨")
                page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-fix-builder.png')

                # 자동 생성 버튼 찾기
                print("4. '자동 생성' 버튼 찾기...")
                generate_btn = page.locator('button:has-text("자동 생성")')
                if generate_btn.count() > 0:
                    print("   버튼 발견! 클릭...")
                    generate_btn.click()
                    time.sleep(2)

                    # 오버레이 스크린샷
                    page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-fix-overlay.png')

                    print("5. 파이프라인 진행 상황 모니터링 (60초)...")
                    for i in range(12):  # 60초
                        time.sleep(5)

                        # 진행률 텍스트 확인
                        try:
                            progress_el = page.locator('.text-3xl.font-bold.text-white.tabular-nums')
                            if progress_el.count() > 0:
                                progress_text = progress_el.text_content()
                                print(f"   [{i+1}] 진행률: {progress_text}")
                        except:
                            pass

                        # 에러 확인
                        error_el = page.locator('[class*="bg-red"]')
                        if error_el.count() > 0:
                            try:
                                error_text = error_el.first.text_content()
                                if error_text:
                                    print(f"   ❌ 오류 발생: {error_text}")
                                    page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-fix-error.png')
                                    break
                            except:
                                pass

                        # 완료 확인 (오버레이가 사라지면)
                        overlay = page.locator('.fixed.inset-0.z-50')
                        if overlay.count() == 0 or not overlay.is_visible():
                            print("   ✅ 파이프라인 완료!")
                            break

                        page.screenshot(path=f'/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-fix-progress-{i+1}.png')
                else:
                    print("   자동 생성 버튼을 찾을 수 없음")
                    page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-fix-no-button.png')
            else:
                print("   다른 페이지로 이동됨")
                page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-fix-other-page.png')
        else:
            print("   '새 사업계획서' 버튼을 찾을 수 없음")
            # 기존 사업계획서로 테스트
            print("   기존 사업계획서로 테스트 시도...")

            # 가장 최근 사업계획서 클릭
            plan_link = page.locator('a[href*="business-plan/builder"]').first
            if plan_link.count() > 0:
                plan_link.click()
                page.wait_for_load_state('networkidle')
                time.sleep(2)
                print(f"   이동 완료: {page.url}")

        # 콘솔 로그 중 에러 출력
        print("\n6. 콘솔 에러 로그:")
        error_logs = [log for log in console_logs if '[error]' in log.lower() or 'error' in log.lower()]
        for log in error_logs[-10:]:
            print(f"   {log}")

        print("\n7. 최종 스크린샷 저장...")
        page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-fix-final.png', full_page=True)

        print("\n테스트 완료!")
        browser.close()

if __name__ == "__main__":
    test_pipeline_fix()
