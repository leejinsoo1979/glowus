"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
    Search,
    Plus,
    MoreVertical,
    Settings,
    Star,
    Users,
    FileText,
    Briefcase,
    LayoutGrid,
    Download,
    Upload,
    ChevronDown,
    FolderOpen,
    Home,
    Wrench,
    ArrowUpDown,
    List
} from "lucide-react"
import { useThemeStore } from "@/stores/themeStore"
import { cn } from "@/lib/utils"
import { ToolsView } from "./tools-view"
import { useSearchParams } from "next/navigation"
import { CreateWorkModal } from "./create-modal"

// --- Icons for App Grid ---
const AppIcon = ({ icon: Icon, color, bg }: { icon: any, color: string, bg: string }) => (
    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", bg)}>
        <Icon className={cn("w-6 h-6", color)} />
    </div>
)

function AppCard({ title, icon, iconColor, iconBg }: { title: string, icon: any, iconColor: string, iconBg: string }) {
    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center text-center aspect-square sm:aspect-auto sm:h-48 shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><Settings className="w-4 h-4" /></button>
            </div>
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-zinc-400 hover:text-yellow-400"><Star className="w-4 h-4" /></button>
            </div>

            <AppIcon icon={icon} color={iconColor} bg={iconBg} />

            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {title}
            </h3>
        </motion.div>
    )
}
// ... existing imports ...

// --- Moved existing grid to a sub-component for cleaner switching ---
function WorksHome({ onOpenCreate }: { onOpenCreate: () => void }) {
    return (
        <>
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Works 홈</h2>
                <div className="flex gap-2">
                    {/* Actions */}
                </div>
            </header>

            {/* Search Bar & Controls */}
            <div className="flex items-center justify-between mb-8">
                <div className="relative w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="앱 명을 입력하세요."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-700"
                    />
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                    <button className="p-1 hover:text-zinc-600 dark:hover:text-zinc-200"><ArrowUpDown className="w-5 h-5" /></button>
                    <button className="p-1 hover:text-zinc-600 dark:hover:text-zinc-200"><List className="w-5 h-5" /></button>
                </div>
            </div>

            {/* App Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">

                {/* Card 1: 견적서 관리 */}
                <AppCard
                    title="견적서 관리"
                    icon={FileText}
                    iconColor="text-cyan-600"
                    iconBg="bg-cyan-100 dark:bg-cyan-900/30"
                />

                {/* Card 2: 새로운 앱 */}
                <AppCard
                    title="새로운 앱"
                    icon={Briefcase}
                    iconColor="text-purple-600"
                    iconBg="bg-purple-100 dark:bg-purple-900/30"
                />

                {/* Card 3: 제품 관리 */}
                <AppCard
                    title="제품 관리"
                    icon={LayoutGrid}
                    iconColor="text-purple-600"
                    iconBg="bg-purple-100 dark:bg-purple-900/30"
                />

                {/* Card 4: 채용 면접 관리 */}
                <AppCard
                    title="채용 면접 관리"
                    icon={Users}
                    iconColor="text-green-600"
                    iconBg="bg-green-100 dark:bg-green-900/30"
                />

                {/* Add Card (Dashed) - Triggers Modal */}
                <button
                    onClick={onOpenCreate}
                    className="group relative flex flex-col items-center justify-center p-6 bg-transparent border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all aspect-square sm:aspect-auto sm:h-48 text-center"
                >
                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6 text-zinc-400" />
                    </div>
                    <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                        템플릿을 이용해 앱을<br />만들어 보세요
                    </span>
                </button>

            </div>
        </>
    )
}

export default function WorksPage() {
    const { accentColor } = useThemeStore()
    const searchParams = useSearchParams()
    const tab = searchParams.get('tab')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    return (
        <div className="flex h-[calc(100vh-64px)] -m-8">
            {/* --- Main Content Area --- */}
            <div className="flex-1 bg-zinc-50 dark:bg-zinc-950/50 p-8 overflow-y-auto">
                {tab === 'tools' ? (
                    <ToolsView />
                ) : (
                    <WorksHome onOpenCreate={() => setIsCreateModalOpen(true)} />
                )}
            </div>

            <CreateWorkModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </div>
    )
}
