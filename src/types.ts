export enum AIModel {
  LACK_1 = 'gemini-2.0-flash',
  LACK_2 = 'gemini-2.5-flash-lite',
  LACK_3 = 'gemini-3.1-pro-preview',
  LACK_3_5 = 'gemini-3.1-flash-lite-preview'
}

export interface Profile {
  id: string;
  email: string;
  image_url?: string;
  created_at: string;
  lack2_usage?: {
    count: number;
    last_reset: string;
  };
  image_usage?: {
    count: number;
    last_reset: string;
  };
  theme?: string;
}

export interface Chat {
  id: string;
  user_id: string | null; // null for guest
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MessageVersion {
  content: string;
  model_used?: AIModel;
  created_at?: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  model_used?: AIModel;
  is_learn_mode?: boolean;
  is_search_mode?: boolean;
  image_url?: string;
  created_at: string;
  versions?: MessageVersion[];
  current_version?: number;
  is_error?: boolean;
  is_stopped?: boolean;
}

export interface UserContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  isGuest: boolean;
  signOut: () => Promise<void>;
  enterGuestMode: () => void;
  deleteAccount: (confirmText: string) => Promise<boolean>;
  updateProfile: (profile: Partial<Profile>) => void;
  saveAvatar: (avatarUrl: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isDevMode: boolean;
  toggleDevMode: () => void;
}

export interface ChatContextType {
  chats: Chat[];
  currentChatId: string | null;
  messages: Message[];
  loading: boolean;
  chatsLoading: boolean;
  model: AIModel;
  setModel: (model: AIModel) => void;
  createNewChat: () => Promise<string | undefined>;
  selectChat: (id: string) => void;
  sendMessage: (content: string, image?: string, isLearnMode?: boolean, isSearchMode?: boolean) => Promise<void>;
  regenerateMessage: (id: string) => Promise<void>;
  editMessage: (id: string, newContent: string) => Promise<void>;
  changeMessageVersion: (id: string, versionIndex: number) => void;
  stopGenerating: () => void;
  deleteChat: (id: string) => Promise<void>;
  clearChat: (id: string) => Promise<void>;
  renameChat: (id: string, title: string) => Promise<void>;
  searchChats: (query: string) => Chat[];
  sendFeedback: (messageId: string, type: 'like' | 'dislike') => Promise<void>;
  isLimitReached?: boolean;
  systemAlert: string | null;
  setSystemAlert: (msg: string | null) => void;
  isStreaming: boolean;
}
