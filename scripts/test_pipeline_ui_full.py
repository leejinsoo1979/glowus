#!/usr/bin/env python3
"""
Builder 페이지 실시간 파이프라인 진행률 UI 전체 테스트
"""
from playwright.sync_api import sync_playwright
import time
import requests

def test_pipeline_ui_full():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=50)
        page = browser.new_page(viewport={'width': 1600, 'height': 1000})

        # 1. 새 사업계획서 API로 생성
        print("1. 새 사업계획서 생성 중...")
        res = requests.post('http://localhost:3000/api/business-plans', json={
            'title': f'UI 전체 테스트 {time.strftime("%H:%M:%S")}',
            'program_id': 'cdf1f6ef-eb9b-4a85-9809-ffc48bbbb0db'
        })
        data = res.json()
        plan = data.get('plan') or data
        plan_id = plan.get('id')
        print(f"   Plan ID: {plan_id}")

        # 2. Builder 페이지 이동
        print("\n2. Builder 페이지 이동...")
        page.goto(f'http://localhost:3000/dashboard-group/company/government-programs/business-plan/builder?id={plan_id}')
        page.wait_for_load_state('networkidle')
        time.sleep(2)

        # 3. 자동 생성 버튼 클릭
        print("\n3. 자동 생성 버튼 클릭...")
        page.locator('button:has-text("자동 생성")').click()
        time.sleep(1)
        
        page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/full-test-start.png')

        # 4. 진행률 모니터링 (90초)
        print("\n4. 실시간 진행률 모니터링 (90초)...")
        print("=" * 60)

        for i in range(18):  # 90초
            time.sleep(5)

            # 전체 진행률
            overall = ""
            try:
                # 오른쪽 상단의 큰 퍼센트 숫자
                el = page.locator('text=/^\\d+%$/').first
                if el.count() > 0:
                    overall = el.text_content()
            except:
                pass

            # 현재 스테이지 정보
            stage_info = ""
            try:
                # STAGE N 라벨
                stage_label = page.locator('text=/STAGE \\d/').first
                if stage_label.count() > 0:
                    stage_info = stage_label.text_content()
            except:
                pass

            # 스테이지 진행률
            stage_progress = ""
            try:
                # 스테이지별 퍼센트
                progress_el = page.locator('.text-cyan-400, .text-blue-400').filter(has_text="%")
                if progress_el.count() > 0:
                    stage_progress = progress_el.first.text_content()
            except:
                pass

            # 상태 출력
            print(f"   [{(i+1)*5:3d}s] 전체: {overall or '...':<6} | {stage_info:<10} | 스테이지 진행률: {stage_progress}")

            # 스크린샷 (15초마다)
            if i % 3 == 0:
                page.screenshot(path=f'/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/full-test-{i//3}.png')

            # 100% 완료 확인
            if overall and '100' in overall:
                print("\n   🎉 파이프라인 100% 완료!")
                break

            # 오버레이 상태 확인 (진행률 UI가 보이는지)
            progress_ui = page.locator('text="전체 진행률"')
            if progress_ui.count() == 0:
                print("\n   ✅ 진행률 UI 종료 - 완료됨")
                break

        print("=" * 60)

        # 5. 최종 스크린샷
        page.screenshot(path='/Users/jinsoolee/Downloads/GlowUS/.playwright-mcp/full-test-final.png')
        print("\n5. 테스트 완료!")

        time.sleep(3)
        browser.close()

if __name__ == "__main__":
    test_pipeline_ui_full()
