
import { z } from "zod";

// === SCHEMAS ===
// Users
export const userSchema = z.object({
  id: z.string(),
  username: z.string().min(3),
  password: z.string().min(4),
  createdAt: z.string().or(z.date()),
});

export const insertUserSchema = userSchema.pick({
  username: true,
  password: true,
});

// Sessions (Stats)
export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  visitorName: z.string(),
  noAttempts: z.number().default(0),
  saidYes: z.boolean().default(false),
  createdAt: z.string().or(z.date()),
});

export const insertSessionSchema = sessionSchema.pick({
  userId: true,
  visitorName: true,
  noAttempts: true,
  saidYes: true,
});

// === TYPES ===
export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Session = z.infer<typeof sessionSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type CreateUserRequest = InsertUser;
export type LoginRequest = InsertUser;

export type CreateSessionRequest = {
  visitorName: string;
  username: string;
};

export type UpdateSessionRequest = {
  noAttempts?: number;
  saidYes?: boolean;
};
