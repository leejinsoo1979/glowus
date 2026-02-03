"use client"

import { FileText } from "lucide-react"
import type { ResearchDoc } from "../types"

interface ResearchPanelProps {
    researchDoc: ResearchDoc | null
}

export const ResearchPanel = ({ researchDoc }: ResearchPanelProps) => {
    if (!researchDoc) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <FileText className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                    <p className="text-zinc-500">슬라이드 생성 시 리서치 문서가 여기에 표시됩니다.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* 분석 결과 */}
                {researchDoc.analysis && (
                    <AnalysisSection analysis={researchDoc.analysis} />
                )}

                {/* 리서치 문서 */}
                {researchDoc.research && (
                    <ResearchSection research={researchDoc.research} />
                )}

                {/* 목차 구조 */}
                {researchDoc.outline && (
                    <OutlineSection outline={researchDoc.outline} />
                )}
            </div>
        </div>
    )
}

// Sub-components

const AnalysisSection = ({ analysis }: { analysis: NonNullable<ResearchDoc['analysis']> }) => (
    <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">1</span>
            사업 분석
        </h3>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <p className="text-xs text-zinc-500 mb-1">사업 유형</p>
                <p className="text-sm font-medium text-zinc-900">{analysis.businessType}</p>
            </div>
            <div>
                <p className="text-xs text-zinc-500 mb-1">산업 분야</p>
                <p className="text-sm font-medium text-zinc-900">{analysis.industry}</p>
            </div>
            <div>
                <p className="text-xs text-zinc-500 mb-1">목표 시장</p>
                <p className="text-sm font-medium text-zinc-900">{analysis.targetMarket}</p>
            </div>
            <div>
                <p className="text-xs text-zinc-500 mb-1">투자 단계</p>
                <span className="px-2 py-0.5 bg-accent/10 text-accent rounded text-xs font-semibold">{analysis.stage}</span>
            </div>
            <div className="col-span-2">
                <p className="text-xs text-zinc-500 mb-1">핵심 가치</p>
                <p className="text-sm font-medium text-zinc-900">{analysis.coreValue}</p>
            </div>
            <div>
                <p className="text-xs text-zinc-500 mb-1">경쟁사</p>
                <div className="flex flex-wrap gap-1">
                    {analysis.competitors?.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded text-xs">{c}</span>
                    ))}
                </div>
            </div>
            <div>
                <p className="text-xs text-zinc-500 mb-1">차별화 포인트</p>
                <div className="flex flex-wrap gap-1">
                    {analysis.uniquePoints?.map((p, i) => (
                        <span key={i} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{p}</span>
                    ))}
                </div>
            </div>
        </div>
    </div>
)

const ResearchSection = ({ research }: { research: NonNullable<ResearchDoc['research']> }) => (
    <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-sm font-bold">2</span>
            심층 리서치
        </h3>
        <div className="space-y-4">
            {/* TAM/SAM/SOM 시장 규모 */}
            <div className="grid grid-cols-3 gap-3">
                {research.tam && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-semibold">TAM</p>
                        <p className="text-lg font-bold text-blue-800">{research.tam.value}</p>
                        <p className="text-xs text-blue-600 mt-1">{research.tam.description}</p>
                    </div>
                )}
                {research.sam && (
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                        <p className="text-xs text-green-600 font-semibold">SAM</p>
                        <p className="text-lg font-bold text-green-800">{research.sam.value}</p>
                        <p className="text-xs text-green-600 mt-1">{research.sam.description}</p>
                    </div>
                )}
                {research.som && (
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                        <p className="text-xs text-orange-600 font-semibold">SOM</p>
                        <p className="text-lg font-bold text-orange-800">{research.som.value}</p>
                        <p className="text-xs text-orange-600 mt-1">{research.som.description}</p>
                    </div>
                )}
            </div>

            {research.cagr && (
                <div className="text-center">
                    <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-1.5 rounded-full text-sm font-semibold">
                        연평균 성장률 (CAGR): {research.cagr}
                    </span>
                </div>
            )}

            {/* 시장 트렌드 */}
            {research.marketTrend && (
                <div>
                    <p className="text-xs text-zinc-500 mb-2">시장 트렌드</p>
                    <div className="flex flex-wrap gap-2">
                        {research.marketTrend.map((trend, i) => (
                            <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">{trend}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* 목표 고객 */}
            {research.targetCustomer && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                    <p className="text-xs text-zinc-500 mb-2 font-semibold">목표 고객</p>
                    <p className="text-sm font-medium text-zinc-900 mb-2">{research.targetCustomer.persona}</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-red-500 mb-1">Pain Points</p>
                            <ul className="space-y-1">
                                {research.targetCustomer.painPoints?.map((p, i) => (
                                    <li key={i} className="text-xs text-zinc-700">• {p}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <p className="text-xs text-green-500 mb-1">Needs</p>
                            <ul className="space-y-1">
                                {research.targetCustomer.needs?.map((n, i) => (
                                    <li key={i} className="text-xs text-zinc-700">• {n}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* 경쟁 환경 */}
            {research.competitiveLandscape && (
                <div>
                    <p className="text-xs text-zinc-500 mb-2">경쟁 환경</p>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                            <p className="text-xs text-zinc-400 mb-1">직접 경쟁사</p>
                            <div className="flex flex-wrap gap-1">
                                {research.competitiveLandscape.direct?.map((c, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">{c}</span>
                                ))}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-zinc-400 mb-1">간접 경쟁사</p>
                            <div className="flex flex-wrap gap-1">
                                {research.competitiveLandscape.indirect?.map((c, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">{c}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                        <p className="text-xs text-green-600 font-semibold mb-1">우리의 경쟁 우위</p>
                        <p className="text-sm text-zinc-900">{research.competitiveLandscape.ourAdvantage}</p>
                    </div>
                </div>
            )}
        </div>
    </div>
)

const OutlineSection = ({ outline }: { outline: NonNullable<ResearchDoc['outline']> }) => (
    <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center text-sm font-bold">3</span>
            목차 구조
        </h3>
        <p className="text-xl font-bold text-zinc-900 mb-2">{outline.title}</p>
        {outline.subtitle && (
            <p className="text-sm text-zinc-500 mb-4">{outline.subtitle}</p>
        )}
        <div className="space-y-2">
            {outline.sections?.map((section, i) => (
                <div key={section.id} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg">
                    <span className="w-6 h-6 bg-zinc-200 text-zinc-600 rounded flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="font-medium text-zinc-900 text-sm">{section.title}</p>
                            <span className="px-1.5 py-0.5 bg-accent/10 text-accent rounded text-xs">{section.type}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{section.description}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
)
