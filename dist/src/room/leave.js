import { rooms, convertRoom, deleteRoom } from "./rooms.js";
import { gameManager } from "../game/GameManager.js";
import { getActiveRoomId, getJoinedRoomIds } from "./activeRoom.js";
export function removeSocketFromRoom({ io, socket, roomId }) {
    socket.leave(roomId);
    const room = rooms.get(roomId);
    if (!room) {
        return false;
    }
    const leavingUser = room.players.get(socket.id);
    if (!leavingUser) {
        return false;
    }
    const result = room.players.delete(socket.id);
    if (result !== true) {
        return false;
    }
    gameManager.handlePlayerLeave(roomId, leavingUser.playerId);
    if (room.players.size === 0) {
        console.log(`Room ${roomId} is empty, deleting`);
        deleteRoom(roomId);
        return true;
    }
    if (room.creator === socket.id) {
        const newCreator = room.players.keys().next().value;
        if (newCreator) {
            room.creator = newCreator;
        }
    }
    io.to(roomId).emit("room:update", convertRoom(room));
    io.to(roomId).emit("user:left", socket.id);
    return true;
}
export function removeSocketFromAllRooms({ io, socket, excludedRoomId, }) {
    const joinedRoomIds = getJoinedRoomIds(socket).filter((roomId) => roomId !== excludedRoomId);
    for (const roomId of joinedRoomIds) {
        removeSocketFromRoom({ io, socket, roomId });
    }
}
export function leaveRoom({ io, socket }) {
    return async () => {
        const roomId = getActiveRoomId(socket);
        if (!roomId) {
            console.log("room ID for leave not found");
            return;
        }
        const removed = removeSocketFromRoom({ io, socket, roomId });
        if (!removed) {
            console.log("could not fetch room or user for leave");
        }
    };
}
//# sourceMappingURL=leave.js.map