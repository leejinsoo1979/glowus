import { NextRequest, NextResponse } from 'next/server'

// Grok Voice API - TTS 엔드포인트
// WebSocket 기반 실시간 API를 HTTP로 래핑
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

        // Grok Realtime API를 사용하여 TTS 생성
        const audioChunks: Buffer[] = []

        await new Promise<void>((resolve, reject) => {
            const WebSocket = require('ws')

            const ws = new WebSocket('wss://api.x.ai/v1/realtime', {
                headers: {
                    'Authorization': `Bearer ${XAI_API_KEY}`,
                }
            })

            let sessionCreated = false

            ws.on('open', () => {
                // 세션 설정
                ws.send(JSON.stringify({
                    type: 'session.update',
                    session: {
                        voice: voice, // Ara, Rex, Sal, Eve, Leo
                        instructions: 'You are a helpful assistant. Respond naturally.',
                        modalities: ['text', 'audio'],
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        turn_detection: null, // 수동 턴 관리
                    }
                }))
            })

            ws.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString())

                    if (message.type === 'session.created' || message.type === 'session.updated') {
                        sessionCreated = true
                        // 텍스트를 음성으로 변환 요청
                        ws.send(JSON.stringify({
                            type: 'conversation.item.create',
                            item: {
                                type: 'message',
                                role: 'user',
                                content: [{
                                    type: 'input_text',
                                    text: `다음 텍스트를 자연스럽게 읽어주세요: "${text}"`
                                }]
                            }
                        }))

                        // 응답 생성 요청
                        ws.send(JSON.stringify({
                            type: 'response.create',
                            response: {
                                modalities: ['audio', 'text']
                            }
                        }))
                    }

                    // 오디오 델타 수신
                    if (message.type === 'response.audio.delta') {
                        const audioData = Buffer.from(message.delta, 'base64')
                        audioChunks.push(audioData)
                    }

                    // 응답 완료
                    if (message.type === 'response.done') {
                        ws.close()
                        resolve()
                    }

                    // 에러 처리
                    if (message.type === 'error') {
                        console.error('Grok Voice Error:', message)
                        ws.close()
                        reject(new Error(message.error?.message || 'Grok Voice API error'))
                    }
                } catch (e) {
                    // JSON 파싱 실패 시 무시
                }
            })

            ws.on('error', (error: Error) => {
                console.error('WebSocket Error:', error)
                reject(error)
            })

            ws.on('close', () => {
                if (audioChunks.length === 0 && sessionCreated) {
                    reject(new Error('No audio received'))
                }
            })

            // 30초 타임아웃
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close()
                    reject(new Error('Timeout'))
                }
            }, 30000)
        })

        // PCM을 WAV로 변환
        const pcmBuffer = Buffer.concat(audioChunks)
        const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16)

        return new NextResponse(wavBuffer, {
            headers: {
                'Content-Type': 'audio/wav',
                'Content-Length': wavBuffer.length.toString(),
            },
        })
    } catch (error: any) {
        console.error('[Grok Voice API Error]:', error)
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}

// PCM을 WAV로 변환하는 헬퍼 함수
function pcmToWav(pcmData: Buffer, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
    const byteRate = sampleRate * numChannels * bitsPerSample / 8
    const blockAlign = numChannels * bitsPerSample / 8
    const dataSize = pcmData.length
    const headerSize = 44
    const totalSize = headerSize + dataSize

    const buffer = Buffer.alloc(totalSize)

    // RIFF header
    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(totalSize - 8, 4)
    buffer.write('WAVE', 8)

    // fmt chunk
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16) // Subchunk1Size
    buffer.writeUInt16LE(1, 20) // AudioFormat (PCM)
    buffer.writeUInt16LE(numChannels, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(byteRate, 28)
    buffer.writeUInt16LE(blockAlign, 32)
    buffer.writeUInt16LE(bitsPerSample, 34)

    // data chunk
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataSize, 40)
    pcmData.copy(buffer, 44)

    return buffer
}
