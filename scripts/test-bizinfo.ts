
import { scrapeBizinfoDetail } from '../lib/government/bizinfo';

async function test() {
    // Test with the URL the user likely accessed (or a similar one)
    // ID based on previous context or a common ID pattern
    const pblancId = 'PBLN_0000000000103367';
    const url = `https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=${pblancId}`;

    console.log(`Testing scraper with URL: ${url}`);

    try {
        const result = await scrapeBizinfoDetail(url);
        console.log('Result:', JSON.stringify(result, null, 2));

        if (!result) {
            console.log('Result is null. Fetching raw HTML to investigate...');
            const res = await fetch(url);
            console.log('Status:', res.status);
            if (res.ok) {
                const html = await res.text();
                console.log('HTML Preview (first 500 chars):', html.substring(0, 500));
                // Check for potential class names we missed
                console.log('Contains "view_cont"?', html.includes('view_cont'));
                console.log('Contains "board_view"?', html.includes('board_view'));
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
