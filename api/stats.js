import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action, username, password, sessionId, name, noAttempts, timestamp, attemptNumber } = req.body;

    // User registrieren
    if (action === 'register') {
      const users = await redis.get('users') || {};
      
      if (users[username]) {
        return res.status(400).json({ error: 'Username bereits vergeben' });
      }
      
      users[username] = { password, createdAt: new Date().toISOString() };
      await redis.set('users', users);
      return res.status(200).json({ success: true });
    }

    // Login prüfen
    if (action === 'login') {
      const users = await redis.get('users') || {};
      const user = users[username];
      
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Falscher Username oder Passwort' });
      }
      
      return res.status(200).json({ success: true });
    }

    // Session starten
    if (action === 'start') {
      const key = `sessions:${username}`;
      let sessions = await redis.get(key) || [];
      
      sessions.push({
        sessionId, name, startTime: timestamp, noAttempts: 0, saidYes: false, timestamp
      });
      
      await redis.set(key, sessions);
      return res.status(200).json({ success: true });
    }

    // Nein-Versuch
    if (action === 'no-attempt') {
      const key = `sessions:${username}`;
      let sessions = await redis.get(key) || [];
      const session = sessions.find(s => s.sessionId === sessionId);
      
      if (session) {
        session.noAttempts = attemptNumber;
        session.timestamp = timestamp;
        await redis.set(key, sessions);
      }
      
      return res.status(200).json({ success: true });
    }

    // JA geklickt
    if (action === 'yes') {
      const key = `sessions:${username}`;
      let sessions = await redis.get(key) || [];
      const session = sessions.find(s => s.sessionId === sessionId);
      
      if (session) {
        session.saidYes = true;
        session.noAttempts = noAttempts;
        session.timestamp = timestamp;
        await redis.set(key, sessions);
      }
      
      return res.status(200).json({ success: true });
    }

    // Stats abrufen
    if (action === 'get-stats') {
      const users = await redis.get('users') || {};
      const user = users[username];
      
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const key = `sessions:${username}`;
      const sessions = await redis.get(key) || [];
      return res.status(200).json({ sessions });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
