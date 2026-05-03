import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { Mail, Lock, LogIn, ChevronRight, Globe, Sparkles, Brain, Cpu, MessageSquare, User } from 'lucide-react';

const AuthPage: React.FC = () => {
  const { enterGuestMode, resetPassword } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  // High quality abstract background placeholder
  const authBgUrl = "https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2532&auto=format&fit=crop";

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResetSuccess(false);

    try {
      if (isResetting) {
        await resetPassword(email);
        setResetSuccess(true);
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password
        });
        if (error) throw error;
        alert('Check your email for confirmation!');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        type: 'spring', 
        damping: 20 
      } 
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#020617] overflow-hidden">
      {/* Left Side: Dynamic Visuals (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 border-r border-slate-800 p-12 flex-col justify-between">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img 
            src={authBgUrl} 
            alt="Background" 
            className="w-full h-full object-cover opacity-60 scale-110 animate-pulse-slow"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/40 to-transparent" />
        </div>

        <div className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 mb-16"
          >
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Sparkles className="text-white" size={20} />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Lack Chat</span>
          </motion.div>

          <div className="space-y-12 max-w-lg">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-6xl font-bold text-white leading-[0.9] tracking-tighter"
            >
              The Next <span className="text-blue-500">Evolution</span> of Thought.
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-slate-400 text-lg"
            >
              Connect with Lack Intelligence. Faster processing, deeper reasoning, and unlimited creative potential at your fingertips.
            </motion.p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-6">
          {[
            { icon: Brain, label: 'Deep Reasoning', desc: 'Complex problem solving' },
            { icon: Cpu, label: 'Ultra Fast', desc: 'Real-time response delivery' },
          ].map((item, i) => (
            <motion.div 
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + (i * 0.1) }}
              className="glass-effect p-4 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl"
            >
              <item.icon className="text-blue-500 mb-2" size={20} />
              <div className="text-white font-bold text-sm">{item.label}</div>
              <div className="text-slate-500 text-xs">{item.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md space-y-8"
        >
          <motion.div variants={itemVariants} className="lg:hidden text-center mb-8">
             <div className="w-12 h-12 bg-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl shadow-blue-500/20">
              <Sparkles className="text-white" size={24} />
            </div>
            <h1 className="text-3xl font-bold">Lack Chat</h1>
          </motion.div>

          <div className="space-y-2 text-center lg:text-left">
            <motion.h2 variants={itemVariants} className="text-4xl font-bold tracking-tight">
              {isResetting ? 'Reset Password' : (isLogin ? 'Sign In' : 'Join the Future')}
            </motion.h2>
            <motion.p variants={itemVariants} className="text-slate-500">
              {isResetting 
                ? 'Enter your email to receive a reset link.' 
                : (isLogin ? 'Welcome back, let\'s resume the conversation.' : 'Start your journey with artificial intelligence today.')
              }
            </motion.p>
          </div>

          <motion.form variants={itemVariants} onSubmit={handleAuth} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email address</label>
              <div className="group relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                </div>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {!isResetting && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Password</label>
                  {isLogin && (
                    <button 
                      type="button"
                      onClick={() => {
                        setIsResetting(true);
                        setError(null);
                        setResetSuccess(false);
                      }}
                      className="text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors uppercase tracking-wider"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="group relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  </div>
                  <input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!isResetting}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-sm font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="text-red-500 text-xs font-medium bg-red-500/10 p-3 rounded-xl border border-red-500/20"
              >
                {error}
              </motion.div>
            )}

            {resetSuccess && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }}
                className="text-green-500 text-xs font-medium bg-green-500/10 p-3 rounded-xl border border-green-500/20"
              >
                Reset link sent! Check your inbox.
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group overflow-hidden relative"
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Synchronizing...</span>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="normal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span>{isResetting ? 'Send Reset Link' : (isLogin ? 'Access Interface' : 'Begin Experience')}</span>
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
            {isResetting && (
              <button 
                type="button"
                onClick={() => {
                  setIsResetting(false);
                  setResetSuccess(false);
                  setError(null);
                }}
                className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors uppercase tracking-wider py-2"
              >
                Back to sign in
              </button>
            )}
          </motion.form>

          {!isResetting && (
            <>
              <motion.div variants={itemVariants} className="relative pt-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-white/5"></div></div>
                <div className="relative flex justify-center text-[10px] items-center"><span className="bg-slate-50 dark:bg-[#020617] px-4 text-slate-400 font-bold uppercase tracking-[0.2em] mb-1">Direct Entry</span></div>
              </motion.div>

              <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleGoogleLogin}
                  className="flex items-center justify-center gap-2 py-4 border border-slate-200 dark:border-white/5 rounded-2xl hover:bg-white dark:hover:bg-slate-900 shadow-sm transition-all text-sm font-bold active:scale-95"
                >
                  <Globe size={18} className="text-blue-500" /> Google
                </button>
                <button 
                  onClick={enterGuestMode}
                  className="flex items-center justify-center gap-2 py-4 bg-slate-100 dark:bg-white/5 rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-sm font-bold active:scale-95"
                >
                  <User size={18} className="text-slate-400" /> Guest mode
                </button>
              </motion.div>

              <motion.div variants={itemVariants} className="text-center pt-8">
                <p className="text-sm text-slate-500 font-medium">
                  {isLogin ? "New to the system?" : "Already part of the neural link?"}
                  <button 
                    onClick={() => setIsLogin(!isLogin)}
                    className="ml-2 text-blue-500 font-bold hover:text-blue-600 transition-colors"
                  >
                    {isLogin ? 'Request access' : 'Enter login'}
                  </button>
                </p>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
