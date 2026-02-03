"use client"

import type { SlideContent } from "../types"
import {
  CoverSlide,
  ProblemSlide,
  SolutionSlide,
  MarketSlide,
  BusinessModelSlide,
  TeamSlide,
  InvestmentSlide,
  ContactSlide,
  ProductSlide,
  CompetitionSlide,
  TractionSlide,
  RoadmapSlide,
  FinancialsSlide,
  DefaultSlide,
  ImportedSlide
} from "./slides"

// Main Slide Renderer
export const SlideRenderer = ({ slide }: { slide: SlideContent }) => {
  // If slide has images, use ImportedSlide renderer
  if (slide.images && slide.images.length > 0) {
    return <ImportedSlide {...slide} />
  }

  switch (slide.type) {
    case 'cover':
      return <CoverSlide {...slide} />
    case 'problem':
      return <ProblemSlide {...slide} />
    case 'solution':
      return <SolutionSlide {...slide} />
    case 'product':
      return <ProductSlide {...slide} />
    case 'market':
      return <MarketSlide {...slide} />
    case 'business-model':
      return <BusinessModelSlide {...slide} />
    case 'competition':
      return <CompetitionSlide {...slide} />
    case 'traction':
      return <TractionSlide {...slide} />
    case 'team':
      return <TeamSlide {...slide} />
    case 'roadmap':
      return <RoadmapSlide {...slide} />
    case 'financials':
      return <FinancialsSlide {...slide} />
    case 'investment':
      return <InvestmentSlide {...slide} />
    case 'contact':
      return <ContactSlide {...slide} />
    default:
      return <DefaultSlide {...slide} type={slide.type} />
  }
}
