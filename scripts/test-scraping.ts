// Test script to verify bizinfo scraping works
import { scrapeBizinfoDetail } from '../lib/government/bizinfo'

const testUrl = 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_000000000117085'

console.log('Testing Bizinfo scraping...')
console.log('URL:', testUrl)

scrapeBizinfoDetail(testUrl).then(result => {
    console.log('\n=== SCRAPING RESULT ===')
    console.log('Success:', !!result)
    console.log('Has content:', !!result?.content)
    console.log('Content length:', result?.content?.length || 0)
    console.log('Has attachments:', !!result?.attachments)
    console.log('Attachment count:', result?.attachments?.length || 0)

    if (result?.content) {
        console.log('\nContent preview (first 200 chars):')
        console.log(result.content.substring(0, 200))
    }

    if (result?.attachments && result.attachments.length > 0) {
        console.log('\nAttachments:')
        result.attachments.forEach((att, i) => {
            console.log(`${i + 1}. ${att.name}`)
        })
    }
}).catch(err => {
    console.error('ERROR:', err)
}).finally(() => {
    process.exit(0)
})
