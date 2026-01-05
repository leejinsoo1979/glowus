
const https = require('https');

function scrape(url) {
    console.log('Fetching:', url);
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (res) => {
            console.log('Status:', res.statusCode);
            if (res.statusCode !== 200) {
                console.log('Headers:', res.headers);
                res.resume();
                return resolve(null);
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Data length:', data.length);

                console.log('--- Search Results ---');
                // Look for view.do links
                const linkRegex = /<a[^>]+href="([^"]*view\.do[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
                let linkMatch;
                let count = 0;

                while ((linkMatch = linkRegex.exec(data)) !== null) {
                    const href = linkMatch[1];
                    const text = linkMatch[2].replace(/<[^>]+>/g, '').trim();
                    if (text.includes('방산혁신')) {
                        console.log('TARGET FOUND!');
                        console.log('Title:', text);
                        console.log('Href:', href);
                    }
                    count++;
                }

                resolve(true);
            });
        }).on('error', (e) => {
            console.error('Error:', e);
            reject(e);
        });
    });
}

const id = 'PBLN_000000000103367'; // Removed one zero (9 zeros)
const targetUrl = `https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=${id}`;

scrape(targetUrl);
