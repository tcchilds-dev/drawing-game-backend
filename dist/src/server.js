import express, {} from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { setUsername } from "./handlers/user.js";
const app = express();
const httpServer = createServer(app);
app.use(express.json());
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
const io = new Server(httpServer, {
    connectionStateRecovery: {
        maxDisconnectionDuration: 1 * 60 * 1000,
        skipMiddlewares: true,
    },
});
io.on("connection", (socket) => {
    console.log(`User ${socket.id} connected`);
    if (socket.recovered) {
        console.log(`User ${socket.id} successfully recovered`);
    }
    else {
        console.log(`Error: Session was not recovered`);
    }
    socket.on("user:username", setUsername({ io, socket }));
});
export { app, httpServer, io };
//# sourceMappingURL=server.js.map