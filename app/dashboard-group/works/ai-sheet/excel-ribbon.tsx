"use client"

import { useState, useRef, useEffect } from "react"
import {
    Undo2,
    Redo2,
    Scissors,
    Copy,
    ClipboardPaste,
    Paintbrush,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignVerticalJustifyStart,
    AlignVerticalJustifyCenter,
    AlignVerticalJustifyEnd,
    ChevronDown,
    Plus,
    Trash2,
    Filter,
    Search,
    Table,
    Grid3X3,
    Settings,
    Type,
    Palette,
    Square,
    Sigma,
    WrapText,
    Columns,
    LayoutGrid,
    FileSpreadsheet,
    Eraser,
    ArrowDownAZ,
    ArrowUpAZ,
    Sparkles,
    Check,
    X,
    TableProperties,
    PaintBucket,
    MoreHorizontal
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ExcelRibbonProps {
    onAction: (action: string, data?: any) => void
}

type TabType = "홈" | "삽입" | "페이지 레이아웃" | "수식" | "데이터" | "보기" | "설정"

export default function ExcelRibbon({ onAction }: ExcelRibbonProps) {
    const [activeTab, setActiveTab] = useState<TabType>("홈")
    const [fontFamily, setFontFamily] = useState("Calibri")
    const [fontSize, setFontSize] = useState("11")
    const [cellRef, setCellRef] = useState("A1")
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const tabs: TabType[] = ["홈", "삽입", "페이지 레이아웃", "수식", "데이터", "보기", "설정"]

    // 드롭다운 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(null)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const toggleDropdown = (id: string) => {
        setOpenDropdown(openDropdown === id ? null : id)
    }

    // 그룹 구분선
    const GroupDivider = () => (
        <div className="w-px bg-gray-300 mx-2 self-stretch" />
    )

    // 그룹 컨테이너
    const RibbonGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <div className="flex flex-col h-[90px]">
            <div className="flex items-start gap-1 px-3 pt-2 flex-1">
                {children}
            </div>
            <div className="text-[11px] text-gray-600 text-center py-1.5 border-t border-gray-200">
                {title}
            </div>
        </div>
    )

    // 드롭다운 메뉴 아이템
    const DropdownItem = ({
        icon: Icon,
        label,
        onClick,
        shortcut
    }: {
        icon?: any
        label: string
        onClick?: () => void
        shortcut?: string
    }) => (
        <button
            onClick={() => {
                onClick?.()
                setOpenDropdown(null)
            }}
            className="flex items-center gap-3 w-full px-3 py-2 hover:bg-blue-50 text-left text-[12px] text-gray-700"
        >
            {Icon && <Icon className="w-4 h-4 text-gray-600" />}
            <span className="flex-1">{label}</span>
            {shortcut && <span className="text-gray-400 text-[11px]">{shortcut}</span>}
        </button>
    )

    // 큰 드롭다운 버튼 (조건부 서식, 표 서식 등)
    const LargeDropdownButton = ({
        id,
        icon: Icon,
        label,
        iconColor = "text-gray-700",
        children,
        selected = false
    }: {
        id: string
        icon: any
        label: string
        iconColor?: string
        children?: React.ReactNode
        selected?: boolean
    }) => {
        const isOpen = openDropdown === id
        return (
            <div className="relative" ref={isOpen ? dropdownRef : undefined}>
                <button
                    onClick={() => toggleDropdown(id)}
                    className={cn(
                        "flex flex-col items-center justify-center px-3 py-1.5 rounded min-w-[60px] h-[62px] border-2 transition-all",
                        selected
                            ? "border-green-500 bg-green-50"
                            : isOpen
                                ? "border-blue-400 bg-blue-50"
                                : "border-transparent hover:bg-gray-100 hover:border-gray-300"
                    )}
                >
                    <Icon className={cn("w-7 h-7 mb-1", iconColor)} />
                    <span className="text-[11px] text-gray-700 flex items-center gap-0.5">
                        {label}
                        <ChevronDown className="w-3 h-3" />
                    </span>
                </button>
                {isOpen && children && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] py-1">
                        {children}
                    </div>
                )}
            </div>
        )
    }

    // 작은 아이콘 버튼
    const SmallIconButton = ({
        icon: Icon,
        title,
        onClick,
        active = false,
        iconColor = "text-gray-700"
    }: {
        icon: any
        title: string
        onClick?: () => void
        active?: boolean
        iconColor?: string
    }) => (
        <button
            onClick={onClick}
            title={title}
            className={cn(
                "p-1.5 hover:bg-gray-200 rounded border border-transparent",
                active && "bg-blue-100 border-blue-300"
            )}
        >
            <Icon className={cn("w-4 h-4", iconColor)} />
        </button>
    )

    // 텍스트 드롭다운 버튼 (합계, 채우기 등)
    const TextDropdownButton = ({
        id,
        icon: Icon,
        label,
        iconColor = "text-gray-700",
        children
    }: {
        id: string
        icon: any
        label: string
        iconColor?: string
        children?: React.ReactNode
    }) => {
        const isOpen = openDropdown === id
        return (
            <div className="relative" ref={isOpen ? dropdownRef : undefined}>
                <button
                    onClick={() => toggleDropdown(id)}
                    className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-700 border border-transparent",
                        isOpen ? "bg-blue-50 border-blue-300" : "hover:bg-gray-100"
                    )}
                >
                    <Icon className={cn("w-4 h-4", iconColor)} />
                    <span>{label}</span>
                    <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
                {isOpen && children && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] py-1">
                        {children}
                    </div>
                )}
            </div>
        )
    }

    const renderHomeTab = () => (
        <div className="flex items-stretch h-full" ref={dropdownRef}>
            {/* 실행 취소/다시 실행 */}
            <div className="flex items-center gap-1 px-2">
                <button className="p-1.5 hover:bg-gray-200 rounded" title="실행 취소 (Ctrl+Z)">
                    <Undo2 className="w-5 h-5 text-gray-600" />
                </button>
                <button className="p-1.5 hover:bg-gray-200 rounded" title="다시 실행 (Ctrl+Y)">
                    <Redo2 className="w-5 h-5 text-gray-600" />
                </button>
            </div>

            <GroupDivider />

            {/* 클립보드 */}
            <RibbonGroup title="클립보드">
                <div className="flex items-start gap-1">
                    <LargeDropdownButton id="paste" icon={ClipboardPaste} label="붙여넣기" iconColor="text-amber-600">
                        <DropdownItem icon={ClipboardPaste} label="붙여넣기" shortcut="Ctrl+V" onClick={() => onAction('paste')} />
                        <DropdownItem icon={ClipboardPaste} label="선택하여 붙여넣기" shortcut="Ctrl+Shift+V" />
                        <div className="border-t border-gray-200 my-1" />
                        <DropdownItem label="값만 붙여넣기" />
                        <DropdownItem label="서식만 붙여넣기" />
                        <DropdownItem label="수식만 붙여넣기" />
                    </LargeDropdownButton>
                    <div className="flex flex-col gap-0.5 pt-1">
                        <SmallIconButton icon={Scissors} title="잘라내기 (Ctrl+X)" onClick={() => onAction('cut')} />
                        <SmallIconButton icon={Copy} title="복사 (Ctrl+C)" onClick={() => onAction('copy')} />
                        <SmallIconButton icon={Paintbrush} title="서식 복사" iconColor="text-amber-500" />
                    </div>
                </div>
            </RibbonGroup>

            <GroupDivider />

            {/* 글꼴 */}
            <RibbonGroup title="글꼴">
                <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center gap-1">
                        <select
                            value={fontFamily}
                            onChange={(e) => setFontFamily(e.target.value)}
                            className="h-[24px] px-2 text-[12px] border border-gray-300 rounded bg-white text-gray-800 w-[110px]"
                        >
                            <option>Calibri</option>
                            <option>Arial</option>
                            <option>맑은 고딕</option>
                            <option>굴림</option>
                            <option>바탕</option>
                        </select>
                        <select
                            value={fontSize}
                            onChange={(e) => setFontSize(e.target.value)}
                            className="h-[24px] px-2 text-[12px] border border-gray-300 rounded bg-white text-gray-800 w-[50px]"
                        >
                            {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map(size => (
                                <option key={size}>{size}</option>
                            ))}
                        </select>
                        <button className="px-1 py-0.5 hover:bg-gray-200 rounded text-gray-600 text-[12px] font-bold" title="글꼴 크기 늘림">
                            A<span className="text-[9px]">▲</span>
                        </button>
                        <button className="px-1 py-0.5 hover:bg-gray-200 rounded text-gray-600 text-[12px] font-bold" title="글꼴 크기 줄임">
                            A<span className="text-[9px]">▼</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <SmallIconButton icon={Bold} title="굵게 (Ctrl+B)" onClick={() => onAction('bold')} />
                        <SmallIconButton icon={Italic} title="기울임꼴 (Ctrl+I)" onClick={() => onAction('italic')} />
                        <SmallIconButton icon={Underline} title="밑줄 (Ctrl+U)" onClick={() => onAction('underline')} />
                        <SmallIconButton icon={Strikethrough} title="취소선" />
                        <div className="w-px h-5 bg-gray-300 mx-1" />
                        <SmallIconButton icon={Square} title="테두리" />
                        <div className="w-px h-5 bg-gray-300 mx-1" />
                        <button className="p-1.5 hover:bg-gray-200 rounded flex flex-col items-center" title="채우기 색">
                            <Palette className="w-4 h-4 text-yellow-500" />
                            <div className="w-4 h-1 bg-yellow-400 mt-0.5 rounded" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-200 rounded flex flex-col items-center" title="글꼴 색">
                            <Type className="w-4 h-4 text-gray-700" />
                            <div className="w-4 h-1 bg-red-500 mt-0.5 rounded" />
                        </button>
                    </div>
                </div>
            </RibbonGroup>

            <GroupDivider />

            {/* 맞춤 */}
            <RibbonGroup title="맞춤">
                <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex items-center gap-0.5">
                        <SmallIconButton icon={AlignVerticalJustifyStart} title="위쪽 맞춤" />
                        <SmallIconButton icon={AlignVerticalJustifyCenter} title="가운데 맞춤" />
                        <SmallIconButton icon={AlignVerticalJustifyEnd} title="아래쪽 맞춤" />
                        <div className="w-px h-5 bg-gray-300 mx-1" />
                        <button className="p-1.5 hover:bg-gray-200 rounded flex items-center gap-1 text-[10px] text-gray-700" title="자동 줄 바꿈">
                            <WrapText className="w-4 h-4" />
                            <span>자동 줄 바꿈</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <SmallIconButton icon={AlignLeft} title="왼쪽 맞춤" />
                        <SmallIconButton icon={AlignCenter} title="가운데 맞춤" />
                        <SmallIconButton icon={AlignRight} title="오른쪽 맞춤" />
                        <div className="w-px h-5 bg-gray-300 mx-1" />
                        <TextDropdownButton id="merge" icon={LayoutGrid} label="병합하고 가운데 맞춤">
                            <DropdownItem icon={LayoutGrid} label="병합하고 가운데 맞춤" onClick={() => onAction('merge-center')} />
                            <DropdownItem label="전체 병합" onClick={() => onAction('merge-all')} />
                            <DropdownItem label="셀 병합" onClick={() => onAction('merge-cells')} />
                            <div className="border-t border-gray-200 my-1" />
                            <DropdownItem label="셀 분할" onClick={() => onAction('unmerge')} />
                        </TextDropdownButton>
                    </div>
                </div>
            </RibbonGroup>

            <GroupDivider />

            {/* 표시 형식 */}
            <RibbonGroup title="표시 형식">
                <div className="flex flex-col gap-1.5 pt-1">
                    <select className="h-[24px] px-2 text-[12px] border border-gray-300 rounded bg-white text-gray-800 w-[100px]">
                        <option>일반</option>
                        <option>숫자</option>
                        <option>통화</option>
                        <option>회계</option>
                        <option>날짜</option>
                        <option>백분율</option>
                        <option>텍스트</option>
                    </select>
                    <div className="flex items-center gap-1">
                        <button className="px-2 py-1 hover:bg-gray-200 rounded text-[12px] text-gray-700 font-medium" title="백분율 스타일">%</button>
                        <button className="px-2 py-1 hover:bg-gray-200 rounded text-[12px] text-gray-700 font-medium" title="쉼표 스타일">,</button>
                        <div className="w-px h-5 bg-gray-300 mx-1" />
                        <button className="px-1.5 py-1 hover:bg-gray-200 rounded text-[10px] text-gray-600" title="소수 자릿수 늘림">.00→.000</button>
                        <button className="px-1.5 py-1 hover:bg-gray-200 rounded text-[10px] text-gray-600" title="소수 자릿수 줄임">.00→.0</button>
                    </div>
                </div>
            </RibbonGroup>

            <GroupDivider />

            {/* 스타일 */}
            <RibbonGroup title="스타일">
                <div className="flex items-start gap-1">
                    <LargeDropdownButton id="conditional" icon={Table} label="조건부 서식" iconColor="text-orange-500">
                        <DropdownItem icon={MoreHorizontal} label="셀 강조 규칙" />
                        <DropdownItem icon={MoreHorizontal} label="상위/하위 규칙" />
                        <DropdownItem icon={MoreHorizontal} label="데이터 막대" />
                        <DropdownItem icon={MoreHorizontal} label="색조" />
                        <DropdownItem icon={MoreHorizontal} label="아이콘 집합" />
                        <div className="border-t border-gray-200 my-1" />
                        <DropdownItem label="새 규칙..." onClick={() => onAction('new-rule')} />
                        <DropdownItem label="규칙 지우기" />
                        <DropdownItem label="규칙 관리..." />
                    </LargeDropdownButton>
                    <LargeDropdownButton id="table-style" icon={Grid3X3} label="표 서식" iconColor="text-blue-600" selected={false}>
                        <div className="p-3">
                            <p className="text-[11px] text-gray-500 mb-2">표 스타일 선택</p>
                            <div className="grid grid-cols-4 gap-1">
                                {['밝은', '보통', '어두운'].map((style, i) => (
                                    <button key={i} className="w-10 h-8 border border-gray-300 rounded hover:border-blue-500 bg-gradient-to-b from-blue-100 to-blue-200" />
                                ))}
                            </div>
                        </div>
                    </LargeDropdownButton>
                    <LargeDropdownButton id="cell-style" icon={FileSpreadsheet} label="셀 스타일" iconColor="text-green-600">
                        <div className="p-3 w-[250px]">
                            <p className="text-[11px] text-gray-500 mb-2">셀 스타일</p>
                            <div className="grid grid-cols-3 gap-1">
                                <button className="px-2 py-1 text-[11px] border rounded hover:border-blue-500">표준</button>
                                <button className="px-2 py-1 text-[11px] border rounded hover:border-blue-500 bg-yellow-100">좋음</button>
                                <button className="px-2 py-1 text-[11px] border rounded hover:border-blue-500 bg-red-100">나쁨</button>
                                <button className="px-2 py-1 text-[11px] border rounded hover:border-blue-500 bg-gray-100">보통</button>
                                <button className="px-2 py-1 text-[11px] border rounded hover:border-blue-500 font-bold">강조1</button>
                                <button className="px-2 py-1 text-[11px] border rounded hover:border-blue-500 bg-blue-100">강조2</button>
                            </div>
                        </div>
                    </LargeDropdownButton>
                    <LargeDropdownButton id="cell-edit" icon={Columns} label="셀 편집기" iconColor="text-purple-600">
                        <DropdownItem label="셀 서식..." onClick={() => onAction('cell-format')} />
                        <DropdownItem label="행 높이..." />
                        <DropdownItem label="열 너비..." />
                        <DropdownItem label="자동 맞춤" />
                    </LargeDropdownButton>
                </div>
            </RibbonGroup>

            <GroupDivider />

            {/* 셀 */}
            <RibbonGroup title="셀">
                <div className="flex items-start gap-1">
                    <LargeDropdownButton id="insert" icon={Plus} label="삽입" iconColor="text-green-600">
                        <DropdownItem icon={Plus} label="셀 삽입..." onClick={() => onAction('insert-cell')} />
                        <DropdownItem label="시트 행 삽입" onClick={() => onAction('insert-row')} />
                        <DropdownItem label="시트 열 삽입" onClick={() => onAction('insert-col')} />
                        <DropdownItem label="시트 삽입" onClick={() => onAction('insert-sheet')} />
                    </LargeDropdownButton>
                    <LargeDropdownButton id="delete" icon={Trash2} label="삭제" iconColor="text-red-500">
                        <DropdownItem icon={Trash2} label="셀 삭제..." onClick={() => onAction('delete-cell')} />
                        <DropdownItem label="시트 행 삭제" onClick={() => onAction('delete-row')} />
                        <DropdownItem label="시트 열 삭제" onClick={() => onAction('delete-col')} />
                        <DropdownItem label="시트 삭제" onClick={() => onAction('delete-sheet')} />
                    </LargeDropdownButton>
                    <LargeDropdownButton id="format" icon={Settings} label="서식" iconColor="text-blue-600">
                        <DropdownItem label="행 높이..." />
                        <DropdownItem label="행 높이 자동 맞춤" />
                        <DropdownItem label="열 너비..." />
                        <DropdownItem label="열 너비 자동 맞춤" />
                        <div className="border-t border-gray-200 my-1" />
                        <DropdownItem label="숨기기 및 숨기기 취소" />
                        <DropdownItem label="시트 구성" />
                        <div className="border-t border-gray-200 my-1" />
                        <DropdownItem label="셀 서식..." onClick={() => onAction('cell-format')} />
                    </LargeDropdownButton>
                </div>
            </RibbonGroup>

            <GroupDivider />

            {/* 편집 */}
            <RibbonGroup title="편집">
                <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-0.5">
                        <TextDropdownButton id="sum" icon={Sigma} label="합계" iconColor="text-blue-600">
                            <DropdownItem icon={Sigma} label="합계" onClick={() => onAction('sum')} />
                            <DropdownItem label="평균" onClick={() => onAction('average')} />
                            <DropdownItem label="숫자 개수" onClick={() => onAction('count')} />
                            <DropdownItem label="최대값" onClick={() => onAction('max')} />
                            <DropdownItem label="최소값" onClick={() => onAction('min')} />
                            <div className="border-t border-gray-200 my-1" />
                            <DropdownItem label="추가 함수..." />
                        </TextDropdownButton>
                        <TextDropdownButton id="fill" icon={Sparkles} label="채우기" iconColor="text-amber-500">
                            <DropdownItem label="아래로" onClick={() => onAction('fill-down')} />
                            <DropdownItem label="오른쪽으로" onClick={() => onAction('fill-right')} />
                            <DropdownItem label="위로" onClick={() => onAction('fill-up')} />
                            <DropdownItem label="왼쪽으로" onClick={() => onAction('fill-left')} />
                            <div className="border-t border-gray-200 my-1" />
                            <DropdownItem label="계열..." />
                        </TextDropdownButton>
                        <TextDropdownButton id="clear" icon={Eraser} label="지우기">
                            <DropdownItem label="모두 지우기" onClick={() => onAction('clear-all')} />
                            <DropdownItem label="서식 지우기" onClick={() => onAction('clear-format')} />
                            <DropdownItem label="내용 지우기" onClick={() => onAction('clear-content')} />
                            <DropdownItem label="메모 지우기" />
                        </TextDropdownButton>
                    </div>
                    <div className="flex flex-col gap-1">
                        <TextDropdownButton id="sort-filter" icon={ArrowDownAZ} label="정렬 및 필터" iconColor="text-blue-600">
                            <DropdownItem icon={ArrowUpAZ} label="오름차순 정렬" onClick={() => onAction('sort', 'asc')} />
                            <DropdownItem icon={ArrowDownAZ} label="내림차순 정렬" onClick={() => onAction('sort', 'desc')} />
                            <div className="border-t border-gray-200 my-1" />
                            <DropdownItem icon={Filter} label="필터" onClick={() => onAction('filter')} />
                            <DropdownItem label="필터 지우기" onClick={() => onAction('clear-filter')} />
                            <DropdownItem label="다시 적용" />
                        </TextDropdownButton>
                        <button
                            onClick={() => onAction('find')}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-700 hover:bg-gray-100"
                        >
                            <Search className="w-4 h-4 text-gray-600" />
                            <span>찾기</span>
                        </button>
                    </div>
                </div>
            </RibbonGroup>
        </div>
    )

    return (
        <div className="bg-white border-b border-gray-300 select-none">
            {/* 탭 바 */}
            <div className="flex items-center bg-[#f3f3f3] border-b border-gray-200">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-4 py-2 text-[12px] font-medium transition-colors relative",
                            activeTab === tab
                                ? "bg-white text-green-700 border-t-2 border-t-green-600"
                                : "text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* 리본 콘텐츠 */}
            <div className="bg-[#f8f9fa] overflow-x-auto">
                {activeTab === "홈" && renderHomeTab()}
                {activeTab === "삽입" && (
                    <div className="flex items-stretch h-[90px] px-4">
                        <RibbonGroup title="표">
                            <div className="flex gap-1">
                                <LargeDropdownButton id="pivot" icon={Table} label="피벗 테이블" iconColor="text-green-600">
                                    <DropdownItem label="피벗 테이블 만들기" />
                                    <DropdownItem label="권장 피벗 테이블" />
                                </LargeDropdownButton>
                                <LargeDropdownButton id="table" icon={Grid3X3} label="표" iconColor="text-blue-500">
                                    <DropdownItem label="표 삽입" />
                                </LargeDropdownButton>
                            </div>
                        </RibbonGroup>
                    </div>
                )}
                {activeTab === "데이터" && (
                    <div className="flex items-stretch h-[90px] px-4">
                        <RibbonGroup title="정렬 및 필터">
                            <div className="flex gap-1">
                                <LargeDropdownButton id="sort-asc" icon={ArrowUpAZ} label="오름차순" iconColor="text-blue-600">
                                    <DropdownItem label="A-Z 정렬" onClick={() => onAction('sort', 'asc')} />
                                </LargeDropdownButton>
                                <LargeDropdownButton id="sort-desc" icon={ArrowDownAZ} label="내림차순" iconColor="text-blue-600">
                                    <DropdownItem label="Z-A 정렬" onClick={() => onAction('sort', 'desc')} />
                                </LargeDropdownButton>
                                <LargeDropdownButton id="data-filter" icon={Filter} label="필터" iconColor="text-amber-500">
                                    <DropdownItem label="필터 적용" onClick={() => onAction('filter')} />
                                    <DropdownItem label="필터 해제" onClick={() => onAction('clear-filter')} />
                                </LargeDropdownButton>
                            </div>
                        </RibbonGroup>
                    </div>
                )}
                {activeTab === "수식" && (
                    <div className="flex items-stretch h-[90px] px-4">
                        <RibbonGroup title="함수 라이브러리">
                            <div className="flex gap-1">
                                <LargeDropdownButton id="insert-func" icon={Sigma} label="함수 삽입" iconColor="text-blue-600">
                                    <DropdownItem label="함수 삽입 대화상자" />
                                </LargeDropdownButton>
                                <LargeDropdownButton id="autosum" icon={Sigma} label="자동 합계" iconColor="text-green-600">
                                    <DropdownItem label="합계" onClick={() => onAction('sum')} />
                                    <DropdownItem label="평균" onClick={() => onAction('average')} />
                                    <DropdownItem label="최대값" onClick={() => onAction('max')} />
                                    <DropdownItem label="최소값" onClick={() => onAction('min')} />
                                </LargeDropdownButton>
                            </div>
                        </RibbonGroup>
                    </div>
                )}
                {(activeTab === "페이지 레이아웃" || activeTab === "보기" || activeTab === "설정") && (
                    <div className="flex items-center justify-center h-[90px] text-gray-500 text-sm">
                        {activeTab} 도구
                    </div>
                )}
            </div>

            {/* 수식 입력줄 */}
            <div className="flex items-center bg-white border-t border-gray-200 h-[28px]">
                <div className="w-[90px] px-3 border-r border-gray-300 text-[12px] text-center font-medium text-gray-700 flex items-center justify-center h-full bg-gray-50">
                    {cellRef}
                </div>
                <div className="flex items-center px-2 border-r border-gray-300 h-full gap-1">
                    <button className="p-1 hover:bg-gray-200 rounded" title="취소">
                        <X className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button className="p-1 hover:bg-gray-200 rounded" title="입력">
                        <Check className="w-3.5 h-3.5 text-green-600" />
                    </button>
                    <span className="text-gray-400 text-[13px] italic px-1 font-serif">fx</span>
                </div>
                <input
                    type="text"
                    className="flex-1 px-3 text-[12px] h-full outline-none bg-white text-gray-800"
                    placeholder=""
                />
            </div>
        </div>
    )
}
