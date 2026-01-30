import { rooms } from "./rooms.js";
import { gameManager } from "../game/GameManager.js";
export function leaveRoom({ io, socket }) {
    return async () => {
        const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
        if (!roomId) {
            console.log("room ID for leave not found");
            return;
        }
        socket.leave(roomId);
        const room = rooms.get(roomId);
        if (!room) {
            console.log("could not fetch room for leave");
            return;
        }
        const result = room.players.delete(socket.id);
        if (result !== true) {
            console.log("could not remove player from room");
            return;
        }
        gameManager.handlePlayerLeave(roomId, socket.id);
        io.to(roomId).emit("user:left", socket.id);
    };
}
//# sourceMappingURL=leave.js.map