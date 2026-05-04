import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Chat, Message, AIModel, ChatContextType } from '../types';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isGuest, profile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [model, setModel] = useState<AIModel>(AIModel.LACK_2);
  const [guestMessageCount, setGuestMessageCount] = useState<number>(0);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  useEffect(() => {
    if (isGuest) {
      const today = new Date().toISOString().split('T')[0];
      const saved = sessionStorage.getItem('guest_usage');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) {
          setGuestMessageCount(parsed.count);
        } else {
          setGuestMessageCount(0);
        }
      }
    }
  }, [isGuest]);

  useEffect(() => {
    if (user && !isGuest) {
      loadChats(false).then(() => {
        createNewChat();
      });
    } else {
      setChats([]);
      createNewChat();
    }
  }, [user, isGuest]);

  useEffect(() => {
    setMessages([]);
    if (currentChatId) {
      if (!currentChatId.startsWith('guest_') && !currentChatId.startsWith('new_chat_')) {
        loadMessages(currentChatId);
      }
    }
  }, [currentChatId]);

  const loadChats = async (autoSelect = true) => {
    if (!user) return;
    setChatsLoading(true);
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setChats(data);
      if (data.length > 0 && !currentChatId && autoSelect) {
        setCurrentChatId(data[0].id);
      }
    }
    setChatsLoading(false);
  };

  const loadMessages = async (chatId: string) => {
    if (isGuest) return;
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (!error) setMessages(data || []);
  };

  const createNewChat = async () => {
    const tempId = isGuest ? `guest_${Date.now()}` : `new_chat_${Date.now()}`;
    setCurrentChatId(tempId);
    setMessages([]);
    return tempId;
  };

  const selectChat = (id: string) => {
    setCurrentChatId(id);
  };

  const checkUsageLimit = async (selectedModel: AIModel) => {
    if (selectedModel !== AIModel.LACK_3) return true;
    if (isGuest) return false;
    if (!profile) return false;

    const today = new Date().toISOString().split('T')[0];
    const usage = profile.lack2_usage || { count: 0, last_reset: today };

    if (usage.last_reset !== today) {
      usage.count = 0;
      usage.last_reset = today;
    }

    if (usage.count >= 3) return false;

    const { error } = await supabase
      .from('profiles')
      .update({ lack2_usage: { count: usage.count + 1, last_reset: today } })
      .eq('id', profile.id);

    return !error;
  };

  const generateChatTitle = async (chatId: string, firstUserMsg: string) => {
    try {
      const prompt = `Generate a short title (max 5 words) for this conversation:\n${firstUserMsg}`;

      const response = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          model: AIModel.LACK_3_5
        })
      });

      if (!response.ok) {
        throw new Error('API error');
      }

      const data = await response.json();
      const rawTitle =
        data.response ||
        data.data?.response ||
        data.text ||
        data.data?.text ||
        '';

      let newTitle = rawTitle.trim().replace(/["*]/g, '') || `${firstUserMsg.slice(0, 30)}...`;
      if (newTitle.length > 50) newTitle = newTitle.slice(0, 50) + '...';

      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c));

      if (!isGuest) {
        await supabase.from('chats').update({ title: newTitle }).eq('id', chatId);
      }
    } catch (e) {
      console.error('Title generation failed', e);
      const fallbackTitle = `${firstUserMsg.slice(0, 30)}...`;
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: fallbackTitle } : c));

      if (!isGuest) {
        await supabase.from('chats').update({ title: fallbackTitle }).eq('id', chatId);
      }
    }
  };

  const generateAIResponse = async (
    activeChatId: string,
    effectiveModel: AIModel,
    chatHistory: Message[],
    content: string,
    image?: string,
    isLearnMode?: boolean,
    isSearchMode?: boolean,
    existingAiMessageId?: string
  ) => {
    try {
      setLoading(true);
      setIsStreaming(true);
      abortControllerRef.current = new AbortController();

      const prompt = isLearnMode
        ? `Explain this in a structured, step-by-step educational format: ${content}`
        : content;

      const previousContents = chatHistory.map(m => {
        let contentText = m.content || ' ';
        if (m.role === 'assistant' && m.versions && m.versions.length > 0) {
          contentText = m.versions[m.current_version || Math.max(0, m.versions.length - 1)].content || ' ';
        }
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: contentText }]
        };
      });

      const newParts: any[] = [{ text: prompt }];
      if (image) {
        newParts.push({
          inlineData: {
            data: image.split(',')[1],
            mimeType: 'image/jpeg'
          }
        });
      }

      const allContents = [
        ...previousContents,
        { role: 'user', parts: newParts }
      ];

      const generateConfig: any = {};

      if (isSearchMode) {
        generateConfig.tools = [{ googleSearch: {} }];
      }

      if (effectiveModel === AIModel.LACK_3) {
        generateConfig.systemInstruction = `You are an intelligent agent representing the Lack 3 AI model.
You MUST analyze the user request and think step-by-step internally before answering.
You MUST format your response EXACTLY like this:

<plan>
List your brief, clean task understanding and strategy.
</plan>
<execution>
Provide your step-by-step reasoning or internal thoughts here.
</execution>
<answer>
Provide your final, clean answer here.
</answer>

Do NOT omit any of the tags (<plan>, </plan>, <execution>, </execution>, <answer>, </answer>). Always adhere strictly to this structure.`;
      }

      const aiMessageId = existingAiMessageId || `ai_${Date.now()}`;
      let isAborted = false;

      setMessages(prev => {
        if (existingAiMessageId) {
          return prev.map(m => {
            if (m.id === existingAiMessageId) {
              const currentVersions = m.versions || [{ content: m.content, model_used: m.model_used, created_at: m.created_at }];
              return {
                ...m,
                is_stopped: false,
                content: '',
                versions: [...currentVersions, { content: '', model_used: effectiveModel, created_at: new Date().toISOString() }],
                current_version: currentVersions.length
              };
            }
            return m;
          });
        }

        return [...prev, {
          id: aiMessageId,
          chat_id: activeChatId!,
          role: 'assistant',
          content: '',
          model_used: effectiveModel,
          is_learn_mode: isLearnMode,
          is_search_mode: isSearchMode,
          created_at: new Date().toISOString(),
          versions: [{ content: '', model_used: effectiveModel, created_at: new Date().toISOString() }],
          current_version: 0
        }];
      });

      const response = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          model: effectiveModel,
          contents: allContents,
          config: Object.keys(generateConfig).length > 0 ? generateConfig : undefined
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch AI response');
      }

      const data = await response.json();

      let aiResponseContent =
        data.response ||
        data.data?.response ||
        data.text ||
        data.data?.text ||
        '';

      if (isSearchMode && data.groundingMetadata) {
        const chunks = data.groundingMetadata?.groundingChunks;
        if (chunks && chunks.length > 0) {
          const webSources = chunks.map((c: any) => c.web).filter(Boolean);
          if (webSources.length > 0) {
            const uniqueUris = Array.from(new Set(webSources.map((w: any) => w?.uri)));
            const uniqueSources = uniqueUris.map(uri => webSources.find((w: any) => w?.uri === uri));

            const sourcesMarkdown =
              `\n\n### Sources:\n` +
              uniqueSources.map((source: any) => {
                let url;
                try {
                  const uri = source!.uri!;
                  url = new URL(uri);
                  if (url.hostname.includes('vertexaisearch') || url.hostname.includes('google.com')) {
                    const realUrl = url.searchParams.get('url') || url.searchParams.get('q');
                    if (realUrl) url = new URL(realUrl);
                  }
                } catch {
                  return '';
                }
                return `- [${url.hostname.replace('www.', '')}](${url.href})`;
              }).filter(Boolean).join('\n');

            aiResponseContent += sourcesMarkdown;
          }
        }
      }

      setMessages(prev => prev.map(m => {
        if (m.id === aiMessageId) {
          const updatedVersions = m.versions ? [...m.versions] : [{ content: '', model_used: m.model_used }];
          const currentIdx = m.current_version ?? 0;
          if (updatedVersions[currentIdx]) {
            updatedVersions[currentIdx].content = aiResponseContent;
          }
          return { ...m, content: aiResponseContent, versions: updatedVersions };
        }
        return m;
      }));

      if (isAborted) {
        setMessages(prev => prev.map(m => {
          if (m.id === aiMessageId) {
            return { ...m, is_stopped: true };
          }
          return m;
        }));
      }

      if (!aiResponseContent && !isAborted) {
        throw new Error('Empty response from AI');
      }

      if (!isGuest && (!existingAiMessageId || isAborted)) {
        if (existingAiMessageId) {
          await supabase.from('messages').update({
            content: aiResponseContent,
            model_used: effectiveModel
          }).eq('id', existingAiMessageId);
        } else {
          await supabase.from('messages').insert([{
            chat_id: activeChatId,
            user_id: user.id,
            role: 'assistant',
            content: aiResponseContent,
            model_used: effectiveModel,
            is_learn_mode: isLearnMode
          }]);
        }

        await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', activeChatId);
      }

      const chat = chats.find(c => c.id === activeChatId);
      if (chat && chat.title === 'New Chat') {
        generateChatTitle(activeChatId, content);
      }
    } catch (error: any) {
      console.error('Gemini error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
      let friendlyError = errorMessage;

      if (errorMessage.includes('403') || errorMessage.includes('PERMISSION_DENIED')) {
        friendlyError = '(403) Permission Denied: Your API key does not have access to this model or Grounding Search is not enabled for it. Please try turning off Search Mode or selecting a different model.';
      }

      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        chat_id: activeChatId || 'none',
        role: 'assistant',
        content: `⚠️ **Error:** ${friendlyError}\n\n*Raw error:* ${errorMessage}`,
        created_at: new Date().toISOString()
      }]);

      const aiMessageId = existingAiMessageId || `ai_${Date.now()}`;
      setMessages(prev => prev.map(m => {
        if (m.id === aiMessageId) {
          return { ...m, is_error: true };
        }
        return m;
      }));
    } finally {
      setLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const sendMessage = async (content: string, image?: string, isLearnMode?: boolean, isSearchMode?: boolean) => {
    if (isGuest && guestMessageCount >= 3) {
      setSystemAlert("Guest limit reached. Login to continue chatting.");
      return;
    }

    if (image && isGuest) {
      setSystemAlert("Image upload is only available for logged-in users.");
      return;
    }

    if (image && !isGuest && profile) {
      const today = new Date().toISOString().split('T')[0];
      const imageUsage = profile.image_usage || { count: 0, last_reset: today };

      if (imageUsage.last_reset !== today) {
        imageUsage.count = 0;
        imageUsage.last_reset = today;
      }

      if (imageUsage.count >= 2) {
        setSystemAlert("Image upload limit reached today.");
        return;
      }

      await supabase
        .from('profiles')
        .update({ image_usage: { count: imageUsage.count + 1, last_reset: today } })
        .eq('id', profile.id);
    }

    let effectiveModel = model;

    const canUseHighReasoning = await checkUsageLimit(model);
    if (!canUseHighReasoning && model === AIModel.LACK_3) {
      setSystemAlert("Lack 3 limit reached, switching to Lack 1.");
      effectiveModel = AIModel.LACK_1;
      setModel(AIModel.LACK_1);
    }

    if (isGuest) {
      const today = new Date().toISOString().split('T')[0];
      const newCount = guestMessageCount + 1;
      setGuestMessageCount(newCount);
      sessionStorage.setItem('guest_usage', JSON.stringify({ date: today, count: newCount }));
    }

    let activeChatId = currentChatId;
    if (!activeChatId) {
      activeChatId = await createNewChat() || null;
    }

    if (!activeChatId) {
      activeChatId = `guest_${Date.now()}`;
      setCurrentChatId(activeChatId);
    }

    if (!isGuest && activeChatId.startsWith('new_chat_')) {
      const { data, error } = await supabase
        .from('chats')
        .insert([{ user_id: user!.id, title: content.slice(0, 30) || 'New Chat' }])
        .select()
        .single();

      if (data) {
        activeChatId = data.id;
        setCurrentChatId(data.id);
        setChats(prev => [data, ...prev]);
      } else {
        console.error('Failed to create new chat in DB:', error);
      }
    }

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      chat_id: activeChatId,
      role: 'user',
      content,
      image_url: image,
      created_at: new Date().toISOString(),
      is_error: false
    };

    let chatHistory = messages;

    if (!isGuest && activeChatId && !activeChatId.startsWith('new_chat_')) {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', activeChatId)
        .order('created_at', { ascending: true });

      if (data) {
        chatHistory = data;
      }
    }

    setMessages(prev => [...prev, userMessage]);

    if (!isGuest) {
      const { error: insertError } = await supabase.from('messages').insert([{
        chat_id: activeChatId,
        user_id: user.id,
        role: 'user',
        content,
        image_url: image
      }]);

      if (insertError) {
        console.error('Failed to save user message:', insertError);
        setMessages(prev => prev.map(m => m.id === userMessage.id ? { ...m, is_error: true } : m));
        return;
      }
    }

    await generateAIResponse(activeChatId, effectiveModel, chatHistory, content, image, isLearnMode, isSearchMode);
  };

  const changeMessageVersion = (id: string, versionIndex: number) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id && m.versions && versionIndex >= 0 && versionIndex < m.versions.length) {
        return {
          ...m,
          current_version: versionIndex,
          content: m.versions[versionIndex].content,
          model_used: m.versions[versionIndex].model_used || m.model_used
        };
      }
      return m;
    }));
  };

  const editMessage = async (id: string, newContent: string) => {
    const editIndex = messages.findIndex(m => m.id === id);
    if (editIndex === -1) return;

    let chatHistory = messages.slice(0, editIndex);
    const msg = messages[editIndex];

    if (!isGuest) {
      const idsToDelete = messages.slice(editIndex + 1).map(m => m.id);
      if (idsToDelete.length > 0) {
        await supabase.from('messages').delete().in('id', idsToDelete);
      }
      await supabase.from('messages').update({ content: newContent }).eq('id', id);
    }

    const updatedUserMsg = { ...msg, content: newContent };
    chatHistory = [...chatHistory, updatedUserMsg];
    setMessages(chatHistory);

    await generateAIResponse(msg.chat_id, model, chatHistory, newContent, msg.image_url, msg.is_learn_mode, msg.is_search_mode, msg.id);
  };

  const regenerateMessage = async (aiMessageId: string) => {
    const aiMessageIndex = messages.findIndex(m => m.id === aiMessageId);
    if (aiMessageIndex === -1) return;

    const msg = messages[aiMessageIndex];
    if (msg.role !== 'assistant') return;

    const userMessageIndex = messages.slice(0, aiMessageIndex).map(m => m.role).lastIndexOf('user');
    if (userMessageIndex === -1) return;

    const userMsg = messages[userMessageIndex];
    const chatHistory = messages.slice(0, userMessageIndex);

    await generateAIResponse(
      msg.chat_id,
      model,
      chatHistory,
      userMsg.content,
      userMsg.image_url,
      msg.is_learn_mode,
      msg.is_search_mode,
      msg.id
    );
  };

  const deleteChat = async (chatId: string) => {
    try {
      if (!isGuest) {
        const { error } = await supabase
          .from("chats")
          .delete()
          .eq("id", chatId);

        if (error) {
          console.error(error);
          return;
        }
      }

      setChats(prev => prev.filter(c => c.id !== chatId));

      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  const clearChat = async (id: string) => {
    try {
      if (!isGuest) {
        const { error } = await supabase.from('messages').delete().eq('chat_id', id);
        if (error) throw error;
      }

      if (currentChatId === id) {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error clearing chat:', error);
      setSystemAlert('Failed to clear messages.');
    }
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    if (!newTitle || !newTitle.trim()) return;

    try {
      if (!isGuest) {
        const { error } = await supabase
          .from("chats")
          .update({ title: newTitle.trim() })
          .eq("id", chatId);

        if (error) {
          console.error(error);
          return;
        }
      }

      setChats(prev =>
        prev.map(c =>
          c.id === chatId ? { ...c, title: newTitle.trim() } : c
        )
      );
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const searchChats = (query: string) => {
    if (!query) return chats;
    return chats.filter(c => c.title.toLowerCase().includes(query.toLowerCase()));
  };

  const sendFeedback = async (messageId: string, type: 'like' | 'dislike') => {
    if (isGuest) {
      const feedback = JSON.parse(sessionStorage.getItem('feedback') || '{}');
      feedback[messageId] = type;
      sessionStorage.setItem('feedback', JSON.stringify(feedback));
      return;
    }
    await supabase.from('feedback').insert([{ message_id: messageId, type, user_id: user!.id }]);
  };

  const isLimitReached = isGuest && guestMessageCount >= 3;

  return (
    <ChatContext.Provider
      value={{
        chats,
        currentChatId,
        messages,
        loading,
        chatsLoading,
        model,
        setModel,
        createNewChat,
        selectChat,
        sendMessage,
        regenerateMessage,
        editMessage,
        changeMessageVersion,
        stopGenerating,
        deleteChat,
        clearChat,
        renameChat,
        searchChats,
        sendFeedback,
        isLimitReached,
        systemAlert,
        setSystemAlert,
        isStreaming
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};