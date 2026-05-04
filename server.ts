import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Supabase Admin Client
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  // Secure API: Delete User
  app.post('/api/user/delete', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 1. Verify the user session first using the public client logic (simulated by admin fetchUser)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    try {
      console.log(`Deleting user: ${user.id}`);

      // 2. The database should have ON DELETE CASCADE. 
      // If not, we'd need to manually delete chats/messages here.
      // We will assume standard practice: CASCADE or manual cleanup.
      // Actually, let's do a manual cleanup to be safe as per "MUST BE CORRECT" instruction.
      
      // Delete messages
      await supabaseAdmin.from('messages').delete().eq('user_id', user.id);
      // Delete chats
      await supabaseAdmin.from('chats').delete().eq('user_id', user.id);
      // Delete profile
      await supabaseAdmin.from('profiles').delete().eq('id', user.id);

      // 3. Delete user from Supabase Auth
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

      if (deleteError) {
        throw deleteError;
      }

      return res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting user:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete user' });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
