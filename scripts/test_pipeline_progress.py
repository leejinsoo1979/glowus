#!/usr/bin/env python3
"""
사업계획서 파이프라인 진행률 UI 테스트
스테이지 상태 변화 및 진행률 업데이트 확인
"""
from playwright.sync_api import sync_playwright
import time
import json

def test_pipeline_progress():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page(viewport={'width': 1600, 'height': 1000})

        # 콘솔 로그 캡처
        console_logs = []
        page.on('console', lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("1. 사업계획서 builder 페이지로 이동...")
        plan_id = "be82fbf1-438f-43c4-8999-0bf902c06434"
        page.goto(f'http://localhost:3000/dashboard-group/company/government-programs/business-plan/builder?id={plan_id}')
        page.wait_for_load_state('networkidle')
        time.sleep(2)

        # 초기 화면 스크린샷
        page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-test-initial.png')
        print("   초기 화면 스크린샷 저장됨")

        # 스테이지 개수 확인
        stage_cards = page.locator('[class*="grid"] > div').all()
        print(f"   스테이지 카드 수: {len(stage_cards)}")

        print("\n2. '자동 생성' 버튼 찾기...")
        generate_btn = page.locator('button:has-text("자동 생성")')
        if generate_btn.count() > 0:
            print("   버튼 발견!")

            print("\n3. '자동 생성' 버튼 클릭...")
            generate_btn.click()
            time.sleep(1)

            # 오버레이 화면 스크린샷
            page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-test-overlay.png')
            print("   오버레이 화면 스크린샷 저장됨")

            print("\n4. 파이프라인 진행 상황 모니터링 (60초)...")
            prev_progress = -1
            prev_stage_statuses = ""

            for i in range(12):  # 60초 동안 5초 간격으로 체크
                time.sleep(5)

                # 진행률 확인
                try:
                    progress_text = page.locator('.text-3xl.font-bold.text-white.tabular-nums').text_content()
                    print(f"\n   [{i+1}] 진행률: {progress_text}")
                except:
                    print(f"\n   [{i+1}] 진행률 텍스트를 찾을 수 없음")

                # 스테이지 상태 확인 (오버레이에서)
                try:
                    stage_nodes = page.locator('.relative.flex.justify-between > div').all()
                    statuses = []
                    for idx, node in enumerate(stage_nodes[:8]):  # 최대 8개 스테이지
                        # 완료된 스테이지: CheckCircle2 아이콘
                        if node.locator('svg[class*="text-white"]').first.is_visible():
                            # Loader2는 animate-spin 클래스가 있음
                            if 'animate-spin' in (node.locator('svg').first.get_attribute('class') or ''):
                                statuses.append(f"S{idx+1}:진행중")
                            else:
                                statuses.append(f"S{idx+1}:완료")
                        else:
                            statuses.append(f"S{idx+1}:대기")

                    current_statuses = ", ".join(statuses)
                    if current_statuses != prev_stage_statuses:
                        print(f"   스테이지 상태: {current_statuses}")
                        prev_stage_statuses = current_statuses
                except Exception as e:
                    print(f"   스테이지 상태 확인 실패: {e}")

                # 진행 스크린샷
                page.screenshot(path=f'/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-test-progress-{i+1}.png')

                # 완료 또는 실패 확인
                try:
                    # 파이프라인 완료 시 오버레이가 사라짐
                    if not page.locator('.fixed.inset-0.z-50').is_visible():
                        print("\n   파이프라인 완료! 오버레이가 사라짐")
                        break
                except:
                    pass

                # 에러 확인
                try:
                    error_text = page.locator('[class*="bg-red"]').text_content()
                    if error_text:
                        print(f"\n   오류 발생: {error_text}")
                        break
                except:
                    pass
        else:
            print("   버튼을 찾을 수 없음")
            page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-test-no-button.png')

        # SSE 관련 콘솔 로그 출력
        print("\n5. SSE 관련 콘솔 로그:")
        sse_logs = [log for log in console_logs if 'SSE' in log or 'stage' in log.lower()]
        for log in sse_logs[-20:]:  # 마지막 20개만
            print(f"   {log}")

        print("\n6. 최종 스크린샷 저장...")
        page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/pipeline-test-final.png', full_page=True)

        print("\n테스트 완료!")
        browser.close()

if __name__ == "__main__":
    test_pipeline_progress()
