import { type Express } from "express";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./types/event.types.js";
import type { SocketData } from "./types/main.types.js";
declare const app: Express;
declare const httpServer: import("node:http").Server<typeof import("node:http").IncomingMessage, typeof import("node:http").ServerResponse>;
declare const io: Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export { app, httpServer, io };
//# sourceMappingURL=server.d.ts.map