/**
 * RAG Retriever for Knowledge Base
 * 지식베이스에서 관련 문서를 검색하여 컨텍스트 생성
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createEmbedding } from './processor'

export interface RetrievedDocument {
  content: string
  metadata: {
    title?: string
    source?: string
    sourceType?: string
    chunkIndex?: number
    [key: string]: any
  }
  similarity: number
}

export interface RAGContext {
  documents: RetrievedDocument[]
  contextText: string
  sourcesUsed: string[]
}

/**
 * 시맨틱 검색으로 관련 문서 검색
 */
export async function searchDocuments(
  agentId: string,
  query: string,
  options?: {
    limit?: number
    threshold?: number
  }
): Promise<RetrievedDocument[]> {
  try {
    const adminClient = createAdminClient()
    const collectionId = `agent-${agentId}`

    // 쿼리 임베딩 생성
    const queryEmbedding = await createEmbedding(query)

    if (queryEmbedding.length === 0) {
      console.warn('[RAG] Empty embedding, falling back to text search')
      return fallbackTextSearch(agentId, query, options?.limit || 5)
    }

    // 벡터 유사도 검색 (RPC 함수 사용)
    const { data, error } = await (adminClient as any).rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: options?.threshold || 0.5,
      match_count: options?.limit || 5,
      filter_collection: collectionId,
    })

    if (error) {
      console.error('[RAG] Search error:', error)
      return fallbackTextSearch(agentId, query, options?.limit || 5)
    }

    return (data || []).map((doc: any) => ({
      content: doc.content,
      metadata: doc.metadata || {},
      similarity: doc.similarity,
    }))
  } catch (error) {
    console.error('[RAG] Search error:', error)
    return []
  }
}

/**
 * 폴백: 텍스트 검색 (임베딩 실패 시)
 */
async function fallbackTextSearch(
  agentId: string,
  query: string,
  limit: number
): Promise<RetrievedDocument[]> {
  try {
    const adminClient = createAdminClient()
    const collectionId = `agent-${agentId}`

    // 키워드 기반 검색
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)

    const { data, error } = await (adminClient as any)
      .from('document_embeddings')
      .select('content, metadata')
      .eq('collection_id', collectionId)
      .limit(limit * 3) // 더 많이 가져와서 필터링

    if (error || !data) {
      return []
    }

    // 키워드 매칭으로 점수 계산
    const scored = data
      .map((doc: any) => {
        const contentLower = doc.content.toLowerCase()
        const matches = keywords.filter((k) => contentLower.includes(k)).length
        return {
          ...doc,
          similarity: matches / keywords.length,
        }
      })
      .filter((doc: any) => doc.similarity > 0)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit)

    return scored.map((doc: any) => ({
      content: doc.content,
      metadata: doc.metadata || {},
      similarity: doc.similarity,
    }))
  } catch (error) {
    console.error('[RAG] Fallback search error:', error)
    return []
  }
}

/**
 * RAG 컨텍스트 생성 (채팅에 주입할 형태)
 */
export async function getRAGContext(
  agentId: string,
  query: string,
  options?: {
    maxTokens?: number
    maxDocuments?: number
  }
): Promise<RAGContext> {
  const maxDocs = options?.maxDocuments || 5
  const maxTokens = options?.maxTokens || 2000

  // 관련 문서 검색
  const documents = await searchDocuments(agentId, query, {
    limit: maxDocs,
    threshold: 0.5,
  })

  if (documents.length === 0) {
    return {
      documents: [],
      contextText: '',
      sourcesUsed: [],
    }
  }

  // 컨텍스트 텍스트 생성 (토큰 제한 고려)
  let contextText = ''
  let currentLength = 0
  const sourcesUsed: string[] = []
  const includedDocs: RetrievedDocument[] = []

  for (const doc of documents) {
    const docText = `[출처: ${doc.metadata.title || '문서'}]\n${doc.content}\n\n`

    if (currentLength + docText.length > maxTokens * 4) {
      // 대략적인 토큰 추정 (1토큰 ≈ 4자)
      break
    }

    contextText += docText
    currentLength += docText.length
    includedDocs.push(doc)

    const source = doc.metadata.title || doc.metadata.source || '문서'
    if (!sourcesUsed.includes(source)) {
      sourcesUsed.push(source)
    }
  }

  return {
    documents: includedDocs,
    contextText: contextText.trim(),
    sourcesUsed,
  }
}

/**
 * 에이전트 시스템 프롬프트에 RAG 컨텍스트 주입
 */
export function injectRAGContext(
  systemPrompt: string,
  ragContext: RAGContext
): string {
  if (!ragContext.contextText) {
    return systemPrompt
  }

  const ragSection = `

## 지식베이스 (Knowledge Base)
아래는 당신이 알고 있는 관련 지식입니다. 이 정보를 활용하여 답변하세요.
모르는 내용은 "지식베이스에 해당 정보가 없습니다"라고 답하고, 지식베이스 내용을 기반으로 답변할 때는 출처를 언급하세요.

---
${ragContext.contextText}
---

위 지식베이스를 참고하여 사용자 질문에 답변하세요.`

  return systemPrompt + ragSection
}

/**
 * 에이전트에 지식이 있는지 확인
 */
export async function hasKnowledge(agentId: string): Promise<boolean> {
  try {
    const adminClient = createAdminClient()
    const collectionId = `agent-${agentId}`

    const { count, error } = await (adminClient as any)
      .from('document_embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('collection_id', collectionId)

    if (error) {
      return false
    }

    return (count || 0) > 0
  } catch {
    return false
  }
}

/**
 * 에이전트 지식베이스 통계
 */
export async function getKnowledgeStats(agentId: string): Promise<{
  documentCount: number
  chunkCount: number
  lastUpdated: string | null
}> {
  try {
    const adminClient = createAdminClient()
    const collectionId = `agent-${agentId}`

    // 청크 수
    const { count: chunkCount, error: chunkError } = await (adminClient as any)
      .from('document_embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('collection_id', collectionId)

    if (chunkError) {
      return { documentCount: 0, chunkCount: 0, lastUpdated: null }
    }

    // 문서 수 (고유한 document_id 수)
    const { data, error } = await (adminClient as any)
      .from('document_embeddings')
      .select('metadata, created_at')
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: false })
      .limit(1)

    const uniqueDocIds = new Set<string>()
    const { data: allDocs } = await (adminClient as any)
      .from('document_embeddings')
      .select('metadata')
      .eq('collection_id', collectionId)

    for (const row of allDocs || []) {
      const docId = row.metadata?.document_id
      if (docId) {
        uniqueDocIds.add(docId)
      }
    }

    return {
      documentCount: uniqueDocIds.size,
      chunkCount: chunkCount || 0,
      lastUpdated: data?.[0]?.created_at || null,
    }
  } catch {
    return { documentCount: 0, chunkCount: 0, lastUpdated: null }
  }
}
