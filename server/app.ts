
import express from "express";
import { registerRoutes } from "./routes";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup API routes
const setupPromise = registerRoutes(httpServer, app);

export { app, httpServer, setupPromise };
