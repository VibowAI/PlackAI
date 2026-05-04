import React, { useState, useRef } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, MessageSquare, Trash2, Settings, LogOut, ChevronLeft, 
  Sparkles, History, User, MoreVertical, Edit2, Moon, Sun, Monitor, LogIn
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { chats, currentChatId, selectChat, createNewChat, deleteChat, renameChat, searchChats } = useChat();
  const { user, profile, isGuest, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  const filteredChats = isSearching ? searchChats(searchQuery) : chats;

  const handleNewChat = async () => {
    await createNewChat();
    if (window.innerWidth < 768) setIsOpen(false);
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.aside
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
          className="fixed md:relative z-40 w-72 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-xl md:shadow-none"
        >
          {/* Header */}
          <div className="p-4 flex items-center justify-between">
            <button 
              onClick={handleNewChat}
              className="flex-1 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-2.5 px-4 font-semibold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Plus size={18} /> New Chat
            </button>
            <button 
              onClick={() => setIsOpen(false)}
              className="ml-2 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          </div>

          {/* Search Toggle (Logged-in only) */}
          {!isGuest && (
            <div className="px-4 mb-2">
              {isSearching ? (
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 transition-colors" size={16} />
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                  <button 
                    onClick={() => { setIsSearching(false); setSearchQuery(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <Plus className="rotate-45" size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsSearching(true)}
                  className="w-full flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 rounded-xl py-2 px-3 text-sm transition-all outline-none"
                >
                  <Search size={16} /> Search chats
                </button>
              )}
            </div>
          )}

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
            {isGuest ? (
              <div className="p-6 text-center">
                <History className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-sm text-slate-500">History only available for logged-in users.</p>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No chats found.
              </div>
            ) : (
              filteredChats.map((chat) => (
                <div 
                  key={chat.id}
                  onClick={() => selectChat(chat.id)}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all relative",
                    currentChatId === chat.id 
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium" 
                      : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  )}
                >
                  <MessageSquare size={18} className="shrink-0" />
                  {renamingChatId === chat.id ? (
                    <input
                      autoFocus
                      value={renameInput}
                      onChange={e => setRenameInput(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onBlur={() => {
                        if (renameInput.trim()) renameChat(chat.id, renameInput);
                        setRenamingChatId(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (renameInput.trim()) renameChat(chat.id, renameInput);
                          setRenamingChatId(null);
                        }
                        if (e.key === 'Escape') setRenamingChatId(null);
                      }}
                      className="flex-1 bg-white dark:bg-slate-900 border border-blue-500 rounded px-2 py-1 text-sm outline-none w-full"
                    />
                  ) : (
                    <span className="flex-1 truncate text-sm">{chat.title}</span>
                  )}
                  
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === chat.id ? null : chat.id);
                      }}
                      className={cn(
                        "p-1.5 rounded-lg transition-all",
                        openMenuId === chat.id 
                          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 opacity-100" 
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 group-hover:opacity-100 opacity-0",
                        currentChatId === chat.id && "opacity-100"
                      )}
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {openMenuId === chat.id && (
                      <>
                        <div 
                          className="fixed inset-0 z-50 bg-black/5 dark:bg-white/5" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            setDeletingChatId(null);
                          }}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-1 w-36 z-[60]">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              setRenameInput(chat.title);
                              setRenamingChatId(chat.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-left transition-colors font-medium"
                          >
                            <Edit2 size={14} className="text-blue-500" /> Rename
                          </button>
                          {deletingChatId === chat.id ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingChatId(null);
                                setOpenMenuId(null);
                                deleteChat(chat.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-lg text-left border-t border-slate-100 dark:border-slate-700 mt-1 pt-1 transition-colors font-bold"
                            >
                              <Trash2 size={14} /> Confirm
                            </button>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingChatId(chat.id);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-left border-t border-slate-100 dark:border-slate-700 mt-1 pt-1 transition-colors font-medium"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* User Profile / Settings */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
            
            <button 
              onClick={() => navigate('/settings')}
              className="flex items-center gap-3 w-full p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm font-medium"
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                {profile?.image_url ? (
                  <img src={profile.image_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={16} />
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="truncate font-bold text-slate-700 dark:text-slate-200">
                  {isGuest ? 'Guest User' : (user?.email?.split('@')[0] || 'User')}
                </p>
                {!isGuest && user?.email && (
                  <p className="text-[10px] text-slate-400 truncate -mt-0.5 font-medium">{user.email}</p>
                )}
              </div>
              <Settings size={16} className="text-slate-400" />
            </button>
            {!isGuest ? (
              <button 
                onClick={signOut}
                className="flex items-center gap-3 w-full p-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors text-sm font-medium text-red-500"
              >
                <LogOut size={16} /> Logout
              </button>
            ) : (
              <button 
                onClick={signOut}
                className="flex items-center gap-3 w-full p-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all text-sm font-bold shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <LogIn size={16} /> Sign In / Create Account
              </button>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
