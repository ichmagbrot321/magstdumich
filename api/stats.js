import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const sessions = await kv.get('sessions') || [];
      return res.status(200).json({ sessions });
    }

    if (req.method === 'POST') {
      const { action, sessionId, name, noAttempts, timestamp, attemptNumber } = req.body;
      let sessions = await kv.get('sessions') || [];

      if (action === 'start') {
        sessions.push({
          sessionId, name, startTime: timestamp, noAttempts: 0, saidYes: false, timestamp
        });
      } else if (action === 'no-attempt') {
        const session = sessions.find(s => s.sessionId === sessionId);
        if (session) {
          session.noAttempts = attemptNumber;
          session.timestamp = timestamp;
        }
      } else if (action === 'yes') {
        const session = sessions.find(s => s.sessionId === sessionId);
        if (session) {
          session.saidYes = true;
          session.noAttempts = noAttempts;
          session.timestamp = timestamp;
        }
      }

      await kv.set('sessions', sessions);
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
