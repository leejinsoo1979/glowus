import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  commitModalOpen: boolean
  taskModalOpen: boolean
  selectedTaskId: string | null
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openCommitModal: () => void
  closeCommitModal: () => void
  openTaskModal: (taskId?: string) => void
  closeTaskModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  commitModalOpen: false,
  taskModalOpen: false,
  selectedTaskId: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openCommitModal: () => set({ commitModalOpen: true }),
  closeCommitModal: () => set({ commitModalOpen: false }),
  openTaskModal: (taskId) => set({ taskModalOpen: true, selectedTaskId: taskId || null }),
  closeTaskModal: () => set({ taskModalOpen: false, selectedTaskId: null }),
}))
