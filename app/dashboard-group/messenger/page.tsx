'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Search, Send, Paperclip, MoreVertical, Phone, Video, Info, Image as ImageIcon, Smile, FileText } from 'lucide-react'
import { Button } from '@/components/ui'

// Mock Data
const CONTACTS = [
    { id: 1, name: 'Alice Kim', role: 'Product Manager', status: 'online', avatar: 'AK', lastMessage: '이번 스프린트 일정 확인해주실 수 있나요?', time: '10:30 AM', unread: 2 },
    { id: 2, name: 'David Lee', role: 'Frontend Lead', status: 'busy', avatar: 'DL', lastMessage: 'PR 리뷰 완료했습니다. 확인 부탁드려요.', time: '09:15 AM', unread: 0 },
    { id: 3, name: 'Sarah Park', role: 'UX Designer', status: 'offline', avatar: 'SP', lastMessage: '새로운 시안 피그마에 업로드했습니다.', time: 'Yesterday', unread: 0 },
    { id: 4, name: 'James Wilson', role: 'Backend Dev', status: 'online', avatar: 'JW', lastMessage: 'API 문서 업데이트 되었습니다.', time: 'Yesterday', unread: 0 },
    { id: 5, name: 'Emma Choi', role: 'Marketing', status: 'away', avatar: 'EC', lastMessage: '다음 주 미팅 일정 조율 가능할까요?', time: '2 days ago', unread: 0 },
    { id: 6, name: 'Cloud Team', role: 'Group', status: 'online', avatar: 'CT', lastMessage: '서버 점검 완료되었습니다.', time: '3 days ago', unread: 0 },
]

const INITIAL_MESSAGES = [
    { id: 1, senderId: 1, text: '안녕하세요! 이번 프론트엔드 작업 진행 상황 공유해주실 수 있나요?', time: '10:00 AM', type: 'text' },
    { id: 2, senderId: 0, text: '네, 현재 메신저 UI 구현 중입니다. 거의 마무리 단계예요.', time: '10:05 AM', type: 'text' },
    { id: 3, senderId: 1, text: '오, 기대되네요! 디자인은 시안대로 나오고 있나요?', time: '10:06 AM', type: 'text' },
    { id: 4, senderId: 0, text: '네 최대한 맞추고 있습니다. 스크린샷 한번 보내드릴게요.', time: '10:10 AM', type: 'text' },
    { id: 5, senderId: 0, text: '', time: '10:10 AM', type: 'image' }, // Mock image placeholder
    { id: 6, senderId: 1, text: '깔끔하네요! 다크모드에서도 확인 부탁드려요.', time: '10:12 AM', type: 'text' },
]

export default function MessengerPage() {
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'
    const [activeContactId, setActiveContactId] = useState<number | null>(1)
    const [messages, setMessages] = useState(INITIAL_MESSAGES)
    const [inputText, setInputText] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    const activeContact = CONTACTS.find(c => c.id === activeContactId)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const handleSendMessage = () => {
        if (!inputText.trim()) return
        const newMessage = {
            id: messages.length + 1,
            senderId: 0, // 0 is current user
            text: inputText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'text'
        }
        setMessages([...messages, newMessage])
        setInputText('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    return (
        <div className={`flex h-[calc(100vh-4rem)] overflow-hidden ${isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'}`}>

            {/* Sidebar (Contact List) */}
            <div className={`w-full lg:w-80 flex-shrink-0 flex flex-col border-r ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50/50'} ${activeContactId ? 'hidden lg:flex' : 'flex'}`}>

                {/* Header */}
                <div className={`p-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} flex items-center justify-between`}>
                    <h1 className="text-xl font-bold">Messages</h1>
                    <Button size="icon" variant="ghost" className="rounded-full">
                        <MoreVertical className="w-5 h-5 text-zinc-500" />
                    </Button>
                </div>

                {/* Search */}
                <div className="p-4">
                    <div className={`relative rounded-xl overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-white border border-zinc-200'}`}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search people or groups..."
                            className={`w-full py-2.5 pl-10 pr-4 bg-transparent outline-none text-sm placeholder:text-zinc-500`}
                        />
                    </div>
                </div>

                {/* Contact List */}
                <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 space-y-1">
                    {CONTACTS.map((contact) => (
                        <motion.button
                            key={contact.id}
                            onClick={() => setActiveContactId(contact.id)}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${activeContactId === contact.id
                                ? isDark ? 'bg-zinc-800 shadow-md' : 'bg-white shadow-md ring-1 ring-zinc-200'
                                : isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-100'
                                }`}
                        >
                            <div className="relative flex-shrink-0">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br ${contact.id % 2 === 0 ? 'from-blue-500 to-indigo-600' : 'from-emerald-500 to-teal-600'
                                    } text-white shadow-lg`}>
                                    {contact.avatar}
                                </div>
                                {/* Status Indicator */}
                                <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 ${isDark ? 'border-zinc-900' : 'border-white'} ${contact.status === 'online' ? 'bg-green-500' :
                                    contact.status === 'busy' ? 'bg-red-500' :
                                        contact.status === 'away' ? 'bg-yellow-500' : 'bg-zinc-500'
                                    }`}></span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <span className={`font-semibold truncate ${activeContactId === contact.id ? 'text-accent' : ''}`}>{contact.name}</span>
                                    <span className="text-xs text-zinc-500">{contact.time}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate pr-2">{contact.lastMessage}</p>
                                    {contact.unread > 0 && (
                                        <span className="min-w-[1.25rem] h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                                            {contact.unread}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col min-w-0 ${!activeContactId ? 'hidden lg:flex' : 'flex'}`}>

                {/* Chat Header */}
                <div className={`h-16 px-6 border-b flex items-center justify-between flex-shrink-0 backdrop-blur-md z-10 ${isDark
                    ? 'border-zinc-800 bg-zinc-900/80'
                    : 'border-zinc-200 bg-white/80'
                    }`}>
                    {activeContact ? (
                        <div className="flex items-center gap-4">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="lg:hidden -ml-2 mr-2"
                                onClick={() => setActiveContactId(null)}
                            >
                                <Search className="w-5 h-5" /> {/* Using Search icon as 'Back' placeholder or ChevronLeft */}
                            </Button>
                            <div className="relative">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br ${activeContact.id % 2 === 0 ? 'from-blue-500 to-indigo-600' : 'from-emerald-500 to-teal-600'
                                    } text-white`}>
                                    {activeContact.avatar}
                                </div>
                                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 ${isDark ? 'border-zinc-900' : 'border-white'} ${activeContact.status === 'online' ? 'bg-green-500' : 'bg-zinc-500'
                                    }`}></span>
                            </div>
                            <div>
                                <h2 className="font-bold leading-none">{activeContact.name}</h2>
                                <span className="text-xs text-zinc-500">{activeContact.role} &bull; {activeContact.status}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full text-center text-zinc-500">Select a conversation</div>
                    )}

                    <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="text-zinc-500 hover:text-accent">
                            <Phone className="w-5 h-5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-zinc-500 hover:text-accent">
                            <Video className="w-5 h-5" />
                        </Button>
                        <div className={`w-px h-6 mx-2 ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`}></div>
                        <Button size="icon" variant="ghost" className="text-zinc-500 hover:text-accent">
                            <Info className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Message List */}
                <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${isDark ? 'bg-zinc-950' : 'bg-white'}`} ref={scrollRef}>
                    {messages.map((msg) => {
                        const isMe = msg.senderId === 0
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                {!isMe && (
                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold bg-gradient-to-br ${activeContact?.id && activeContact.id % 2 === 0 ? 'from-blue-500 to-indigo-600' : 'from-emerald-500 to-teal-600'
                                        } text-white mt-1`}>
                                        {activeContact?.avatar}
                                    </div>
                                )}

                                <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end flex flex-col' : 'items-start flex flex-col'}`}>
                                    {msg.type === 'image' ? (
                                        <div className={`p-2 rounded-2xl ${isMe ? 'bg-accent/10 border border-accent/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                                            <div className="w-48 h-32 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center text-zinc-400">
                                                <ImageIcon className="w-8 h-8" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${isMe
                                            ? 'bg-accent text-white rounded-tr-sm'
                                            : isDark
                                                ? 'bg-zinc-800 text-zinc-100 rounded-tl-sm border border-zinc-700'
                                                : 'bg-white text-zinc-900 rounded-tl-sm border border-zinc-200'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    )}
                                    <span className="text-[11px] text-zinc-400 px-1">{msg.time}</span>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Input Area */}
                <div className={`p-4 border-t flex-shrink-0 ${isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
                    <div className={`flex items-end gap-2 p-2 rounded-2xl border transition-all ${isDark
                        ? 'bg-zinc-950 border-zinc-800 focus-within:border-zinc-700'
                        : 'bg-zinc-50 border-zinc-200 focus-within:border-zinc-300 shadow-sm'
                        }`}>
                        <div className="flex pb-1">
                            <Button size="icon" variant="ghost" className="rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                                <Paperclip className="w-5 h-5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                                <ImageIcon className="w-5 h-5" />
                            </Button>
                        </div>

                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            className={`flex-1 max-h-32 py-2.5 bg-transparent resize-none outline-none text-sm placeholder:text-zinc-400 scrollbar-hide`}
                            rows={1}
                            style={{ minHeight: '44px' }} // Approx height for 1 line
                        />

                        <div className="flex pb-1 gap-1">
                            <Button size="icon" variant="ghost" className="rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                                <Smile className="w-5 h-5" />
                            </Button>
                            <Button
                                onClick={handleSendMessage}
                                disabled={!inputText.trim()}
                                className={`rounded-xl w-10 h-10 p-0 flex items-center justify-center transition-all ${inputText.trim()
                                    ? 'bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/25'
                                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                                    }`}
                            >
                                <Send className="w-4 h-4 ml-0.5" />
                            </Button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
