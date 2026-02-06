import { gameManager } from "../game/GameManager.js";
import { convertRoom, rooms } from "./rooms.js";
import { deleteRoom } from "./rooms.js";
const lobbyDisconnectTimers = new Map();
function getLobbyDisconnectKey(roomId, playerId) {
    return `${roomId}:${playerId}`;
}
export function clearLobbyDisconnectGrace(roomId, playerId) {
    const key = getLobbyDisconnectKey(roomId, playerId);
    const timer = lobbyDisconnectTimers.get(key);
    if (!timer)
        return;
    clearTimeout(timer);
    lobbyDisconnectTimers.delete(key);
}
export function handleDisconnect({ io, socket }) {
    return () => {
        const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
        if (!roomId) {
            return;
        }
        const room = rooms.get(roomId);
        if (!room) {
            return;
        }
        const disconnectedUser = room.players.get(socket.id);
        if (!disconnectedUser) {
            return;
        }
        const playerId = disconnectedUser.playerId;
        if (!playerId) {
            return;
        }
        console.log(`Socket ${socket.id} disconnected in room ${roomId}, starting grace period`);
        // During active game phases, GameManager owns the grace logic
        if (room.phase !== "lobby") {
            gameManager.handlePlayerDisconnect(roomId, playerId, socket.id);
            return;
        }
        // Lobby-only fallback grace: remove after 60s if the player did not reconnect.
        const key = getLobbyDisconnectKey(roomId, playerId);
        clearLobbyDisconnectGrace(roomId, playerId);
        const timer = setTimeout(() => {
            lobbyDisconnectTimers.delete(key);
            const latestRoom = rooms.get(roomId);
            if (!latestRoom)
                return;
            const player = latestRoom.players.get(socket.id);
            if (!player || player.playerId !== playerId)
                return;
            latestRoom.players.delete(socket.id);
            if (latestRoom.players.size === 0) {
                console.log(`Room ${roomId} is empty, deleting`);
                deleteRoom(roomId);
                return;
            }
            if (latestRoom.creator === socket.id) {
                const newCreator = latestRoom.players.keys().next().value;
                if (newCreator) {
                    latestRoom.creator = newCreator;
                    console.log(`New creator for room ${roomId}: ${newCreator}`);
                }
            }
            io.to(roomId).emit("room:update", convertRoom(latestRoom));
            io.to(roomId).emit("user:left", socket.id);
        }, 60_000);
        lobbyDisconnectTimers.set(key, timer);
    };
}
//# sourceMappingURL=disconnect.js.map