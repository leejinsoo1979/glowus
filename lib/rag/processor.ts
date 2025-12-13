/**
 * Document Processor for Knowledge Base
 * 문서를 청킹하고 임베딩을 생성하여 벡터 DB에 저장
 */

import { createAdminClient } from '@/lib/supabase/admin'

// 청킹 설정
const DEFAULT_CHUNK_SIZE = 1000
const DEFAULT_CHUNK_OVERLAP = 200

// 지원하는 파일 타입
export type SupportedFileType = 'text' | 'markdown' | 'pdf' | 'url'

export interface DocumentChunk {
  content: string
  metadata: {
    source: string
    sourceType: SupportedFileType
    chunkIndex: number
    totalChunks: number
    title?: string
    [key: string]: any
  }
}

export interface ProcessedDocument {
  chunks: DocumentChunk[]
  metadata: {
    title: string
    source: string
    sourceType: SupportedFileType
    totalChunks: number
    totalCharacters: number
    processedAt: string
  }
}

/**
 * 텍스트를 청크로 분할
 */
export function splitTextIntoChunks(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  chunkOverlap: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  const chunks: string[] = []

  // 문단 단위로 먼저 분할
  const paragraphs = text.split(/\n\n+/)

  let currentChunk = ''

  for (const paragraph of paragraphs) {
    // 문단이 청크 크기보다 크면 문장 단위로 분할
    if (paragraph.length > chunkSize) {
      // 현재 청크 저장
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }

      // 긴 문단을 문장 단위로 분할
      const sentences = paragraph.split(/(?<=[.!?])\s+/)
      let sentenceChunk = ''

      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length > chunkSize) {
          if (sentenceChunk.trim()) {
            chunks.push(sentenceChunk.trim())
          }
          // 오버랩 적용
          const words = sentenceChunk.split(' ')
          const overlapWords = words.slice(-Math.floor(chunkOverlap / 5))
          sentenceChunk = overlapWords.join(' ') + ' ' + sentence
        } else {
          sentenceChunk += (sentenceChunk ? ' ' : '') + sentence
        }
      }

      if (sentenceChunk.trim()) {
        currentChunk = sentenceChunk
      }
    } else {
      // 청크에 문단 추가
      if ((currentChunk + '\n\n' + paragraph).length > chunkSize) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim())
        }
        // 오버랩 적용
        const words = currentChunk.split(' ')
        const overlapWords = words.slice(-Math.floor(chunkOverlap / 5))
        currentChunk = overlapWords.join(' ') + '\n\n' + paragraph
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
      }
    }
  }

  // 마지막 청크 저장
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * OpenAI 임베딩 생성
 */
export async function createEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set, returning empty embedding')
    return []
  }

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000), // 토큰 제한
      }),
    })

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`)
    }

    const data = await res.json()
    return data.data?.[0]?.embedding || []
  } catch (error) {
    console.error('Embedding creation failed:', error)
    return []
  }
}

/**
 * 문서 처리 (텍스트 → 청크 → 임베딩 → DB 저장)
 */
export async function processDocument(
  content: string,
  options: {
    agentId: string
    title: string
    source: string
    sourceType: SupportedFileType
    chunkSize?: number
    chunkOverlap?: number
    metadata?: Record<string, any>
  }
): Promise<{ success: boolean; documentId?: string; chunksCount?: number; error?: string }> {
  try {
    const adminClient = createAdminClient()

    // 1. 컬렉션 ID 생성 (agent별 지식베이스)
    const collectionId = `agent-${options.agentId}`

    // 2. 컬렉션 확인/생성
    const { data: existingCollection } = await (adminClient as any)
      .from('rag_collections')
      .select('id')
      .eq('id', collectionId)
      .single()

    if (!existingCollection) {
      await (adminClient as any).from('rag_collections').insert({
        id: collectionId,
        name: `Agent ${options.agentId} Knowledge Base`,
        description: '에이전트 지식베이스',
        settings: {
          chunk_size: options.chunkSize || DEFAULT_CHUNK_SIZE,
          chunk_overlap: options.chunkOverlap || DEFAULT_CHUNK_OVERLAP,
        },
      })
    }

    // 3. 텍스트 청킹
    const chunks = splitTextIntoChunks(
      content,
      options.chunkSize || DEFAULT_CHUNK_SIZE,
      options.chunkOverlap || DEFAULT_CHUNK_OVERLAP
    )

    console.log(`[RAG] Processing ${chunks.length} chunks for "${options.title}"`)

    // 4. 문서 ID 생성
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // 5. 각 청크에 대해 임베딩 생성 및 저장
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = await createEmbedding(chunk)

      const chunkMetadata = {
        document_id: documentId,
        agent_id: options.agentId,
        title: options.title,
        source: options.source,
        source_type: options.sourceType,
        chunk_index: i,
        total_chunks: chunks.length,
        ...options.metadata,
      }

      // DB에 저장
      const { error } = await (adminClient as any).from('document_embeddings').insert({
        collection_id: collectionId,
        content: chunk,
        metadata: chunkMetadata,
        embedding: embedding.length > 0 ? embedding : null,
      })

      if (error) {
        console.error(`[RAG] Failed to save chunk ${i}:`, error)
      }
    }

    // 6. 컬렉션 문서 수 업데이트
    await (adminClient as any)
      .from('rag_collections')
      .update({
        document_count: (adminClient as any).rpc('increment', { x: 1 }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', collectionId)

    console.log(`[RAG] Successfully processed document: ${documentId}`)

    return {
      success: true,
      documentId,
      chunksCount: chunks.length,
    }
  } catch (error) {
    console.error('[RAG] Document processing error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * URL에서 콘텐츠 가져오기
 */
export async function fetchUrlContent(url: string): Promise<{ content: string; title: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StartupShowBot/1.0)',
      },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch URL: ${res.status}`)
    }

    const html = await res.text()

    // 간단한 HTML → 텍스트 변환
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || url
    const content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return { content, title }
  } catch (error) {
    console.error('[RAG] URL fetch error:', error)
    return null
  }
}

/**
 * 에이전트의 문서 목록 조회
 */
export async function getAgentDocuments(agentId: string): Promise<any[]> {
  try {
    const adminClient = createAdminClient()
    const collectionId = `agent-${agentId}`

    // 문서별로 그룹화하여 조회
    const { data, error } = await (adminClient as any)
      .from('document_embeddings')
      .select('metadata, created_at')
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[RAG] Get documents error:', error)
      return []
    }

    // 문서 ID별로 그룹화
    const documentsMap = new Map<string, any>()

    for (const row of data || []) {
      const docId = row.metadata?.document_id
      if (docId && !documentsMap.has(docId)) {
        documentsMap.set(docId, {
          id: docId,
          title: row.metadata?.title || 'Untitled',
          source: row.metadata?.source || '',
          sourceType: row.metadata?.source_type || 'text',
          chunksCount: row.metadata?.total_chunks || 1,
          createdAt: row.created_at,
        })
      }
    }

    return Array.from(documentsMap.values())
  } catch (error) {
    console.error('[RAG] Get documents error:', error)
    return []
  }
}

/**
 * 문서 삭제
 */
export async function deleteDocument(agentId: string, documentId: string): Promise<boolean> {
  try {
    const adminClient = createAdminClient()
    const collectionId = `agent-${agentId}`

    const { error } = await (adminClient as any)
      .from('document_embeddings')
      .delete()
      .eq('collection_id', collectionId)
      .filter('metadata->document_id', 'eq', documentId)

    if (error) {
      console.error('[RAG] Delete document error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[RAG] Delete document error:', error)
    return false
  }
}
