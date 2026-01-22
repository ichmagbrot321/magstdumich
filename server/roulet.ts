
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import memorystore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const MemoryStore = memorystore(session);

// Helper for password hashing
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(keyBuffer, derivedKey);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Session middleware (In-Memory for now, can switch to Redis store for Vercel if needed)
  app.use(
    session({
      store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      }),
      secret: process.env.SESSION_SECRET || "default_secret",
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    })
  );

  // Auth Middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // === AUTH ROUTES ===

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      
      // Auto login
      req.session.userId = user.id;
      res.status(201).json(user);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(input.username);
      
      if (!user || !(await verifyPassword(input.password, user.password))) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      req.session.userId = user.id;
      res.json(user);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
       return res.status(401).json({ message: "User not found" });
    }
    res.json(user);
  });

  // === SESSION / STATS ROUTES ===

  app.get(api.users.check.path, async (req, res) => {
    const user = await storage.getUserByUsername(req.params.username);
    res.json({ exists: !!user });
  });

  // Start a new visitor session
  app.post(api.sessions.create.path, async (req, res) => {
    try {
      const { username, visitorName } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const session = await storage.createSession({
        userId: user.id,
        visitorName,
        noAttempts: 0,
        saidYes: false
      });
      
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  // Update session (vote yes or no attempt)
  app.put(api.sessions.update.path, async (req, res) => {
    try {
      const id = req.params.id;
      const updates = req.body;
      const session = await storage.getSession(id);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      const updated = await storage.updateSession(id, updates);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  // Get stats (protected)
  app.get(api.sessions.list.path, requireAuth, async (req, res) => {
    const sessions = await storage.getSessionsByUserId(req.session.userId!);
    res.json(sessions);
  });

  // Reset stats (protected)
  app.delete(api.sessions.delete.path, requireAuth, async (req, res) => {
    await storage.clearSessions(req.session.userId!);
    res.json({ message: "Stats cleared" });
  });

  return httpServer;
}
