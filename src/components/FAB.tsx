import React, { useState, useRef } from 'react';
import { Plus, Image as ImageIcon, Sparkles, Search, Zap, Brain, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { AIModel } from '../types';
import { useChat } from '../contexts/ChatContext';
import { clsx } from 'clsx';

interface FABProps {
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => void;
  isLearnMode: boolean;
  setIsLearnMode: (val: boolean) => void;
  isSearchMode: boolean;
  setIsSearchMode: (val: boolean) => void;
}

const modelInfo = [
  { id: AIModel.LACK_2, name: 'Lack 2', icon: Zap, color: 'text-green-500' },
  { id: AIModel.LACK_3_5, name: 'Lack 3.5', icon: Sparkles, color: 'text-blue-500' },
  { id: AIModel.LACK_3, name: 'Lack 3', icon: Brain, color: 'text-purple-500' }
];

const FAB: React.FC<FABProps> = ({ onUpload, isLearnMode, setIsLearnMode, isSearchMode, setIsSearchMode }) => {
  const { isGuest } = useAuth();
  const { model, setModel } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'image' | 'file' | null>(null);

  if (isGuest) return null;

  const checkLimit = (type: 'image' | 'file') => {
    return true; // Simplified for this example
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-full left-0 mb-4 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 origin-bottom-left"
          >
            {showModels ? (
              <>
                <button 
                  onClick={() => setShowModels(false)}
                  className="w-full flex items-center gap-2 p-2 px-3 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-2"
                >
                  <ChevronRight size={14} className="rotate-180" /> Back
                </button>
                {modelInfo.map((m) => (
                    <button 
                      key={m.id}
                      onClick={() => {
                        setModel(m.id);
                        setIsOpen(false);
                      }}
                      className={clsx(
                        "w-full flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-colors text-left",
                        "hover:bg-slate-100 dark:hover:bg-slate-800",
                        model === m.id && "bg-blue-50 dark:bg-blue-900/20 text-blue-500"
                      )}
                    >
                      <m.icon size={16} className={m.color} />
                      <span className="flex-1">{m.name}</span>
                    </button>
                  ))}
              </>
            ) : (
              <>
                <button 
                  onClick={() => setShowModels(true)}
                  className="w-full flex items-center justify-between p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm font-medium"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                      {(() => {
                        const Icon = modelInfo.find(m => m.id === model)?.icon || Zap;
                        return <Icon size={16} className={modelInfo.find(m => m.id === model)?.color} />;
                      })()}
                    </div>
                    <span>Switch Model</span>
                  </div>
                  <ChevronRight size={14} className="text-slate-400" />
                </button>
                
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />

                <button 
                  onClick={() => {
                    setUploadType('image');
                    fileInputRef.current?.click();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm font-medium"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                    <ImageIcon size={16} />
                  </div>
                  Upload Image
                </button>
                <button 
                  onClick={() => {
                    setIsLearnMode(!isLearnMode);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm font-medium ${isLearnMode ? 'text-blue-500' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isLearnMode ? 'bg-blue-500 text-white' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-500'}`}>
                    <Sparkles size={16} />
                  </div>
                  Learn Mode {isLearnMode ? '(On)' : ''}
                </button>
                <button 
                  onClick={() => {
                    setIsSearchMode(!isSearchMode);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm font-medium ${isSearchMode ? 'text-blue-500' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSearchMode ? 'bg-blue-500 text-white' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500'}`}>
                    <Search size={16} />
                  </div>
                  Search Mode {isSearchMode ? '(On)' : ''}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => {
          if (!isOpen) setShowModels(false);
          setIsOpen(!isOpen);
        }}
        className={`p-3 rounded-2xl transition-all shadow-lg active:scale-95 ${isOpen ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
      >
        <Plus size={20} className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} />
      </button>

      <input 
        type="file"
        ref={fileInputRef}
        onChange={(e) => onUpload(e, uploadType!)}
        className="hidden"
      />
    </div>
  );
};

export default FAB;
