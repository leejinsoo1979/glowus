"use client"

import React from 'react'
import { PlayCircle } from 'lucide-react'

// Mock Data
const TRENDING_VIDEOS = [
    {
        id: 1,
        title: "내 차례로군 🔮 | SWISS R5 | 202...",
        author: "Wolf",
        views: "290,335회",
        date: "2025년 10월 25일",
        thumbnail: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        color: "bg-red-500" // Fallback color
    },
    {
        id: 2,
        title: "오니 문도 티스코드 영상을 본 중국...",
        author: "콤비라",
        views: "388,001회",
        date: "2025년 11월 4일",
        thumbnail: "https://images.unsplash.com/photo-1511512578047-dfb367046420?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        color: "bg-blue-500"
    },
    {
        id: 3,
        title: "FIFTY FIFTY (피프티피프티) '가위...",
        author: "FIFTY FIFTY Official",
        views: "7,354,304회",
        date: "2025년 11월 4일",
        thumbnail: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        color: "bg-purple-500"
    },
    {
        id: 4,
        title: "한국 게임 역사상 가장 역겨운 게임, '...",
        author: "띵작기",
        views: "442,151회",
        date: "2025년 11월 4일",
        thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        color: "bg-zinc-800"
    },
    {
        id: 5,
        title: "리뷰 333개중 332개가 극찬한 \"첨...",
        author: "혜안",
        views: "308,681회",
        date: "2025년 11월 4일",
        thumbnail: "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        color: "bg-yellow-600"
    },
    {
        id: 6,
        title: "와.. 역대급 미친 소재로, 디즈니+가 ...",
        author: "지무비 : G Movie",
        views: "757,023회",
        date: "2025년 11월 5일",
        thumbnail: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        color: "bg-indigo-600"
    },
    {
        id: 7,
        title: "신조어 만들어낸(?) 🌶️토.네! 송지...",
        author: "짠한형 신동엽",
        views: "738,480회",
        date: "2025년 11월 3일",
        thumbnail: "https://images.unsplash.com/photo-1576085898323-218337e3e43c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        color: "bg-green-600"
    },
    {
        id: 8,
        title: "🏆EP 1-1 FULL | 월드컵은 4년...",
        author: "채널십오야",
        views: "987,783회",
        date: "2025년 11월 5일",
        thumbnail: "https://images.unsplash.com/photo-1585672957723-4e44e97c9b0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        color: "bg-orange-500"
    },
    {
        id: 9,
        title: "찰스&승권이랑 배달음식 먹으면서 ...",
        author: "권또포 KWONTTOTTO",
        views: "500,407회",
        date: "2025년 11월 5일",
        thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        color: "bg-pink-500"
    }
]

export function VideoGrid() {
    return (
        <div className="mt-12">
            <h3 className="text-sm font-bold text-zinc-300 mb-4">지금 이런 영상들이 많이 요약되고 있어요!</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8">
                {TRENDING_VIDEOS.map((video) => (
                    <div key={video.id} className="group cursor-pointer">
                        {/* Thumbnail */}
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-800 mb-2 group-hover:ring-2 ring-white/20 transition-all">
                            {/* Mock Image using color div if image fails, but using unsplash urls here */}
                            <img
                                src={video.thumbnail}
                                alt={video.title}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                <PlayCircle className="w-10 h-10 text-white drop-shadow-lg" />
                            </div>
                            <div className="absolute bottom-1 right-1 bg-black/80 px-1 rounded text-[10px] text-white font-medium">
                                10:24
                            </div>
                        </div>

                        {/* Meta */}
                        <div>
                            <h4 className="text-sm font-medium text-zinc-200 line-clamp-2 leading-snug mb-1 group-hover:text-blue-400 transition-colors">
                                {video.title}
                            </h4>
                            <div className="text-xs text-zinc-500">
                                <p>{video.author}</p>
                                <p>{video.date} · {video.views}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
