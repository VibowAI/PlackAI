-- Run this in your Supabase SQL Editor to create the necessary tables for Chat History

-- Create Profiles Table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT,
  nickname TEXT,
  image_url TEXT,
  theme TEXT DEFAULT 'system',
  lack2_usage JSONB DEFAULT '{"count": 0, "last_reset": ""}'::jsonb,
  image_usage JSONB DEFAULT '{"count": 0, "last_reset": ""}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create Chats Table
CREATE TABLE chats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create Messages Table
CREATE TABLE messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  image_url TEXT,
  model_used TEXT,
  is_learn_mode BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can create their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Policies for chats
CREATE POLICY "Users can create their own chats" ON chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own chats" ON chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own chats" ON chats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chats" ON chats FOR DELETE USING (auth.uid() = user_id);

-- Policies for messages
CREATE POLICY "Users can create their own messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own messages" ON messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own messages" ON messages FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);

-- RPC Functions
CREATE OR REPLACE FUNCTION delete_chat(chat_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Row level security handles access control automatically
  -- Since messages has ON DELETE CASCADE on chat_id, deleting the chat deletes the messages
  DELETE FROM chats WHERE id = chat_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rename_chat(chat_id UUID, new_title TEXT)
RETURNS VOID AS $$
BEGIN
  -- Row level security handles access control automatically
  UPDATE chats SET title = new_title, updated_at = NOW()
  WHERE id = chat_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
