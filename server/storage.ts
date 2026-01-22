
import { Redis } from "@upstash/redis";
import { type User, type InsertUser, type Session, type InsertSession } from "@shared/schema";
import { randomUUID } from "crypto";

// Use environment variables or fallback to provided (Note: In production, always use Env Vars!)
const redis = new Redis({
  url: process.env.KV_REST_API_URL || "https://mature-gorilla-13553.upstash.io",
  token: process.env.KV_REST_API_TOKEN || "ATTxAAIncDJjOGU4MmZlZWQ5M2Y0ZTM4YjJiMmVmMmMyOTYxMTI0YXAyMTM1NTM",
});

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Session operations
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session>;
  getSessionsByUserId(userId: string): Promise<Session[]>;
  clearSessions(userId: string): Promise<void>;
  getSession(id: string): Promise<Session | undefined>;
}

export class RedisStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const user = await redis.get<User>(`user:${id}`);
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const userId = await redis.get<string>(`username:${username}`);
    if (!userId) return undefined;
    return this.getUser(userId);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date().toISOString() 
    };

    // Store user by ID and username mapping
    await redis.set(`user:${id}`, user);
    await redis.set(`username:${user.username}`, id);
    
    return user;
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = randomUUID();
    const session: Session = {
      ...insertSession,
      id,
      noAttempts: insertSession.noAttempts || 0,
      saidYes: insertSession.saidYes || false,
      createdAt: new Date().toISOString()
    };

    await redis.set(`session:${id}`, session);
    // Add to user's session list
    await redis.lpush(`user_sessions:${insertSession.userId}`, id);
    
    return session;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    const session = await this.getSession(id);
    if (!session) throw new Error("Session not found");

    const updatedSession = { ...session, ...updates };
    await redis.set(`session:${id}`, updatedSession);
    return updatedSession;
  }

  async getSessionsByUserId(userId: string): Promise<Session[]> {
    const sessionIds = await redis.lrange(`user_sessions:${userId}`, 0, -1);
    if (sessionIds.length === 0) return [];

    const sessions = await Promise.all(
      sessionIds.map(id => redis.get<Session>(`session:${id}`))
    );

    return sessions.filter((s): s is Session => !!s);
  }

  async clearSessions(userId: string): Promise<void> {
    const sessionIds = await redis.lrange(`user_sessions:${userId}`, 0, -1);
    if (sessionIds.length > 0) {
      await redis.del(...sessionIds.map(id => `session:${id}`));
    }
    await redis.del(`user_sessions:${userId}`);
  }
  
  async getSession(id: string): Promise<Session | undefined> {
     const session = await redis.get<Session>(`session:${id}`);
     return session || undefined;
  }
}

export const storage = new RedisStorage();
