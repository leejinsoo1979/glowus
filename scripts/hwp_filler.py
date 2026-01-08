#!/usr/bin/env python3
"""
HWP 템플릿 필러 - olefile 기반
원본 HWP 파일의 누름틀(필드)에 데이터를 채워넣음
"""

import olefile
import zlib
import struct
import json
import sys
import os
import re
from io import BytesIO

def decompress_stream(data: bytes) -> bytes:
    """HWP 스트림 압축 해제"""
    try:
        return zlib.decompress(data, -15)
    except:
        return data

def compress_stream(data: bytes) -> bytes:
    """HWP 스트림 압축"""
    compressor = zlib.compressobj(level=9, wbits=-15)
    compressed = compressor.compress(data)
    compressed += compressor.flush()
    return compressed

def read_hwp_structure(hwp_path: str) -> dict:
    """HWP 파일 구조 읽기"""
    ole = olefile.OleFileIO(hwp_path)

    result = {
        'streams': [],
        'file_header': None,
        'doc_info': None,
        'body_text': {},
        'fields': []
    }

    for stream in ole.listdir():
        stream_path = '/'.join(stream)
        result['streams'].append(stream_path)

        if stream_path == 'FileHeader':
            result['file_header'] = ole.openstream(stream).read()
        elif stream_path == 'DocInfo':
            data = ole.openstream(stream).read()
            result['doc_info'] = decompress_stream(data)
        elif stream_path.startswith('BodyText/Section'):
            data = ole.openstream(stream).read()
            result['body_text'][stream_path] = decompress_stream(data)

    ole.close()
    return result

def find_text_in_section(section_data: bytes) -> list:
    """섹션에서 텍스트 찾기"""
    texts = []
    # HWP 텍스트는 UTF-16LE로 인코딩됨
    try:
        # 간단한 텍스트 추출 (실제로는 레코드 구조를 파싱해야 함)
        decoded = section_data.decode('utf-16le', errors='ignore')
        # 누름틀 필드 찾기: {{필드명}} 형식
        fields = re.findall(r'\{\{([^}]+)\}\}', decoded)
        texts.extend(fields)
    except:
        pass
    return texts

def replace_text_in_section(section_data: bytes, replacements: dict) -> bytes:
    """섹션에서 텍스트 치환"""
    try:
        # UTF-16LE로 디코딩
        text = section_data.decode('utf-16le', errors='ignore')

        # 치환 수행
        for field, value in replacements.items():
            # {{필드명}} 형식 치환
            pattern = r'\{\{' + re.escape(field) + r'\}\}'
            text = re.sub(pattern, value, text)

        # 다시 UTF-16LE로 인코딩
        return text.encode('utf-16le')
    except Exception as e:
        print(f"치환 오류: {e}")
        return section_data

def fill_hwp_template(template_path: str, output_path: str, data: dict) -> bool:
    """HWP 템플릿에 데이터 채우기"""
    try:
        # 원본 파일을 바이트로 읽기
        with open(template_path, 'rb') as f:
            original_bytes = f.read()

        # OLE 파일 열기
        ole = olefile.OleFileIO(template_path)

        # 새 OLE 파일 생성을 위한 데이터 수집
        streams_data = {}

        for stream in ole.listdir():
            stream_path = '/'.join(stream)
            stream_data = ole.openstream(stream).read()

            # BodyText 섹션만 수정
            if stream_path.startswith('BodyText/Section'):
                # 압축 해제
                decompressed = decompress_stream(stream_data)

                # 텍스트 치환
                modified = replace_text_in_section(decompressed, data)

                # 다시 압축
                streams_data[stream_path] = compress_stream(modified)
            else:
                streams_data[stream_path] = stream_data

        ole.close()

        # 새 HWP 파일 생성 (OLE compound 파일)
        # olefile은 쓰기를 지원하지 않으므로, 직접 구현하거나 다른 방법 필요

        # 임시 해결책: 원본 복사 후 바이너리 치환
        with open(template_path, 'rb') as f:
            content = f.read()

        # 바이너리에서 직접 텍스트 치환 (UTF-16LE)
        for field, value in data.items():
            # {{필드명}} 패턴을 UTF-16LE로 인코딩해서 검색
            pattern_bytes = ('{{' + field + '}}').encode('utf-16le')
            value_bytes = str(value).encode('utf-16le')

            if pattern_bytes in content:
                content = content.replace(pattern_bytes, value_bytes)
                print(f"  치환됨: {field}")

        # 결과 저장
        with open(output_path, 'wb') as f:
            f.write(content)

        print(f"HWP 생성 완료: {output_path}")
        return True

    except Exception as e:
        print(f"오류: {e}")
        import traceback
        traceback.print_exc()
        return False

def analyze_hwp_fields(hwp_path: str):
    """HWP 파일의 필드 분석"""
    print(f"\n=== HWP 분석: {hwp_path} ===\n")

    structure = read_hwp_structure(hwp_path)

    print(f"스트림 목록:")
    for s in structure['streams']:
        print(f"  - {s}")

    print(f"\n본문 섹션:")
    all_fields = []
    for section_path, data in structure['body_text'].items():
        print(f"\n  {section_path} ({len(data)} bytes)")
        fields = find_text_in_section(data)
        if fields:
            print(f"    필드: {fields}")
            all_fields.extend(fields)

        # 텍스트 미리보기
        try:
            preview = data[:500].decode('utf-16le', errors='ignore')
            # 제어문자 제거
            preview = ''.join(c for c in preview if c.isprintable() or c in '\n\t')
            if preview.strip():
                print(f"    미리보기: {preview[:200]}...")
        except:
            pass

    return all_fields

def main():
    if len(sys.argv) < 2:
        print("사용법:")
        print("  분석: python hwp_filler.py analyze <hwp_path>")
        print("  생성: python hwp_filler.py fill <template_path> <output_path> <data_json_path>")
        sys.exit(1)

    command = sys.argv[1]

    if command == 'analyze':
        if len(sys.argv) < 3:
            print("HWP 파일 경로를 지정하세요")
            sys.exit(1)
        analyze_hwp_fields(sys.argv[2])

    elif command == 'fill':
        if len(sys.argv) < 5:
            print("모든 인자를 지정하세요: template_path, output_path, data_json_path")
            sys.exit(1)

        template_path = sys.argv[2]
        output_path = sys.argv[3]
        data_json_path = sys.argv[4]

        with open(data_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        print(f"템플릿: {template_path}")
        print(f"출력: {output_path}")
        print(f"데이터: {data}")

        success = fill_hwp_template(template_path, output_path, data)
        sys.exit(0 if success else 1)

    else:
        print(f"알 수 없는 명령: {command}")
        sys.exit(1)

if __name__ == '__main__':
    main()
