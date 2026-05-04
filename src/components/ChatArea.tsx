import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { AIModel, Message } from '../types';
import MessageItem from './MessageItem';
import FAB from './FAB';
import { Send, Image as ImageIcon, Sparkles, Loader2, ArrowDownCircle, X, Zap, Brain, Menu, Bug, MoreVertical, Trash2, Code, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';

interface ChatAreaProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

const ChatArea: React.FC<ChatAreaProps> = ({ onToggleSidebar, isSidebarOpen }) => {
  const { messages, sendMessage, stopGenerating, isStreaming, loading, chatsLoading, currentChatId, model, setModel, isLimitReached, clearChat, systemAlert, setSystemAlert } = useChat();
  const { isGuest, isDevMode, user } = useAuth();
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{name: string, url: string} | null>(null);
  
  const [isLearnMode, setIsLearnMode] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toggleDevMode } = useAuth();

  useEffect(() => {
    if (systemAlert) {
      const timer = setTimeout(() => {
        setSystemAlert(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [systemAlert, setSystemAlert]);

  // Debug logs for Dev Mode
  const [debugLogs, setDebugLogs] = useState<{msg: string, time: string}[]>([]);

  useEffect(() => {
    if (isDevMode) {
      const log = (msg: string) => {
        setDebugLogs(prev => [{ msg, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 30));
      };
      
      log(`Init: ${user?.email || 'Guest'}`);
      log(`Chat: ${currentChatId || 'None'}`);
      log(`Model: ${model}`);
    }
  }, [isDevMode, currentChatId, model, user]);

  useEffect(() => {
    if (isDevMode && messages.length > 0) {
      const last = messages[messages.length - 1];
      setDebugLogs(prev => [{ msg: `[${last.role}] ${last.content.slice(0, 15)}...`, time: new Date().toLocaleTimeString() }, ...prev]);
    }
  }, [messages, isDevMode]);

  const modelInfo = [
    { id: AIModel.LACK_2, name: 'Lack 2', icon: Zap, color: 'text-green-500' },
    { id: AIModel.LACK_3_5, name: 'Lack 3.5', icon: Sparkles, color: 'text-blue-500', restricted: isGuest },
    { id: AIModel.LACK_3, name: 'Lack 3', icon: Brain, color: 'text-purple-500', restricted: isGuest }
  ];

  const currentModel = modelInfo.find(m => m.id === model) || modelInfo[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;
    const content = input;
    const image = selectedImage || undefined;
    
    setInput('');
    setSelectedImage(null);
    await sendMessage(content, image, isLearnMode, isSearchMode);
    
    // Update message with excerpt if needed - but ChatContext needs update for this.
    // For now, let's keep it simple as originally requested for structure, 
    // but the user wanted excerpt.
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        setSystemAlert("File is too large. Max 10MB allowed.");
        return;
    }

    // Update stats
    const data = JSON.parse(localStorage.getItem('upload_stats') || '{"images": {"count": 0, "date": ""}, "files": {"count": 0, "date": ""}, "total": 0}');
    const today = new Date().toISOString().split('T')[0];
    if (data.images.date !== today) { data.images.count = 0; data.images.date = today; }
    if (data.files.date !== today) { data.files.count = 0; data.files.date = today; }

    if (type === 'image') { data.images.count++; }
    data.files.count++;
    data.total++;
    localStorage.setItem('upload_stats', JSON.stringify(data));

    const reader = new FileReader();
    reader.onloadend = () => {
        if (type === 'image') {
            setSelectedImage(reader.result as string);
        } else {
            setSelectedFile({ name: file.name, url: reader.result as string });
        }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Loading Overlay for History */}
      {chatsLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {/* System Alert Toast */}
      <AnimatePresence>
        {systemAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 16 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 bg-red-500 text-white font-medium rounded-2xl shadow-2xl flex items-center gap-3 border border-red-400"
          >
            <Zap size={16} />
            <span>{systemAlert}</span>
            <button onClick={() => setSystemAlert(null)} className="p-1 hover:bg-red-400 rounded-full transition-colors">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cool Header */}
      <header className="absolute top-0 left-0 right-0 z-10 px-4 py-3 flex items-center gap-3 pointer-events-none">
        <button 
          onClick={onToggleSidebar}
          className="pointer-events-auto p-2.5 glass-effect rounded-2xl shadow-lg active:scale-95 transition-all text-slate-500 hover:text-slate-900 dark:hover:text-white"
          title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Main model selector moved to FAB drop down */}
        </div>

        <div className="ml-auto pointer-events-auto relative">
          {/* Global 3-dot removed as requested */}
        </div>
      </header>

      {/* Dev Mode Debug Overly */}
      {isDevMode && (
        <div className="absolute top-16 right-4 z-50 w-64 max-h-60 bg-slate-900/90 text-[10px] font-mono text-green-400 p-2 rounded-xl border border-green-500/30 overflow-y-auto pointer-events-auto custom-scrollbar shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-2 pb-1 border-b border-green-500/20">
            <span className="font-bold flex items-center gap-1"><Bug size={10} /> SYSTEM LOGS</span>
            <span className="opacity-50 uppercase tracking-tighter">Live</span>
          </div>
          <div className="space-y-1">
            {debugLogs.length === 0 && <div className="opacity-30 italic">No events logged...</div>}
            {debugLogs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-slate-500">[{log.time}]</span>
                <span className="flex-1 break-all">{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message List */}
      <div 
        ref={scrollContainerRef}
        className={clsx(
          "flex-1 overflow-y-auto px-1 sm:px-3 md:px-4 pt-16 md:pt-20 pb-4 md:pb-8 custom-scrollbar",
          messages.length === 0 && "flex items-center justify-center"
        )}
      >
        <div className={clsx("max-w-3xl mx-auto flex flex-col space-y-4 md:space-y-0", messages.length === 0 && "w-full")}>
          {messages.length === 0 && (
              <div className="absolute inset-x-0 top-1/3 flex flex-col items-center justify-center p-8 z-0">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Hello, Start Your Task With Me!</h2>
            </div>
          )}
          {messages.map((msg, i) => {
            const isConsecutive = i > 0 && messages[i - 1].role === msg.role;
            const isGroupStart = !isConsecutive;
            
            return (
              <React.Fragment key={msg.id}>
                {isGroupStart && i > 0 && (
                  <div className="h-px bg-slate-200/50 dark:bg-white/[0.06] my-5" />
                )}
                <div className={isConsecutive ? "mt-2" : "mt-0"}>
                  <MessageItem 
                    message={msg} 
                    isLast={i === messages.length - 1} 
                    isConsecutive={isConsecutive} 
                  />
                </div>
              </React.Fragment>
            );
          })}
          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <React.Fragment>
              <div className="h-px bg-slate-200/50 dark:bg-white/[0.06] my-5" />
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 px-2 md:px-0"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm ring-2 ring-white dark:ring-slate-900">
                  <Sparkles className="text-blue-500 animate-pulse" size={18} />
                </div>
                <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.06] p-4 md:p-5 rounded-2xl shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <currentModel.icon size={14} className={currentModel.color} />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {currentModel.name}
                    </span>
                    {isSearchMode ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                          <Search size={10} className="animate-pulse" /> Searching web...
                        </span>
                        {/* Domain list placeholder for live appearance */}
                        <div className="flex flex-wrap gap-1">
                           <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md animate-pulse">finding...</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">is generating response</span>
                    )}
                  </div>
                  <div className="flex gap-1.5 items-center ml-1">
                    <motion.span animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <motion.span animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <motion.span animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  </div>
                </div>
              </motion.div>
            </React.Fragment>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className={clsx("p-3 md:p-8 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50 dark:via-slate-950 to-transparent", messages.length === 0 && "absolute inset-0 flex items-center justify-center")}>
        <div className={clsx("max-w-3xl mx-auto relative w-full", messages.length === 0 && "max-w-xl")}>
          
          <AnimatePresence>
            {(selectedImage || selectedFile) && (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="absolute -top-24 left-0 p-2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3"
              >
                {selectedImage && <img src={selectedImage} alt="Upload" className="w-16 h-16 object-cover rounded-xl" />}
                {selectedFile && <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xs font-bold truncate p-1">File</div>}
                <button 
                  onClick={() => { setSelectedImage(null); setSelectedFile(null); }}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-2 bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl p-1 md:p-2 shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
            <div className="p-1 md:p-2 shrink-0">
              <FAB 
                onUpload={handleFileChange} 
                isLearnMode={isLearnMode} 
                setIsLearnMode={setIsLearnMode} 
                isSearchMode={isSearchMode}
                setIsSearchMode={setIsSearchMode}
              />
            </div>
            
            <textarea 
              rows={1}
              value={input}
              disabled={isLimitReached}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isLimitReached ? "Login to continue" : "Ask anything..."}
              className="flex-1 bg-transparent border-none focus:ring-0 py-3 md:py-4 px-2 min-h-[48px] md:min-h-[56px] text-[15px] md:text-base resize-none outline-none dark:text-white disabled:opacity-50"
            />
            
            <div className="p-1 md:p-2 shrink-0">
              {isStreaming ? (
                <button 
                  onClick={() => stopGenerating && stopGenerating()}
                  className="p-2.5 md:p-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl md:rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center"
                >
                  <div className="w-3.5 h-3.5 md:w-4 md:h-4 bg-white rounded-sm" />
                </button>
              ) : (
                <button 
                  onClick={handleSend}
                  disabled={(!input.trim() && !selectedImage) || loading || isLimitReached}
                  className="p-2.5 md:p-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white rounded-xl md:rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                </button>
              )}
            </div>
          </div>
          
          <div className="mt-4 flex justify-center gap-4 text-[10px] uppercase tracking-widest font-bold text-slate-400">
            <span>AI responses may be inaccurate</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
