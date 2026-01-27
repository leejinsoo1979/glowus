#!/bin/bash
# Qwen3-TTS 서버 시작 스크립트

cd "$(dirname "$0")"

echo "=========================================="
echo "  Qwen3-TTS Server for GlowUS AI Studio"
echo "=========================================="
echo ""

# Python 버전 확인
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Python이 설치되어 있지 않습니다."
    echo "   brew install python3 를 실행하세요."
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version 2>&1)
echo "✅ Python: $PYTHON_VERSION"

# 가상환경 확인/생성
if [ ! -d "venv" ]; then
    echo ""
    echo "📦 가상환경 생성 중..."
    $PYTHON_CMD -m venv venv
fi

# 가상환경 활성화
source venv/bin/activate

# 의존성 설치 확인
if ! python -c "import fastapi" 2>/dev/null; then
    echo ""
    echo "📦 의존성 설치 중..."
    pip install -r requirements.txt
fi

# Qwen3-TTS 설치 확인
if ! python -c "import qwen_tts" 2>/dev/null; then
    echo ""
    echo "📦 Qwen3-TTS 설치 중..."
    cd Qwen3-TTS-main
    pip install -e .
    cd ..
fi

echo ""
echo "🚀 TTS 서버 시작 (포트 8100)..."
echo "   헬스체크: http://localhost:8100/health"
echo "   스피커 목록: http://localhost:8100/speakers"
echo ""

python tts_server.py
