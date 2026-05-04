import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';
import { motion, Variants } from 'motion/react';
import { Copy, Check, Sparkles, User, Brain, Clock, ChevronDown, ChevronRight, Loader2, Cpu, ThumbsUp, ThumbsDown, RotateCcw, ChevronLeft, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';

interface MessageItemProps {
  message: Message;
  isLast: boolean;
  isConsecutive?: boolean;
  onReply?: (message: Message, excerpt?: string) => void;
  quotedMessage?: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, isLast, isConsecutive, onReply, quotedMessage }) => {
  const { profile } = useAuth();
  const { sendFeedback, sendMessage, regenerateMessage, editMessage, changeMessageVersion, isStreaming } = useChat();
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const [showFloatingReply, setShowFloatingReply] = useState<{x: number, y: number, excerpt: string} | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);

  const handleFeedback = (type: 'like' | 'dislike') => {
    setFeedback(type);
    sendFeedback(message.id, type);
  };

  const isAI = message.role === 'assistant';
  const isLack3 = message.model_used === 'gemini-3.1-pro-preview';
  
  const parseLack3Content = (text: string) => {
    let plan = '';
    let execution = '';
    let answer = '';

    const planStart = text.indexOf('<plan>');
    const planEnd = text.indexOf('</plan>');
    if (planStart !== -1) {
      plan = text.slice(planStart + 6, planEnd !== -1 ? planEnd : undefined).trim();
    }

    const execStart = text.indexOf('<execution>');
    const execEnd = text.indexOf('</execution>');
    if (execStart !== -1) {
      execution = text.slice(execStart + 11, execEnd !== -1 ? execEnd : undefined).trim();
    }

    const ansStart = text.indexOf('<answer>');
    const ansEnd = text.indexOf('</answer>');
    if (ansStart !== -1) {
      answer = text.slice(ansStart + 8, ansEnd !== -1 ? ansEnd : undefined).trim();
      if (ansEnd !== -1) {
        const afterAnswer = text.slice(ansEnd + 9).trim();
        if (afterAnswer) answer += '\n\n' + afterAnswer;
      }
    } else if (text && planStart === -1 && execStart === -1) {
      // Fallback if the model didn't use tags at all
      answer = text;
    }

    let status = 'Done';
    const isGenerating = !text || (text.length > 0 && isLast && ansEnd === -1);
    
    if (isGenerating && planStart !== -1 && planEnd === -1) status = 'Planning...';
    else if (isGenerating && planEnd !== -1 && execStart === -1) status = 'Planning...';
    else if (isGenerating && execStart !== -1 && execEnd === -1) status = 'Executing...';
    else if (isGenerating && execEnd !== -1 && ansStart === -1) status = 'Finalizing...';
    else if (isGenerating && ansStart !== -1) status = 'Answering...';
    else if (isGenerating && !text) status = 'Thinking...';

    return { plan, execution, answer, status, isGenerating };
  };

  const [copied, setCopied] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'plan' | 'execution' | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const currentVersionIdx = message.current_version ?? (message.versions ? message.versions.length - 1 : 0);

  const activeContent = (message.versions && message.versions[currentVersionIdx]) 
      ? message.versions[currentVersionIdx].content 
      : (message.content || '');
  const activeModel = (message.versions && message.versions[currentVersionIdx]?.model_used) || message.model_used;
  const isLack3ThisVersion = activeModel === 'gemini-3.1-pro-preview';

  const { plan, execution, answer, status, isGenerating } = isLack3ThisVersion && isAI 
    ? parseLack3Content(activeContent) 
    : { plan: '', execution: '', answer: activeContent, status: 'Done', isGenerating: isLast && !activeContent };


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bubbleVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 8,
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const SmartLink = ({ text }: { text: string }) => {
    const { sendMessage } = useChat();
    
    // Mapping of inline actions to PREDEFINED prompts
    const promptMap: Record<string, string> = {
      "compare useState vs useReducer": "Compare useState and useReducer with examples",
      "build a todo app": "Build a simple React todo app example",
      "show real project structure": "Show a real-world project structure for a React app",
      "add error handling": "Show how to add error handling to this code",
      "convert this to async/await": "Convert this function to use async/await"
    };

    const prompt = promptMap[text] || text;

    return (
      <button
        onClick={() => sendMessage(prompt)}
        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline font-semibold transition-colors"
      >
        {text}
      </button>
    );
  };

  const renderContent = (text: string) => {
    const parts = text.split(/\[(.*?)\]/g);
    return parts.map((part, i) => {
      // Every odd part is an action [text]
      if (i % 2 === 1) {
        return <SmartLink key={i} text={part} />;
      }
      return part;
    });
  };
  
  // Inside ReactMarkdown renderer, I'll need to wrap p or other tags.
  // Actually, standard react-markdown doesn't support this easily. 
  // I will just apply renderContent to the message content before passing it to ReactMarkdown, 
  // BUT that will mess up parsing if ReactMarkdown expects raw markdown.
  // Okay, let's keep it simple: Replace [text] in markdown content with <button> via a re-rendering or custom component.
  // Actually, I can use a rehype plugin or custom component map. Let's use custom component map.

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={bubbleVariants}
      className={clsx(
        "relative flex gap-3 px-2 md:px-0",
        isAI ? "flex-row items-start" : "flex-row-reverse items-start"
      )}
      ref={messageRef}
    >
      <div className={clsx(
        "flex flex-col gap-1 min-w-0 w-full",
        isAI ? "items-start" : "items-end text-right"
      )}>
        {/* Attachment */}
        {message.image_url && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={clsx("mb-1", !isAI && "flex justify-end")}
          >
            <img 
              src={message.image_url} 
              alt="Attachment" 
              className="max-w-[200px] md:max-w-xs rounded-2xl shadow-md border-2 border-white dark:border-slate-800" 
            />
          </motion.div>
        )}

        {/* Bubble / Content */}
        <div className={clsx(
          "relative group/bubble transition-all duration-200",
          "leading-relaxed text-[15px] md:text-base w-full min-w-0",
          isAI 
            ? "text-slate-800 dark:text-slate-200"
            : "bg-blue-600 text-white rounded-2xl rounded-tr-sm shadow-lg shadow-blue-500/10 px-3.5 py-2.5 md:px-5 md:py-4 overflow-hidden w-fit ml-auto"
        )}>
          {/* Reply Header */}
          {quotedMessage && (
            <div className="mb-2 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs text-slate-500 border-l-4 border-blue-500">
              <div className="font-bold mb-1">Reply to:</div>
              <div className="truncate">{quotedMessage.content.slice(0, 50)}...</div>
            </div>
          )}

          {isLack3 && isAI && (
            <div className="flex flex-col gap-2 w-full">
              {/* Status Bar */}
              {isGenerating && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-blue-500 font-medium text-xs bg-blue-50 dark:bg-slate-800/50 w-fit px-3 py-1.5 rounded-full shadow-sm mb-1"
                >
                  <Cpu size={14} className="animate-pulse" />
                  <span className="tracking-wide uppercase">{status}</span>
                </motion.div>
              )}

              {/* Plan Section */}
              {plan && (
                <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === 'plan' ? null : 'plan')}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium text-xs uppercase tracking-wider">
                      <Brain size={14} />
                      <span>Task Analysis & Plan</span>
                    </div>
                    {expandedSection === 'plan' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expandedSection === 'plan' && (
                    <motion.div 
                      initial={{ height: 0 }} animate={{ height: 'auto' }}
                      className="px-4 pb-3 pt-1 text-[13px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed border-t border-slate-100 dark:border-slate-800"
                    >
                      {plan}
                    </motion.div>
                  )}
                </div>
              )}

              {/* Execution Section */}
              {execution && (
                <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                  <button 
                    onClick={() => setExpandedSection(expandedSection === 'execution' ? null : 'execution')}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium text-xs uppercase tracking-wider">
                      <Cpu size={14} />
                      <span>Execution & Reasoning</span>
                    </div>
                    {expandedSection === 'execution' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {expandedSection === 'execution' && (
                    <motion.div 
                      initial={{ height: 0 }} animate={{ height: 'auto' }}
                      className="px-4 pb-3 pt-1 text-[13px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed border-t border-slate-100 dark:border-slate-800"
                    >
                      {execution}
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className={clsx(
            "markdown-body prose dark:prose-invert max-w-none prose-sm md:prose-base !text-inherit min-w-0 overflow-x-auto",
            isAI && "text-slate-800 dark:text-slate-200 w-full",
            "leading-[1.6] md:leading-[1.7]"
          )}>
            {!isAI && isEditing ? (
              <div className="flex flex-col gap-2 min-w-[200px] sm:min-w-[300px]">
                <textarea 
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl p-3 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[100px]"
                />
                <div className="flex justify-end gap-2 mt-1">
                  <button 
                    onClick={() => {
                        setIsEditing(false);
                        setEditedContent(message.content);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                        setIsEditing(false);
                        editMessage(message.id, editedContent);
                    }}
                    disabled={!editedContent.trim() || editedContent === message.content}
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-800 rounded-lg transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : message.content ? (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: (props) => <h1 className="text-xl font-semibold mb-2 mt-4 text-slate-900 dark:text-white" {...props} />,
                  h2: (props) => <h2 className="text-lg font-semibold mb-2 mt-4 text-slate-900 dark:text-white" {...props} />,
                  h3: (props) => <h3 className="text-base font-semibold mb-2 mt-3 text-slate-900 dark:text-white" {...props} />,
                  p: (props) => <p className="mb-2.5 leading-[1.7]">{typeof props.children === 'string' ? renderContent(props.children) : props.children}</p>,
                  a: (props) => <a className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer" {...props} />,
                  ul: (props) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1.5" {...props} />,
                  ol: (props) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1.5" {...props} />,
                  li: (props) => <li className="leading-[1.7]">{typeof props.children === 'string' ? renderContent(props.children) : props.children}</li>,
                  table: (props) => <div className="overflow-x-auto my-4 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700" {...props} /></div>,
                  thead: (props) => <thead className="bg-slate-50 dark:bg-slate-800" {...props} />,
                  tbody: (props) => <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800" {...props} />,
                  tr: (props) => <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" {...props} />,
                  th: (props) => <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider" {...props} />,
                  td: (props) => <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300" {...props} />,
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeContent = String(children).replace(/\n$/, '');
                    
                    if (!inline && match) {
                      return (
                        <div className="relative my-4 group/code">
                          <div className="absolute right-3 top-3 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
                            <button 
                              onClick={() => copyToClipboard(codeContent)}
                              className="p-1.5 bg-slate-800/80 hover:bg-slate-800 text-white rounded-lg backdrop-blur-md transition-all shadow-xl"
                            >
                              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                          </div>
                          <div className="bg-[#0f1117] rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl">
                            <div className="px-4 py-2 bg-white/5 border-b border-white/[0.08] text-[10px] uppercase tracking-widest text-slate-400 font-black flex justify-between items-center">
                              <span>{match[1]}</span>
                            </div>
                            <pre className="p-[14px] overflow-x-auto custom-scrollbar">
                              <code 
                                className="font-mono text-xs text-slate-200 font-normal leading-relaxed" 
                                {...props}
                              >
                                {children}
                              </code>
                            </pre>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <code className={clsx(
                        "font-mono text-xs px-1.5 py-0.5 rounded-md",
                        isAI ? "bg-slate-100 dark:bg-slate-800 text-blue-500 font-bold" : "bg-white/20 text-white font-bold"
                      )} {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {isLack3 ? answer : message.content}
              </ReactMarkdown>
            ) : (
              <div className="flex gap-1.5 py-1 items-center ml-1">
                <motion.span 
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} 
                  transition={{ repeat: Infinity, duration: 1 }} 
                  className={clsx("w-1.5 h-1.5 rounded-full", isAI ? "bg-blue-500" : "bg-white")}
                />
                <motion.span 
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} 
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} 
                  className={clsx("w-1.5 h-1.5 rounded-full", isAI ? "bg-blue-500" : "bg-white")}
                />
                <motion.span 
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} 
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} 
                  className={clsx("w-1.5 h-1.5 rounded-full", isAI ? "bg-blue-500" : "bg-white")}
                />
              </div>
            )}
            
            {/* Auto Suggestions */}
            {isAI && showSuggestions && suggestions.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="flex flex-wrap gap-2 mt-4"
                >
                    {suggestions.map((s, idx) => (
                        <button
                            key={idx}
                            onClick={() => sendMessage(s)}
                            className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-3 py-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border border-slate-200 dark:border-slate-700"
                        >
                            {s}
                        </button>
                    ))}
                </motion.div>
            )}
            
          </div>
        </div>

        <div className={clsx(
          "flex items-center gap-2 mt-1",
          isAI ? "opacity-100" : "opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-200",
          !isAI && "flex-row-reverse"
        )}>
          {isAI && (
            <div className="flex items-center gap-3">
              {message.versions && message.versions.length > 1 && (
                <div className="flex items-center gap-1 text-[11px] text-slate-400 select-none">
                  <button 
                    disabled={currentVersionIdx === 0}
                    onClick={() => {
                        const newIdx = currentVersionIdx - 1;
                        changeMessageVersion(message.id, newIdx);
                    }}
                    className="p-1 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <span className="font-mono">
                    {currentVersionIdx + 1}/{message.versions.length}
                  </span>
                  <button 
                    disabled={currentVersionIdx === message.versions.length - 1}
                    onClick={() => {
                        const newIdx = currentVersionIdx + 1;
                        changeMessageVersion(message.id, newIdx);
                    }}
                    className="p-1 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}

              <button 
                onClick={() => copyToClipboard(isLack3 ? answer : message.content || '')}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />} 
                {copied ? 'Copied' : 'Copy'}
              </button>
              
              {!isStreaming && regenerateMessage && (
                <button 
                  onClick={() => regenerateMessage(message.id)}
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
                 >
                   <RotateCcw size={12} /> Regenerate
                 </button>
              )}

              <button 
                onClick={() => handleFeedback('like')}
                className={clsx("text-[11px] flex items-center gap-1 transition-colors", feedback === 'like' ? "text-blue-500" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200")}
              >
                <ThumbsUp size={12} />
              </button>
              <button 
                onClick={() => handleFeedback('dislike')}
                className={clsx("text-[11px] flex items-center gap-1 transition-colors", feedback === 'dislike' ? "text-red-500" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200")}
              >
                <ThumbsDown size={12} />
              </button>
            </div>
          )}

          {!isAI && !isEditing && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsEditing(true)}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                 Edit
              </button>
              <button 
                onClick={() => copyToClipboard(message.content || '')}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                 Copy
              </button>
              {message.is_error && (
                <button 
                  onClick={() => {
                    copyToClipboard(message.content || '');
                  }}
                  className="text-[11px] text-red-500 flex items-center gap-1 transition-colors hover:text-red-600"
                >
                  <AlertCircle size={12} /> Failed to send (Click to copy)
                </button>
              )}
              {!message.is_error && (
                <button 
                  onClick={() => copyToClipboard(message.content || '')}
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />} 
                </button>
              )}
            </div>
          )}

          <span className="text-[11px] text-slate-400 font-medium px-1 flex items-center gap-1.5">
            <Clock size={10} /> {formatTime(message.created_at)}
          </span>
          {message.is_stopped && (
            <span className="text-[10px] text-orange-500 font-bold uppercase tracking-tighter">
              • Stopped
            </span>
          )}
          {isAI && isLast && !message.is_stopped && (
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter">
              • {message.model_used?.replace('models/', '').split('-')[1]}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MessageItem;
