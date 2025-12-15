"use client"

import React, { useState } from 'react'
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
    closestCenter,
    defaultDropAnimationSideEffects,
    DropAnimation
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { BuilderSidebar } from '@/components/builder/BuilderSidebar'
import { BuilderCanvas } from '@/components/builder/BuilderCanvas'
import { type LucideIcon } from 'lucide-react'

// Define the structure for items on the canvas
interface BuilderItem {
    id: string
    type: string
    label: string
}

export default function AppBuilderPage() {
    const [items, setItems] = useState<BuilderItem[]>([])
    const [activeDragItem, setActiveDragItem] = useState<{ type: string, label: string } | null>(null)

    // Configure sensors (pointer is usually enough for mouse/touch)
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px movement to start drag (prevents accidental clicks)
            },
        })
    )

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        const activeData = active.data.current

        if (activeData) {
            setActiveDragItem({
                type: activeData.type,
                label: activeData.label
            })
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (!over) {
            setActiveDragItem(null)
            return
        }

        const activeData = active.data.current
        const isSidebar = activeData?.isSidebar

        // Case 1: Dragging from Sidebar to Canvas
        if (isSidebar) {
            // If dropped over the canvas droppable area or any sortable item within it
            if (over.id === 'canvas-droppable' || items.some(item => item.id === over.id)) {
                const newItem: BuilderItem = {
                    id: `${activeData.type}-${Date.now()}`,
                    type: activeData.type,
                    label: activeData.label
                }

                // Add to the end for now (simple append)
                setItems(prev => [...prev, newItem])
            }
        }
        // Case 2: Reordering items within Canvas
        else {
            if (active.id !== over.id) {
                setItems((items) => {
                    const oldIndex = items.findIndex((item) => item.id === active.id)
                    const newIndex = items.findIndex((item) => item.id === over.id)
                    return arrayMove(items, oldIndex, newIndex)
                })
            }
        }

        setActiveDragItem(null)
    }

    const handleDeleteItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id))
    }

    // Animation config for the overlay
    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.4',
                },
            },
        }),
    }

    return (
        <div className="flex h-full bg-white dark:bg-zinc-950">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                {/* Left Sidebar */}
                <BuilderSidebar />

                {/* Main Canvas */}
                <BuilderCanvas items={items} onDeleteItem={handleDeleteItem} />

                {/* Drag Overlay (Visual feedback while dragging) */}
                <DragOverlay dropAnimation={dropAnimation}>
                    {activeDragItem ? (
                        <div className="bg-white border border-blue-500 shadow-xl rounded-md p-3 w-48 opacity-90 cursor-grabbing pointer-events-none flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-900">{activeDragItem.label}</span>
                        </div>
                    ) : null}
                </DragOverlay>

            </DndContext>
        </div>
    )
}
