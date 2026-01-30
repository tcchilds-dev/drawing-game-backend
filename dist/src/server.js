import express, {} from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { setUsername } from "./user/user.js";
import { createRoom } from "./room/create.js";
import { joinRoom } from "./room/join.js";
import { leaveRoom } from "./room/leave.js";
import { gameManager } from "./game/GameManager.js";
import { startGame } from "./game/start.js";
import { handleGuessage } from "./game/guessage.js";
import { chooseWord } from "./game/word.js";
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
gameManager.setIO(io);
io.on("connection", (socket) => {
    console.log(`User ${socket.id} connected`);
    if (socket.recovered) {
        console.log(`User ${socket.id} successfully recovered`);
    }
    else {
        console.log(`Error: Session was not recovered`);
    }
    // User Events
    socket.on("user:username", setUsername({ io, socket }));
    // Room Events
    socket.on("room:create", createRoom({ io, socket }));
    socket.on("room:join", joinRoom({ io, socket }));
    socket.on("room:leave", leaveRoom({ io, socket }));
    // Game Events
    socket.on("game:start", startGame({ io, socket }));
    socket.on("chat:guessage", handleGuessage({ io, socket }));
    socket.on("word:choice", chooseWord({ io, socket }));
});
export { app, httpServer, io };
//# sourceMappingURL=server.js.map