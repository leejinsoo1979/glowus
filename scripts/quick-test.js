const https = require('https');

const url = 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C127/AK/210/view.do?eventInfoId=EVEN_000000000067865';

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // Check for sub_cont class
        const hasSubCont = data.includes('class="sub_cont"');
        console.log('Has sub_cont:', hasSubCont);

        // Extract sub_cont content
        const startMarker = 'class="sub_cont"';
        const startIndex = data.indexOf(startMarker);

        if (startIndex !== -1) {
            // Find opening div
            const openingDivStart = data.lastIndexOf('<div', startIndex);
            if (openingDivStart !== -1) {
                // Tag balancing to find closing div
                let depth = 0;
                let currentIndex = openingDivStart;
                const maxLen = data.length;

                while (currentIndex < maxLen) {
                    const nextOpen = data.indexOf('<div', currentIndex + 1);
                    const nextClose = data.indexOf('</div>', currentIndex + 1);

                    if (nextClose === -1) break;

                    if (nextOpen !== -1 && nextOpen < nextClose) {
                        depth++;
                        currentIndex = nextOpen;
                    } else {
                        if (depth === 0) {
                            const content = data.substring(openingDivStart, nextClose + 6);
                            console.log('Content length:', content.length);
                            console.log('Content preview:', content.substring(0, 300));
                            break;
                        } else {
                            depth--;
                            currentIndex = nextClose;
                        }
                    }
                }
            }
        } else {
            console.log('sub_cont not found');
        }
    });
}).on('error', console.error);
