import { NextRequest, NextResponse } from 'next/server'

// WebSocket 연결 풀 (재사용)
let cachedWs: any = null
let wsReady = false
let currentVoice = ''

function getWebSocket(apiKey: string, voice: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // 기존 연결이 있고 준비됐으면 재사용
        if (cachedWs && wsReady && cachedWs.readyState === 1 && currentVoice === voice) {
            resolve(cachedWs)
            return
        }

        // 기존 연결 정리
        if (cachedWs) {
            try { cachedWs.close() } catch (e) {}
            cachedWs = null
            wsReady = false
        }

        const WebSocket = require('ws')
        const ws = new WebSocket('wss://api.x.ai/v1/realtime', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        })

        ws.on('open', () => {
            console.log('[Grok] Connected')
        })

        ws.on('message', (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString())
                if (msg.type === 'conversation.created') {
                    ws.send(JSON.stringify({
                        type: 'session.update',
                        session: {
                            voice: voice,
                            modalities: ['text', 'audio'],
                            output_audio_format: 'pcm16',
                            turn_detection: null,
                        }
                    }))
                }
                if (msg.type === 'session.updated') {
                    wsReady = true
                    currentVoice = voice
                    cachedWs = ws
                    resolve(ws)
                }
                if (msg.type === 'error') {
                    reject(new Error(msg.error?.message || 'Connection error'))
                }
            } catch (e) {}
        })

        ws.on('error', (e: Error) => {
            wsReady = false
            cachedWs = null
            reject(e)
        })

        ws.on('close', () => {
            wsReady = false
            cachedWs = null
        })

        setTimeout(() => {
            if (!wsReady) {
                ws.close()
                reject(new Error('Connection timeout'))
            }
        }, 5000)
    })
}

export async function POST(req: NextRequest) {
    try {
        const { text, voice = 'Eve' } = await req.json()

        if (!text) {
            return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        }

        const XAI_API_KEY = process.env.XAI_API_KEY
        if (!XAI_API_KEY) {
            return NextResponse.json({ error: 'XAI API key not configured' }, { status: 500 })
        }

        const startTime = Date.now()
        const ws = await getWebSocket(XAI_API_KEY, voice)
        console.log('[Grok] Connection ready in', Date.now() - startTime, 'ms')

        const audioChunks: Buffer[] = []

        await new Promise<void>((resolve, reject) => {
            const messageHandler = (data: Buffer) => {
                try {
                    const msg = JSON.parse(data.toString())

                    if (msg.type === 'response.output_audio.delta') {
                        audioChunks.push(Buffer.from(msg.delta, 'base64'))
                    }

                    if (msg.type === 'response.done') {
                        ws.removeListener('message', messageHandler)
                        console.log('[Grok] Audio received in', Date.now() - startTime, 'ms')
                        resolve()
                    }

                    if (msg.type === 'error') {
                        ws.removeListener('message', messageHandler)
                        reject(new Error(msg.error?.message))
                    }
                } catch (e) {}
            }

            ws.on('message', messageHandler)

            // 텍스트 전송 및 응답 요청을 동시에
            ws.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_text', text }]
                }
            }))

            ws.send(JSON.stringify({
                type: 'response.create',
                response: { modalities: ['audio'] }
            }))

            setTimeout(() => {
                ws.removeListener('message', messageHandler)
                if (audioChunks.length === 0) {
                    reject(new Error('Timeout'))
                }
            }, 15000)
        })

        if (audioChunks.length === 0) {
            return NextResponse.json({ error: 'No audio' }, { status: 500 })
        }

        const pcmBuffer = Buffer.concat(audioChunks)
        const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16)

        console.log('[Grok] Total time:', Date.now() - startTime, 'ms')

        return new NextResponse(wavBuffer, {
            headers: {
                'Content-Type': 'audio/wav',
                'Content-Length': wavBuffer.length.toString(),
            },
        })
    } catch (error: any) {
        console.error('[Grok Error]:', error.message)
        // 에러 시 연결 초기화
        cachedWs = null
        wsReady = false
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

function pcmToWav(pcmData: Buffer, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
    const byteRate = sampleRate * numChannels * bitsPerSample / 8
    const blockAlign = numChannels * bitsPerSample / 8
    const dataSize = pcmData.length
    const buffer = Buffer.alloc(44 + dataSize)

    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + dataSize, 4)
    buffer.write('WAVE', 8)
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(numChannels, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(byteRate, 28)
    buffer.writeUInt16LE(blockAlign, 32)
    buffer.writeUInt16LE(bitsPerSample, 34)
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataSize, 40)
    pcmData.copy(buffer, 44)

    return buffer
}
