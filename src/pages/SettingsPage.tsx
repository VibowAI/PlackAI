import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useChat } from '../contexts/ChatContext';
import { AIModel } from '../types';
import { motion } from 'motion/react';
import { 
  ChevronLeft, Moon, Sun, Monitor, Brain, Zap, Sparkles, 
  Trash2, User, AlertTriangle, Check, ShieldAlert, Bug, Globe, RefreshCcw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const SettingsPage: React.FC = () => {
  const { user, profile, isGuest, deleteAccount, updateProfile, saveAvatar, isDevMode, toggleDevMode } = useAuth();
  const navigate = useNavigate();
  
  const [avatarUrl, setAvatarUrl] = useState(profile?.image_url || '');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [saving, setSaving] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (profile) setAvatarUrl(profile.image_url || '');
  }, [profile]);

  const handleSaveProfile = async () => {
    if (isGuest || !user) return;
    setSaving(true);
    try {
      await saveAvatar(avatarUrl);
      alert('Profile updated!');
    } catch (error) {
      console.error('Save avatar error:', error);
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large. Please select an image under 2MB.");
      return;
    }

    try {
      const fileName = `${user!.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const { data, error } = await supabase.storage.from('avatars').upload(fileName, file);
      
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error('Avatar upload error:', err);
      alert('Failed to upload image. Make sure "avatars" bucket is public.');
    }
  };


  const handleDelete = async () => {
    const success = await deleteAccount(deleteInput);
    if (success) {
      navigate('/auth');
    } else {
      alert('Failed to delete. Please type DELETE exactly.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-8 group"
        >
          <ChevronLeft className="group-hover:-translate-x-1 transition-transform" /> Back to Chat
        </button>

                <h1 className="text-3xl font-semibold mb-8">Settings</h1>

        <div className="space-y-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mt-8">General</h2>
          
          {/* Theme Section */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sun size={20} className="text-slate-500" /> Theme Settings
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setTheme('light')}
                className={`py-3 px-4 rounded-xl flex flex-col items-center gap-2 border-2 transition-all ${
                  theme === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun size={20} /> Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`py-3 px-4 rounded-xl flex flex-col items-center gap-2 border-2 transition-all ${
                  theme === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon size={20} /> Dark
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`py-3 px-4 rounded-xl flex flex-col items-center gap-2 border-2 transition-all ${
                  theme === 'system' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Monitor size={20} /> System
              </button>
            </div>
          </section>

          {/* New Language Section */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Globe size={20} className="text-slate-500" /> Language
            </h2>
            <select className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl py-3 px-4 outline-none">
              <option>English (US)</option>
              <option>Bahasa Indonesia</option>
              <option>Español</option>
            </select>
          </section>

          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Profile</h2>
          {/* Profile Section */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User size={20} className="text-slate-500" /> User Profile
            </h2>
            {isGuest ? (
              <p className="text-sm text-slate-500 italic">Profile persistence disabled in Guest Mode.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={32} className="text-slate-400" />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-500 ml-1 block mb-1">Upload Local Image</label>
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-slate-500
                      file:mr-4 file:py-3 file:px-4
                      file:rounded-2xl file:border-0
                      file:text-sm file:font-semibold
                      file:bg-slate-100 file:text-slate-700
                      hover:file:bg-slate-200
                      dark:file:bg-slate-800 dark:file:text-slate-300 dark:hover:file:bg-slate-700
                      cursor-pointer"
                  />
                </div>
                <button 
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all shadow-lg shadow-blue-500/20"
                >
                  {saving ? 'Saving...' : 'Update Profile'}
                </button>

              </div>
            )}
          </section>

          {/* Dev Mode Section - Only for Owner */}
          {user?.email === 'talkgte.vibow@gmail.com' && (
            <section className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-6 border border-blue-500/30 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Bug size={80} className="text-blue-500" />
              </div>
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Bug size={20} className="text-blue-500" /> Developer Mode
                  </h2>
                  <p className="text-slate-400 text-xs mt-1">Access advanced debugging tools and system logs.</p>
                </div>
                <button 
                  onClick={toggleDevMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isDevMode ? 'bg-blue-500' : 'bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDevMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </section>
          )}


          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Data</h2>
          <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <button className="w-full flex items-center justify-between py-3 px-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
               <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold"><Trash2 size={18}/> Clear All Chats</span>
            </button>
            <button className="w-full flex items-center justify-between py-3 px-4 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
               <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold"><RefreshCcw size={18}/> Restore Defaults</span>
            </button>
          </section>
          {/* Account Danger Zone */}
          {!isGuest && (
            <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-red-500/20 shadow-sm">
              <h2 className="text-lg font-semibold mb-2 text-red-500 flex items-center gap-2">
                <AlertTriangle size={20} /> Danger Zone
              </h2>
              <p className="text-sm text-slate-500 mb-6">Once you delete your account, there is no going back. Please be certain.</p>
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="w-full py-4 border-2 border-red-500/50 hover:bg-red-500 hover:text-white text-red-500 font-semibold rounded-2xl transition-all"
              >
                Permanently Delete Account
              </button>
            </section>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-red-500/20"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldAlert size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Final Confirmation</h3>
              <p className="text-slate-500 text-sm">
                This will delete all your chats, messages, and profile data from our servers.
                Type <strong>DELETE</strong> below to proceed.
              </p>
            </div>
            
            <input 
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE"
              className="w-full bg-slate-100 dark:bg-slate-800 border-2 border-red-500/20 focus:border-red-500 rounded-2xl py-4 px-4 text-center text-lg font-bold outline-none mb-6 transition-all"
            />

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-red-500/30"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
