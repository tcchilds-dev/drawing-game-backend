import { gameManager } from "../game/GameManager.js";
import { convertRoom, rooms } from "./rooms.js";
import { deleteRoom } from "./rooms.js";
export function handleDisconnect({ io, socket }) {
    return () => {
        // Find which room the socket was in
        const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
        if (!roomId) {
            return;
        }
        const room = rooms.get(roomId);
        if (!room) {
            return;
        }
        const removed = room.players.delete(socket.id);
        if (!removed) {
            return;
        }
        console.log(`Removed player ${socket.id} from room ${roomId}`);
        gameManager.handlePlayerLeave(roomId, socket.id);
        if (room.players.size === 0) {
            console.log(`Room ${roomId} is empty, deleting`);
            deleteRoom(roomId);
            return;
        }
        // If creator left, assign new creator
        if (room.creator === socket.id) {
            const newCreator = room.players.keys().next().value;
            if (newCreator) {
                room.creator = newCreator;
                console.log(`New creator for room ${roomId}: ${newCreator}`);
            }
        }
        io.to(roomId).emit("room:update", convertRoom(room));
        io.to(roomId).emit("user:left", socket.id);
    };
}
//# sourceMappingURL=disconnect.js.map