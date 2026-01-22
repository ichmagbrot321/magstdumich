import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, username, password, sessionId, name, noAttempts, timestamp, attemptNumber } = req.body;

    // ========== REGISTER ==========
    if (action === 'register') {
      if (!username || !password) {
        return res.status(400).json({ error: 'Username und Passwort erforderlich' });
      }

      const existingUser = await redis.get(`user:${username}`);
      
      if (existingUser) {
        return res.status(400).json({ error: 'Username bereits vergeben' });
      }
      
      await redis.set(`user:${username}`, {
        password: password,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ success: true });
    }

    // ========== LOGIN ==========
    if (action === 'login') {
      if (!username || !password) {
        return res.status(400).json({ error: 'Username und Passwort erforderlich' });
      }

      const user = await redis.get(`user:${username}`);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Falscher Username oder Passwort' });
      }
      
      return res.status(200).json({ success: true });
    }

    // ========== START SESSION ==========
    if (action === 'start') {
      if (!username || !sessionId || !name) {
        return res.status(400).json({ error: 'Fehlende Daten' });
      }

      const sessionsKey = `sessions:${username}`;
      let sessions = await redis.get(sessionsKey) || [];
      
      sessions.push({
        sessionId,
        name,
        startTime: timestamp,
        noAttempts: 0,
        saidYes: false,
        timestamp
      });
      
      await redis.set(sessionsKey, sessions);
      return res.status(200).json({ success: true });
    }

    // ========== NO ATTEMPT ==========
    if (action === 'no-attempt') {
      if (!username || !sessionId) {
        return res.status(400).json({ error: 'Fehlende Daten' });
      }

      const sessionsKey = `sessions:${username}`;
      let sessions = await redis.get(sessionsKey) || [];
      
      const session = sessions.find(s => s.sessionId === sessionId);
      
      if (session) {
        session.noAttempts = attemptNumber;
        session.timestamp = timestamp;
        await redis.set(sessionsKey, sessions);
      }
      
      return res.status(200).json({ success: true });
    }

    // ========== YES ==========
    if (action === 'yes') {
      if (!username || !sessionId) {
        return res.status(400).json({ error: 'Fehlende Daten' });
      }

      const sessionsKey = `sessions:${username}`;
      let sessions = await redis.get(sessionsKey) || [];
      
      const session = sessions.find(s => s.sessionId === sessionId);
      
      if (session) {
        session.saidYes = true;
        session.noAttempts = noAttempts;
        session.timestamp = timestamp;
        await redis.set(sessionsKey, sessions);
      }
      
      return res.status(200).json({ success: true });
    }

    // ========== GET STATS ==========
    if (action === 'get-stats') {
      if (!username || !password) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await redis.get(`user:${username}`);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const sessionsKey = `sessions:${username}`;
      const sessions = await redis.get(sessionsKey) || [];
      
      return res.status(200).json({ sessions });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Interner Serverfehler: ' + error.message });
  }
}
