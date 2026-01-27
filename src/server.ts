import express, { type Express } from "express";
import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./types/event.types.js";
import type { SocketData } from "./types/main.types.js";

const app: Express = express();

const httpServer = createServer(app);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, SocketData>(httpServer, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 1 * 60 * 1000,
    skipMiddlewares: true,
  },
});

io.on("connection", (socket: Socket) => {
  console.log(`User ${socket.id} connected`);
  if (socket.recovered) {
    console.log(`User ${socket.id} successfully recovered`);
  } else {
    console.log(`Error: Session was not recovered`);
  }
});

export { app, httpServer, io };
