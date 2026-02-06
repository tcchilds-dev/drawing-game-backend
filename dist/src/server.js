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
import { handleDisconnect } from "./room/disconnect.js";
import { handleStrokeStart, handleStrokePoints, handleStrokeEnd, handleCanvasClear, handleCanvasUndo, } from "./game/drawing.js";
const app = express();
const httpServer = createServer(app);
app.use(express.json());
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
    },
    connectionStateRecovery: {
        maxDisconnectionDuration: 1 * 60 * 1000,
        skipMiddlewares: true,
    },
});
gameManager.setIO(io);
io.on("connection", (socket) => {
    console.log(`User ${socket.id} connected`);
    const processDisconnect = handleDisconnect({ io, socket });
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
    // Drawing Events
    socket.on("stroke:start", handleStrokeStart({ io, socket }));
    socket.on("stroke:points", handleStrokePoints({ io, socket }));
    socket.on("stroke:end", handleStrokeEnd({ io, socket }));
    socket.on("canvas:clear", handleCanvasClear({ io, socket }));
    socket.on("canvas:undo", handleCanvasUndo({ io, socket }));
    socket.on("disconnecting", () => {
        processDisconnect();
    });
    socket.on("disconnect", (reason) => {
        console.log(reason);
        if (socket.recovered) {
            console.log(`User ${socket.id} successfully recovered`);
        }
    });
});
export { app, httpServer, io };
//# sourceMappingURL=server.js.map