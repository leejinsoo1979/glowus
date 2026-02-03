import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  activeCategory: string | null
  commitModalOpen: boolean
  taskModalOpen: boolean
  selectedTaskId: string | null
  emailSidebarWidth: number
  isResizingEmail: boolean
  agentSidebarOpen: boolean
  level2Width: number
  isResizingLevel2: boolean
  level2Collapsed: boolean
  taskHistoryOpen: boolean
  leftPanelOpen: boolean
  toggleLeftPanel: () => void
  setLeftPanelOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setActiveCategory: (category: string | null) => void
  openCommitModal: () => void
  closeCommitModal: () => void
  openTaskModal: (taskId?: string) => void
  closeTaskModal: () => void
  setEmailSidebarWidth: (width: number) => void
  setIsResizingEmail: (resizing: boolean) => void
  toggleAgentSidebar: () => void
  setLevel2Width: (width: number) => void
  setIsResizingLevel2: (resizing: boolean) => void
  toggleLevel2: () => void
  setLevel2Collapsed: (collapsed: boolean) => void
  openTaskHistory: () => void
  closeTaskHistory: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  activeCategory: null,
  commitModalOpen: false,
  taskModalOpen: false,
  selectedTaskId: null,
  emailSidebarWidth: 400,
  isResizingEmail: false,
  agentSidebarOpen: false,
  level2Width: 280,
  isResizingLevel2: false,
  level2Collapsed: false,
  taskHistoryOpen: false,
  leftPanelOpen: false,
  toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  openCommitModal: () => set({ commitModalOpen: true }),
  closeCommitModal: () => set({ commitModalOpen: false }),
  openTaskModal: (taskId) => set({ taskModalOpen: true, selectedTaskId: taskId || null }),
  closeTaskModal: () => set({ taskModalOpen: false, selectedTaskId: null }),
  setEmailSidebarWidth: (width) => set({ emailSidebarWidth: width }),
  setIsResizingEmail: (resizing) => set({ isResizingEmail: resizing }),
  toggleAgentSidebar: () => set((state) => ({ agentSidebarOpen: !state.agentSidebarOpen })),
  setLevel2Width: (width) => set({ level2Width: width }),
  setIsResizingLevel2: (resizing) => set({ isResizingLevel2: resizing }),
  toggleLevel2: () => set((state) => ({ level2Collapsed: !state.level2Collapsed })),
  setLevel2Collapsed: (collapsed) => set({ level2Collapsed: collapsed }),
  openTaskHistory: () => set({ taskHistoryOpen: true }),
  closeTaskHistory: () => set({ taskHistoryOpen: false }),
}))
