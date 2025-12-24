import { NextRequest, NextResponse } from 'next/server'
import { getOpenAI } from '@/lib/ai/openai'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const audioFile = formData.get('audio') as File

        if (!audioFile) {
            return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
        }

        const openai = getOpenAI()

        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            language: 'ko', // 한국어
        })

        return NextResponse.json({
            text: transcription.text,
            success: true
        })
    } catch (error: any) {
        console.error('[STT API Error]:', error)
        return NextResponse.json(
            { error: error.message || 'Internal Server Error', success: false },
            { status: 500 }
        )
    }
}
