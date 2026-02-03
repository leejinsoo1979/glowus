#!/usr/bin/env node
/**
 * GlowUS MCP Server
 *
 * 자비스Claude가 GlowUS를 제어하고, 장기 기억을 관리할 수 있게 해주는 MCP 서버
 *
 * 기능:
 * 1. 메모리 시스템 (FACT/PREFERENCE/SUMMARY 구분)
 * 2. GlowUS 앱 제어 (페이지 이동, 태스크 관리 등)
 * 3. 컨텍스트 조회 (현재 페이지, 프로젝트 상태)
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 (서비스 롤 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[GlowUS MCP] Missing Supabase credentials');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'set' : 'missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 현재 사용자 ID (Claude Code 세션에서 전달받음)
let currentUserId = process.env.GLOWUS_USER_ID || null;

// GlowUS Control API URL
const GLOWUS_API_URL = process.env.GLOWUS_API_URL || 'http://localhost:3000';
const JARVIS_API_SECRET = process.env.JARVIS_API_SECRET || 'jarvis-internal-secret';

// GlowUS Control API 호출 헬퍼
async function callGlowUSControl(action, params = {}) {
  try {
    const response = await fetch(`${GLOWUS_API_URL}/api/jarvis/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        params,
        _userId: currentUserId,
        _secret: JARVIS_API_SECRET,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `API 오류: ${response.status}`);
    }
    return data;
  } catch (error) {
    console.error(`[GlowUS MCP] Control API Error:`, error);
    throw error;
  }
}

// 브라우저에 네비게이션 명령 전송 (Jarvis WebSocket 경유)
const WebSocket = require('ws');
const JARVIS_WS_URL = process.env.JARVIS_WS_URL || 'ws://localhost:3098';

async function sendNavigationCommand(route) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(JARVIS_WS_URL);

      ws.on('open', () => {
        // 브라우저 제어 명령 전송
        ws.send(JSON.stringify({
          type: 'browser_control',
          action: 'navigate',
          route: route,
        }));

        // 즉시 닫기 (fire-and-forget)
        setTimeout(() => {
          ws.close();
          resolve();
        }, 100);
      });

      ws.on('error', (err) => {
        console.error('[GlowUS MCP] WebSocket error:', err);
        reject(err);
      });

      // 타임아웃
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        resolve(); // 타임아웃이어도 성공 처리
      }, 2000);
    } catch (error) {
      console.error('[GlowUS MCP] Navigation command error:', error);
      reject(error);
    }
  });
}

// 워크플로우 빌더 제어 명령 전송
async function sendWorkflowCommand(action, data) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(JARVIS_WS_URL);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'workflow_control',
          action: action,
          ...data,
        }));

        setTimeout(() => {
          ws.close();
          resolve();
        }, 100);
      });

      ws.on('error', (err) => {
        console.error('[GlowUS MCP] Workflow WebSocket error:', err);
        reject(err);
      });

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        resolve();
      }, 2000);
    } catch (error) {
      console.error('[GlowUS MCP] Workflow command error:', error);
      reject(error);
    }
  });
}

// 브라우저에 일반 명령 전송 (AI 시트 등)
async function sendBrowserCommand(action, data) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(JARVIS_WS_URL);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'browser_control',
          action: action,
          data: data,
        }));

        setTimeout(() => {
          ws.close();
          resolve();
        }, 100);
      });

      ws.on('error', (err) => {
        console.error('[GlowUS MCP] Browser command error:', err);
        reject(err);
      });

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        resolve();
      }, 2000);
    } catch (error) {
      console.error('[GlowUS MCP] Browser command error:', error);
      reject(error);
    }
  });
}

// ============================================================
// 팩트 질문 감지
// ============================================================
const FACT_INDICATORS = [
  '뭐였지', '뭐야', '뭐였어', '뭐라고',
  '정확히', '원문', '원본', '그대로',
  '언제', '몇 시', '며칠', '몇 일',
  '누가', '누구', '누굴',
  '얼마', '몇 개', '몇 번',
  '보낸', '받은', '했던', '말했던',
  '기록', '내용', '내역'
];

function isFactQuestion(query) {
  const lowerQuery = query.toLowerCase();
  return FACT_INDICATORS.some(indicator => lowerQuery.includes(indicator));
}

// ============================================================
// MCP 서버 설정
// ============================================================
const server = new Server(
  {
    name: 'glowus-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================
// 도구 목록
// ============================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ==================== 메모리 도구 ====================
      {
        name: 'jarvis_remember',
        description: `정보를 장기 기억에 저장합니다.

memory_type 설명:
- FACT: 사실 정보 (이메일, 미팅 내용, 파일 등). 원본 그대로 저장. 나중에 정확한 정보 조회 시 사용.
- PREFERENCE: 사용자 선호도 (기술 스택, 작업 스타일 등). 추천/제안 시 참고.
- SUMMARY: AI가 생성한 요약. 반드시 어떤 FACT를 기반으로 했는지 명시.

FACT 저장 시 source_type 필수:
- email, meeting, file, chat, task, calendar, manual`,
        inputSchema: {
          type: 'object',
          properties: {
            memory_type: {
              type: 'string',
              enum: ['FACT', 'PREFERENCE', 'SUMMARY'],
              description: '메모리 타입'
            },
            content: {
              type: 'string',
              description: '저장할 내용'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '검색용 태그'
            },
            // FACT 전용
            source_type: {
              type: 'string',
              enum: ['email', 'meeting', 'file', 'chat', 'task', 'calendar', 'manual'],
              description: 'FACT일 때 필수: 정보 출처 타입'
            },
            source_id: {
              type: 'string',
              description: '원본 문서 ID (있으면)'
            },
            // PREFERENCE 전용
            pref_category: {
              type: 'string',
              enum: ['work_style', 'tech_stack', 'communication', 'schedule', 'project', 'other'],
              description: 'PREFERENCE일 때: 카테고리'
            },
            pref_key: {
              type: 'string',
              description: 'PREFERENCE일 때: 키 (예: preferred_framework)'
            },
            pref_value: {
              type: 'string',
              description: 'PREFERENCE일 때: 값 (예: React)'
            },
            // SUMMARY 전용
            based_on: {
              type: 'array',
              items: { type: 'string' },
              description: 'SUMMARY일 때: 참조한 FACT ID들'
            }
          },
          required: ['memory_type', 'content']
        }
      },
      {
        name: 'jarvis_recall',
        description: `장기 기억에서 정보를 검색합니다.

중요:
- "뭐였지", "정확히", "원문" 등이 포함된 질문은 FACT 질문입니다.
- FACT 질문에는 절대 추론하지 마세요. 기록이 없으면 "기록을 찾을 수 없습니다"라고만 답하세요.
- 의견/추천 질문에만 추론을 포함할 수 있고, 이때도 [기록]과 [제 생각]을 구분하세요.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '검색 쿼리'
            },
            memory_type: {
              type: 'string',
              enum: ['FACT', 'PREFERENCE', 'SUMMARY', 'ALL'],
              description: '검색할 메모리 타입 (기본: ALL)'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: '태그 필터'
            },
            source_type: {
              type: 'string',
              description: 'FACT 검색 시 출처 타입 필터'
            },
            limit: {
              type: 'number',
              description: '최대 결과 수 (기본: 10)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'jarvis_forget',
        description: '특정 기억을 삭제합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            memory_id: {
              type: 'string',
              description: '삭제할 메모리 ID'
            }
          },
          required: ['memory_id']
        }
      },
      {
        name: 'jarvis_get_preferences',
        description: '사용자의 선호도 목록을 가져옵니다. 추천/제안 시 참고하세요.',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['work_style', 'tech_stack', 'communication', 'schedule', 'project', 'other'],
              description: '카테고리 필터 (선택)'
            }
          }
        }
      },

      // ==================== GlowUS 앱 제어 ====================
      {
        name: 'glowus_navigate',
        description: `GlowUS 앱에서 페이지를 이동합니다.

사용 가능한 페이지 (path에 아래 키워드 사용):
- dashboard: 대시보드
- works: 작업 공간
- agents: 에이전트 목록
- projects: 프로젝트
- tasks: 태스크
- calendar: 캘린더
- files: 파일
- settings: 설정
- ai-sheet: AI 시트 (스프레드시트)
- ai-docs: AI 문서
- ai-slides: AI 슬라이드
- ai-blog: AI 블로그
- ai-summary: AI 요약
- image-gen: 이미지 생성
- ai-coding: AI 코딩
- messenger: 메신저
- connect: 연결/통합`,
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '이동할 경로'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'glowus_get_context',
        description: '현재 GlowUS 앱 상태를 조회합니다 (현재 페이지, 선택된 프로젝트 등).',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      // ==================== AI 앱 도구 ====================
      {
        name: 'glowus_ai_sheet',
        description: `Google Sheets 스프레드시트를 직접 제어합니다.

actions 배열에 실행할 작업들을 JSON으로 전달하세요.

## 지원하는 액션 타입

1. set_cells - 셀에 값과 서식 설정
   { "type": "set_cells", "data": { "cells": [
     { "row": 0, "col": 0, "value": "제목", "bold": true, "fontSize": 14, "backgroundColor": "#4285f4", "fontColor": "#ffffff", "horizontalAlign": "CENTER" }
   ]}}

2. merge_cells - 셀 병합
   { "type": "merge_cells", "data": { "range": { "startRow": 0, "endRow": 0, "startCol": 0, "endCol": 3 }}}

3. set_row_height - 행 높이 설정
   { "type": "set_row_height", "data": { "row": 0, "height": 40 }}

4. set_col_width - 열 너비 설정
   { "type": "set_col_width", "data": { "col": 0, "width": 150 }}

5. set_borders - 테두리 설정
   { "type": "set_borders", "data": { "range": { "startRow": 0, "endRow": 5, "startCol": 0, "endCol": 3 }, "style": "SOLID", "color": "#000000" }}

## 셀 주소 변환
- A1 → row: 0, col: 0
- B2 → row: 1, col: 1
- C5 → row: 4, col: 2

## 서식 속성
- bold: boolean
- italic: boolean
- fontSize: number (기본 10)
- fontColor: "#RRGGBB"
- backgroundColor: "#RRGGBB"
- horizontalAlign: "LEFT" | "CENTER" | "RIGHT"
- verticalAlign: "TOP" | "MIDDLE" | "BOTTOM"

## 예시: 견적서 헤더
actions: [
  { "type": "merge_cells", "data": { "range": { "startRow": 0, "endRow": 0, "startCol": 0, "endCol": 4 }}},
  { "type": "set_cells", "data": { "cells": [
    { "row": 0, "col": 0, "value": "견 적 서", "bold": true, "fontSize": 20, "horizontalAlign": "CENTER" }
  ]}},
  { "type": "set_row_height", "data": { "row": 0, "height": 50 }}
]`,
        inputSchema: {
          type: 'object',
          properties: {
            actions: {
              type: 'array',
              description: 'Google Sheets 액션 배열',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['set_cells', 'merge_cells', 'set_row_height', 'set_col_width', 'set_borders', 'unmerge_cells']
                  },
                  data: {
                    type: 'object'
                  }
                },
                required: ['type', 'data']
              }
            },
            clearFirst: {
              type: 'boolean',
              description: '작업 전에 시트를 먼저 지울지 여부 (기본: false)'
            }
          },
          required: ['actions']
        }
      },
      {
        name: 'glowus_ai_docs',
        description: `AI 문서에서 문서 작업을 수행합니다.

자연어로 명령하면 문서가 자동으로 생성/편집됩니다.

예시:
- "회의록 작성해줘"
- "프로젝트 제안서 만들어줘"
- "사업계획서 초안 작성해줘"`,
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: '문서 작업 명령 (자연어)'
            }
          },
          required: ['command']
        }
      },
      {
        name: 'glowus_create_task',
        description: '새 태스크를 생성합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: '태스크 제목'
            },
            description: {
              type: 'string',
              description: '태스크 설명'
            },
            project_id: {
              type: 'string',
              description: '프로젝트 ID (선택)'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: '우선순위'
            },
            due_date: {
              type: 'string',
              description: '마감일 (ISO 형식)'
            }
          },
          required: ['title']
        }
      },
      {
        name: 'glowus_list_tasks',
        description: '태스크 목록을 조회합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: {
              type: 'string',
              description: '프로젝트 ID 필터'
            },
            status: {
              type: 'string',
              enum: ['todo', 'in_progress', 'done'],
              description: '상태 필터'
            },
            limit: {
              type: 'number',
              description: '최대 결과 수'
            }
          }
        }
      },
      {
        name: 'glowus_list_projects',
        description: '프로젝트 목록을 조회합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: '최대 결과 수'
            }
          }
        }
      },

      // ==================== 워크플로우 빌더 제어 ====================
      {
        name: 'workflow_add_node',
        description: `워크플로우 빌더에 새 노드를 추가합니다.

사용 가능한 노드 타입:
- trigger: 트리거 (시작점)
- webhook, schedule: 트리거 종류
- input: 데이터 입력
- ai: AI 채팅 (LLM)
- http: HTTP API 요청
- code: JavaScript 코드
- conditional: IF 조건 분기
- loop, delay: 제어 흐름
- process, json, text: 데이터 처리
- notification, slack, telegram, email: 알림
- output: 결과 출력`,
        inputSchema: {
          type: 'object',
          properties: {
            nodeType: { type: 'string', description: '노드 타입' },
            position: {
              type: 'object',
              properties: { x: { type: 'number' }, y: { type: 'number' } },
              description: '노드 위치 (선택)'
            },
            label: { type: 'string', description: '노드 라벨 (선택)' },
            config: { type: 'object', description: '노드 설정 (aiPrompt, httpUrl, code 등)' }
          },
          required: ['nodeType']
        }
      },
      {
        name: 'workflow_remove_node',
        description: '워크플로우 노드를 삭제합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'string', description: '삭제할 노드 ID' }
          },
          required: ['nodeId']
        }
      },
      {
        name: 'workflow_update_node',
        description: '워크플로우 노드 설정을 수정합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            nodeId: { type: 'string', description: '노드 ID' },
            label: { type: 'string', description: '새 라벨' },
            config: { type: 'object', description: '수정할 설정' }
          },
          required: ['nodeId']
        }
      },
      {
        name: 'workflow_connect_nodes',
        description: '두 노드를 연결합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceId: { type: 'string', description: '출발 노드 ID' },
            targetId: { type: 'string', description: '도착 노드 ID' },
            sourceHandle: { type: 'string', description: '출발 핸들 (조건: true/false)' }
          },
          required: ['sourceId', 'targetId']
        }
      },
      {
        name: 'workflow_disconnect_nodes',
        description: '노드 연결을 해제합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            sourceId: { type: 'string', description: '출발 노드 ID' },
            targetId: { type: 'string', description: '도착 노드 ID' }
          },
          required: ['sourceId', 'targetId']
        }
      },
      {
        name: 'workflow_get_state',
        description: '현재 워크플로우 빌더 상태를 조회합니다 (노드 목록, 연결).',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'workflow_clear',
        description: '워크플로우의 모든 노드를 삭제합니다.',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'workflow_execute',
        description: '현재 워크플로우를 실행합니다.',
        inputSchema: {
          type: 'object',
          properties: {
            inputs: { type: 'object', description: '입력 데이터' }
          }
        }
      }
    ]
  };
});

// ============================================================
// 도구 실행
// ============================================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ==================== 메모리 도구 ====================
      case 'jarvis_remember': {
        const {
          memory_type,
          content,
          tags = [],
          source_type,
          source_id,
          pref_category,
          pref_key,
          pref_value,
          based_on
        } = args;

        // FACT일 때 source_type 필수 체크
        if (memory_type === 'FACT' && !source_type) {
          return {
            content: [{ type: 'text', text: '❌ FACT 메모리는 source_type이 필수입니다.' }]
          };
        }

        const insertData = {
          user_id: currentUserId,
          memory_type,
          content,
          tags,
          source_type: memory_type === 'FACT' ? source_type : null,
          source_id: memory_type === 'FACT' ? source_id : null,
          source_timestamp: memory_type === 'FACT' ? new Date().toISOString() : null,
          pref_category: memory_type === 'PREFERENCE' ? pref_category : null,
          pref_key: memory_type === 'PREFERENCE' ? pref_key : null,
          pref_value: memory_type === 'PREFERENCE' ? pref_value : null,
          based_on: memory_type === 'SUMMARY' ? based_on : null,
          generated_by: memory_type === 'SUMMARY' ? 'claude-opus-4-5' : null
        };

        const { data, error } = await supabase
          .from('jarvis_memories')
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        return {
          content: [{
            type: 'text',
            text: `✅ 기억 저장 완료\nID: ${data.id}\n타입: ${memory_type}\n내용: ${content.substring(0, 100)}...`
          }]
        };
      }

      case 'jarvis_recall': {
        const {
          query,
          memory_type = 'ALL',
          tags,
          source_type,
          limit = 10
        } = args;

        const isFactQ = isFactQuestion(query);

        let queryBuilder = supabase
          .from('jarvis_memories')
          .select('*')
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(limit);

        // user_id 필터 (설정된 경우)
        if (currentUserId) {
          queryBuilder = queryBuilder.eq('user_id', currentUserId);
        }

        // 팩트 질문이면 FACT만 검색
        if (isFactQ) {
          queryBuilder = queryBuilder.eq('memory_type', 'FACT');
        } else if (memory_type !== 'ALL') {
          queryBuilder = queryBuilder.eq('memory_type', memory_type);
        }

        if (tags && tags.length > 0) {
          queryBuilder = queryBuilder.overlaps('tags', tags);
        }

        if (source_type) {
          queryBuilder = queryBuilder.eq('source_type', source_type);
        }

        // LIKE 검색
        queryBuilder = queryBuilder.ilike('content', `%${query}%`);

        const { data, error } = await queryBuilder;

        if (error) throw error;

        return formatRecallResponse(data || [], isFactQ, query);
      }

      case 'jarvis_forget': {
        const { memory_id } = args;

        let queryBuilder = supabase
          .from('jarvis_memories')
          .update({ is_deleted: true })
          .eq('id', memory_id);

        if (currentUserId) {
          queryBuilder = queryBuilder.eq('user_id', currentUserId);
        }

        const { error } = await queryBuilder;

        if (error) throw error;

        return {
          content: [{ type: 'text', text: `✅ 기억 삭제 완료: ${memory_id}` }]
        };
      }

      case 'jarvis_get_preferences': {
        const { category } = args;

        let queryBuilder = supabase
          .from('jarvis_memories')
          .select('*')
          .eq('memory_type', 'PREFERENCE')
          .eq('is_deleted', false)
          .order('updated_at', { ascending: false });

        if (currentUserId) {
          queryBuilder = queryBuilder.eq('user_id', currentUserId);
        }

        if (category) {
          queryBuilder = queryBuilder.eq('pref_category', category);
        }

        const { data, error } = await queryBuilder;

        if (error) throw error;

        if (!data || data.length === 0) {
          return {
            content: [{ type: 'text', text: '저장된 선호도가 없습니다.' }]
          };
        }

        const formatted = data.map(p =>
          `• [${p.pref_category}] ${p.pref_key}: ${p.pref_value} (확신도: ${(p.confidence * 100).toFixed(0)}%)`
        ).join('\n');

        return {
          content: [{ type: 'text', text: `📋 사용자 선호도:\n\n${formatted}` }]
        };
      }

      // ==================== GlowUS 앱 제어 ====================
      case 'glowus_navigate': {
        const { path } = args;

        // 페이지 매핑 (API 호출 없이 직접 처리)
        const PAGE_ROUTES = {
          'dashboard': '/dashboard-group',
          'works': '/dashboard-group/works',
          'agents': '/dashboard-group/agents',
          'projects': '/dashboard-group/projects',
          'tasks': '/dashboard-group/tasks',
          'calendar': '/dashboard-group/calendar',
          'files': '/dashboard-group/files',
          'settings': '/dashboard-group/settings',
          'ai-sheet': '/dashboard-group/apps/ai-sheet',
          'ai-docs': '/dashboard-group/apps/ai-docs',
          'ai-slides': '/dashboard-group/apps/ai-slides',
          'ai-blog': '/dashboard-group/apps/ai-blog',
          'ai-summary': '/dashboard-group/apps/ai-summary',
          'image-gen': '/dashboard-group/apps/image-gen',
          'ai-coding': '/dashboard-group/ai-coding',
          'messenger': '/dashboard-group/messenger',
          'connect': '/dashboard-group/connect',
        };

        try {
          let route = path;

          // path가 이미 전체 경로면 그대로 사용
          if (path.startsWith('/dashboard-group')) {
            route = path;
          } else {
            // 페이지 이름에서 라우트 찾기
            const pageName = path.replace(/^\//, '').toLowerCase();
            route = PAGE_ROUTES[pageName];
          }

          if (route) {
            // 브라우저에 네비게이션 명령 전송 (Jarvis WebSocket 경유)
            await sendNavigationCommand(route);

            return {
              content: [{
                type: 'text',
                text: `✅ 페이지 이동 완료: ${route}`
              }]
            };
          }
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ 페이지 이동 실패: ${error.message}`
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: `❌ 알 수 없는 페이지: ${path}\n\n사용 가능한 페이지: ${Object.keys(PAGE_ROUTES).join(', ')}`
          }]
        };
      }

      case 'glowus_get_context': {
        try {
          // Supabase 직접 쿼리 (API 호출 없이)
          const [agentsResult, projectsResult] = await Promise.all([
            supabase.from('deployed_agents').select('id, status', { count: 'exact' }),
            supabase.from('projects').select('id', { count: 'exact' }),
          ]);

          const agentCount = agentsResult.count || 0;
          const activeAgentCount = agentsResult.data?.filter(a => a.status === 'ACTIVE').length || 0;
          const projectCount = projectsResult.count || 0;

          const contextText = `📊 GlowUS 현재 상태:

• 에이전트: ${agentCount}개 (활성: ${activeAgentCount}개)
• 프로젝트: ${projectCount}개

(브라우저 제어: glowus_navigate 도구 사용)`;

          return {
            content: [{
              type: 'text',
              text: contextText
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ 상태 조회 실패: ${error.message}`
            }]
          };
        }
      }

      // ==================== AI 앱 도구 핸들러 ====================
      case 'glowus_ai_sheet': {
        const { actions, clearFirst } = args;

        try {
          if (!actions || !Array.isArray(actions) || actions.length === 0) {
            return {
              content: [{
                type: 'text',
                text: '❌ actions 배열이 필요합니다. 도구 설명의 예시를 참고하세요.'
              }]
            };
          }

          // 1. AI 시트 페이지로 이동
          await sendNavigationCommand('/dashboard-group/apps/ai-sheet');

          // 잠시 대기 (페이지 로드)
          await new Promise(resolve => setTimeout(resolve, 500));

          // 2. 브라우저에 액션 직접 전송 (Grok API 없이!)
          await sendBrowserCommand('ai_sheet_execute', {
            actions: actions,
            clearFirst: clearFirst || false
          });

          // 액션 요약 생성
          const actionSummary = actions.map(a => {
            switch (a.type) {
              case 'set_cells': return `셀 ${a.data?.cells?.length || 0}개 설정`;
              case 'merge_cells': return '셀 병합';
              case 'set_row_height': return `${a.data?.row + 1}행 높이 설정`;
              case 'set_col_width': return `${a.data?.col + 1}열 너비 설정`;
              case 'set_borders': return '테두리 설정';
              default: return a.type;
            }
          }).join(', ');

          return {
            content: [{
              type: 'text',
              text: `✅ AI 시트 작업 완료\n\n실행된 작업 (${actions.length}개): ${actionSummary}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ AI 시트 작업 실패: ${error.message}`
            }]
          };
        }
      }

      case 'glowus_ai_docs': {
        const { command } = args;

        try {
          // AI 문서 페이지로 이동
          await sendNavigationCommand('/dashboard-group/apps/ai-docs');

          // TODO: AI 문서 API 연동 (현재는 페이지 이동만)
          return {
            content: [{
              type: 'text',
              text: `✅ AI 문서 페이지로 이동했습니다.\n\n요청: ${command}\n\n(AI 문서 편집 기능은 개발 중입니다. 직접 입력해주세요.)`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: `❌ AI 문서 작업 실패: ${error.message}`
            }]
          };
        }
      }

      case 'glowus_create_task': {
        const { title, description, project_id, priority = 'medium', due_date } = args;

        const { data, error } = await supabase
          .from('tasks')
          .insert({
            title,
            description,
            project_id,
            priority,
            due_date,
            status: 'todo',
            created_by: currentUserId
          })
          .select()
          .single();

        if (error) throw error;

        return {
          content: [{
            type: 'text',
            text: `✅ 태스크 생성 완료\nID: ${data.id}\n제목: ${title}\n우선순위: ${priority}`
          }]
        };
      }

      case 'glowus_list_tasks': {
        const { project_id, status, limit = 20 } = args;

        let queryBuilder = supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, project_id')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (project_id) {
          queryBuilder = queryBuilder.eq('project_id', project_id);
        }
        if (status) {
          queryBuilder = queryBuilder.eq('status', status);
        }

        const { data, error } = await queryBuilder;

        if (error) throw error;

        if (!data || data.length === 0) {
          return {
            content: [{ type: 'text', text: '태스크가 없습니다.' }]
          };
        }

        const formatted = data.map(t =>
          `• [${t.status}] ${t.title} (${t.priority}${t.due_date ? `, 마감: ${t.due_date}` : ''})`
        ).join('\n');

        return {
          content: [{ type: 'text', text: `📋 태스크 목록:\n\n${formatted}` }]
        };
      }

      case 'glowus_list_projects': {
        const { limit = 20 } = args;

        const { data, error } = await supabase
          .from('projects')
          .select('id, name, description, status')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        if (!data || data.length === 0) {
          return {
            content: [{ type: 'text', text: '프로젝트가 없습니다.' }]
          };
        }

        const formatted = data.map(p =>
          `• [${p.status || 'active'}] ${p.name}${p.description ? `: ${p.description.substring(0, 50)}` : ''}`
        ).join('\n');

        return {
          content: [{ type: 'text', text: `📋 프로젝트 목록:\n\n${formatted}` }]
        };
      }

      // ==================== 워크플로우 빌더 제어 ====================
      case 'workflow_add_node': {
        const { nodeType, position, label, config } = args;

        try {
          // 워크플로우 빌더 페이지로 먼저 이동
          await sendNavigationCommand('/dashboard-group/agent-builder');
          await new Promise(r => setTimeout(r, 300));

          // 브라우저에 노드 추가 명령 전송
          await sendWorkflowCommand('add_node', {
            nodeType,
            position,
            data: { label, ...config }
          });

          return {
            content: [{
              type: 'text',
              text: `✅ 노드 추가 완료: ${nodeType}${label ? ` (${label})` : ''}`
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `❌ 노드 추가 실패: ${error.message}` }]
          };
        }
      }

      case 'workflow_remove_node': {
        const { nodeId } = args;

        try {
          await sendWorkflowCommand('remove_node', { nodeId });

          return {
            content: [{ type: 'text', text: `✅ 노드 삭제 완료: ${nodeId}` }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `❌ 노드 삭제 실패: ${error.message}` }]
          };
        }
      }

      case 'workflow_update_node': {
        const { nodeId, label, config } = args;

        try {
          await sendWorkflowCommand('update_node', {
            nodeId,
            data: { label, ...config }
          });

          return {
            content: [{ type: 'text', text: `✅ 노드 수정 완료: ${nodeId}` }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `❌ 노드 수정 실패: ${error.message}` }]
          };
        }
      }

      case 'workflow_connect_nodes': {
        const { sourceId, targetId, sourceHandle, targetHandle } = args;

        try {
          await sendWorkflowCommand('connect', {
            sourceId,
            targetId,
            sourceHandle,
            targetHandle
          });

          return {
            content: [{ type: 'text', text: `✅ 노드 연결 완료: ${sourceId} → ${targetId}` }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `❌ 노드 연결 실패: ${error.message}` }]
          };
        }
      }

      case 'workflow_disconnect_nodes': {
        const { sourceId, targetId } = args;

        try {
          await sendWorkflowCommand('disconnect', { sourceId, targetId });

          return {
            content: [{ type: 'text', text: `✅ 연결 해제 완료: ${sourceId} → ${targetId}` }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `❌ 연결 해제 실패: ${error.message}` }]
          };
        }
      }

      case 'workflow_get_state': {
        try {
          // TODO: 브라우저에서 현재 상태 조회 (양방향 통신 필요)
          // 일단은 안내 메시지 반환
          return {
            content: [{
              type: 'text',
              text: `📊 워크플로우 상태 조회

현재 브라우저에서 워크플로우 빌더를 열어서 확인해주세요.
경로: /dashboard-group/agent-builder

워크플로우 제어 명령:
- workflow_add_node: 노드 추가
- workflow_remove_node: 노드 삭제
- workflow_connect_nodes: 노드 연결
- workflow_execute: 실행`
            }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `❌ 상태 조회 실패: ${error.message}` }]
          };
        }
      }

      case 'workflow_clear': {
        try {
          await sendWorkflowCommand('clear', {});

          return {
            content: [{ type: 'text', text: `✅ 워크플로우 초기화 완료` }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `❌ 초기화 실패: ${error.message}` }]
          };
        }
      }

      case 'workflow_execute': {
        const { inputs } = args;

        try {
          await sendWorkflowCommand('execute', { inputs });

          return {
            content: [{ type: 'text', text: `✅ 워크플로우 실행 시작` }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `❌ 실행 실패: ${error.message}` }]
          };
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `알 수 없는 도구: ${name}` }]
        };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `❌ 오류: ${error.message}` }],
      isError: true
    };
  }
});

// ============================================================
// 헬퍼 함수
// ============================================================
function formatRecallResponse(memories, isFactQuestion, query) {
  if (memories.length === 0) {
    if (isFactQuestion) {
      return {
        content: [{
          type: 'text',
          text: `❌ 해당 기록을 찾을 수 없습니다.

검색어: "${query}"

⚠️ 이 질문은 정확한 사실을 묻는 것으로 판단됩니다.
기록이 없으므로 추론하지 마세요.`
        }]
      };
    }
    return {
      content: [{ type: 'text', text: '관련 기억을 찾을 수 없습니다.' }]
    };
  }

  const formatted = memories.map(m => {
    const typeEmoji = m.memory_type === 'FACT' ? '📋' :
                      m.memory_type === 'PREFERENCE' ? '⚙️' : '📝';
    const source = m.source_type ? ` [${m.source_type}]` : '';
    const date = new Date(m.created_at).toLocaleDateString('ko-KR');

    return `${typeEmoji}${source} (${date})\n${m.content}`;
  }).join('\n\n---\n\n');

  let response = formatted;

  if (isFactQuestion) {
    response = `📋 [기록 검색 결과]\n\n${formatted}\n\n⚠️ 위 내용은 저장된 기록입니다. 추론을 추가하지 마세요.`;
  }

  return {
    content: [{ type: 'text', text: response }]
  };
}

// ============================================================
// 서버 시작
// ============================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[GlowUS MCP] Server running on stdio');
}

main().catch(console.error);
