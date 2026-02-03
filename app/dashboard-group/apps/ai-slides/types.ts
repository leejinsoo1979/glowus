// Slide Types for AI Slides App

export interface SlideImage {
  id: string
  dataUrl: string
  width?: number
  height?: number
  x?: number
  y?: number
}

export interface SlideContent {
  id: string
  type: 'cover' | 'content' | 'problem' | 'solution' | 'market' | 'business-model' | 'product' | 'competition' | 'traction' | 'gtm' | 'marketing' | 'team' | 'roadmap' | 'revenue' | 'financials' | 'investment' | 'contact'
  title: string
  subtitle?: string
  content: any
  images?: SlideImage[]
  backgroundColor?: string
}

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  type?: 'question' | 'progress' | 'complete' | 'edit'
  slideIndex?: number
}

export interface TodoItem {
  id: string
  text: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface SavedPresentation {
  id: string
  title: string
  slides: SlideContent[]
  createdAt: Date
  updatedAt: Date
}

// 소스 파일 (NotebookLM 스타일)
export interface SourceFile {
  id: string
  name: string
  type: 'pptx' | 'pdf' | 'text' | 'url'
  extractedText: string
  uploadedAt: Date
  slideCount?: number  // PPTX/PDF의 경우
}

// 리서치 문서 타입
export interface ResearchDoc {
  analysis?: {
    businessType: string
    industry: string
    targetMarket: string
    coreValue: string
    competitors: string[]
    uniquePoints: string[]
    stage: string
  }
  research?: {
    tam: { value: string; description: string }
    sam: { value: string; description: string }
    som: { value: string; description: string }
    cagr: string
    marketTrend: string[]
    targetCustomer: {
      persona: string
      painPoints: string[]
      needs: string[]
    }
    competitiveLandscape: {
      direct: string[]
      indirect: string[]
      ourAdvantage: string
    }
  }
  outline?: {
    title: string
    subtitle?: string
    sections: { id: string; type: string; title: string; description: string }[]
  }
}

// 슬라이드 컴포넌트 공통 Props
export interface SlideProps {
  content: any
  title: string
  subtitle?: string
  images?: SlideImage[]
  backgroundColor?: string
}
