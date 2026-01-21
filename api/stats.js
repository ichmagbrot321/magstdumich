import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // CORS Headers für lokale Entwicklung
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const dataPath = path.join(process.cwd(), 'daten.json');

  // Daten laden oder leeres Array erstellen
  let data = { sessions: [] };
  if (fs.existsSync(dataPath)) {
    try {
      const fileContent = fs.readFileSync(dataPath, 'utf8');
      data = JSON.parse(fileContent);
    } catch (e) {
      data = { sessions: [] };
    }
  }

  // GET Request - Stats abrufen
  if (req.method === 'GET') {
    return res.status(200).json(data);
  }

  // POST Request - Daten speichern
  if (req.method === 'POST') {
    try {
      const { action, sessionId, name, noAttempts, timestamp, attemptNumber } = req.body;

      if (action === 'start') {
        // Neue Session starten
        data.sessions.push({
          sessionId,
          name,
          startTime: timestamp,
          noAttempts: 0,
          saidYes: false,
          timestamp
        });
      } else if (action === 'no-attempt') {
        // Nein-Versuch aktualisieren
        const session = data.sessions.find(s => s.sessionId === sessionId);
        if (session) {
          session.noAttempts = attemptNumber;
          session.timestamp = timestamp;
        }
      } else if (action === 'yes') {
        // JA geklickt
        const session = data.sessions.find(s => s.sessionId === sessionId);
        if (session) {
          session.saidYes = true;
          session.noAttempts = noAttempts;
          session.timestamp = timestamp;
        }
      }

      // Zurück in Datei schreiben
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Server error', details: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
