#!/usr/bin/env python3
"""
Qwen3-TTS FastAPI Server for GlowUS AI Studio
M1 Pro Mac 최적화 버전
"""

import io
import os
import sys
from typing import Optional

# Qwen3-TTS 모듈 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "Qwen3-TTS-main"))

import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI(title="Qwen3-TTS Server", version="1.0.0")

# CORS 설정 (Next.js에서 호출 가능하도록)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 전역 모델 변수
model = None
MODEL_LOADED = False

# 지원되는 스피커 목록
SPEAKERS = {
    "Sohee": {"language": "Korean", "description": "Warm Korean female voice with rich emotion"},
    "Vivian": {"language": "Chinese", "description": "Bright, slightly edgy young female voice"},
    "Serena": {"language": "Chinese", "description": "Warm, gentle young female voice"},
    "Ryan": {"language": "English", "description": "Dynamic male voice with strong rhythmic drive"},
    "Aiden": {"language": "English", "description": "Sunny American male voice with a clear midrange"},
    "Ono_Anna": {"language": "Japanese", "description": "Playful Japanese female voice"},
}


class TTSRequest(BaseModel):
    text: str
    speaker: str = "Sohee"
    language: str = "Korean"
    instruct: Optional[str] = None  # 감정/스타일 지시 (예: "energetic and friendly")


class TTSResponse(BaseModel):
    success: bool
    message: str
    audio_base64: Optional[str] = None
    sample_rate: Optional[int] = None


def load_model():
    """모델 로딩 (M1 Pro 최적화)"""
    global model, MODEL_LOADED

    if MODEL_LOADED:
        return

    print("[TTS] Loading Qwen3-TTS model...")

    try:
        from qwen_tts import Qwen3TTSModel

        # M1 Pro: MPS 백엔드 사용
        if torch.backends.mps.is_available():
            device = "mps"
            dtype = torch.float32  # MPS는 float32 권장
            print("[TTS] Using MPS (Metal) backend")
        elif torch.cuda.is_available():
            device = "cuda:0"
            dtype = torch.bfloat16
            print("[TTS] Using CUDA backend")
        else:
            device = "cpu"
            dtype = torch.float32
            print("[TTS] Using CPU backend")

        # 0.6B 경량 모델 사용 (M1 Pro에 적합)
        model = Qwen3TTSModel.from_pretrained(
            "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice",
            device_map=device,
            torch_dtype=dtype,
        )

        MODEL_LOADED = True
        print("[TTS] Model loaded successfully!")

    except Exception as e:
        print(f"[TTS] Model loading failed: {e}")
        raise e


@app.on_event("startup")
async def startup_event():
    """서버 시작 시 모델 로딩"""
    try:
        load_model()
    except Exception as e:
        print(f"[TTS] Warning: Model not loaded on startup: {e}")
        print("[TTS] Model will be loaded on first request")


@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {
        "status": "healthy",
        "model_loaded": MODEL_LOADED,
        "device": str(model.device) if model else None,
        "speakers": list(SPEAKERS.keys()),
    }


@app.get("/speakers")
async def get_speakers():
    """지원 스피커 목록"""
    return {"speakers": SPEAKERS}


@app.post("/tts")
async def generate_tts(request: TTSRequest):
    """TTS 생성"""
    global model, MODEL_LOADED

    # 모델 로딩 확인
    if not MODEL_LOADED:
        try:
            load_model()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Model loading failed: {str(e)}")

    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text is required")

    # 스피커 검증
    speaker = request.speaker
    if speaker not in SPEAKERS:
        speaker = "Sohee"  # 기본값

    try:
        print(f"[TTS] Generating: '{request.text[:50]}...' with speaker={speaker}")

        # TTS 생성
        wavs, sr = model.generate_custom_voice(
            text=request.text,
            language=request.language,
            speaker=speaker,
            instruct=request.instruct or "",
        )

        # WAV로 변환
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, wavs[0], sr, format="WAV")
        audio_buffer.seek(0)

        print(f"[TTS] Generated {len(wavs[0])} samples at {sr}Hz")

        # WAV 바이너리 반환
        return Response(
            content=audio_buffer.getvalue(),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=tts_output.wav",
                "X-Sample-Rate": str(sr),
            }
        )

    except Exception as e:
        print(f"[TTS] Generation error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@app.post("/tts/base64")
async def generate_tts_base64(request: TTSRequest):
    """TTS 생성 (Base64 반환)"""
    global model, MODEL_LOADED

    if not MODEL_LOADED:
        try:
            load_model()
        except Exception as e:
            return TTSResponse(success=False, message=f"Model loading failed: {str(e)}")

    if not request.text or len(request.text.strip()) == 0:
        return TTSResponse(success=False, message="Text is required")

    speaker = request.speaker if request.speaker in SPEAKERS else "Sohee"

    try:
        import base64

        wavs, sr = model.generate_custom_voice(
            text=request.text,
            language=request.language,
            speaker=speaker,
            instruct=request.instruct or "",
        )

        # WAV로 변환
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, wavs[0], sr, format="WAV")
        audio_buffer.seek(0)

        # Base64 인코딩
        audio_base64 = base64.b64encode(audio_buffer.getvalue()).decode("utf-8")

        return TTSResponse(
            success=True,
            message="TTS generated successfully",
            audio_base64=audio_base64,
            sample_rate=sr,
        )

    except Exception as e:
        return TTSResponse(success=False, message=f"TTS generation failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("TTS_PORT", 8100))
    print(f"[TTS] Starting server on port {port}...")

    uvicorn.run(app, host="0.0.0.0", port=port)
