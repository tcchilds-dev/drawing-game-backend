import { gameManager } from "../game/GameManager.js";
export const rooms = new Map();
export function convertRoom(room) {
    return {
        ...room,
        players: Object.fromEntries(room.players),
    };
}
export function deleteRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room)
        return false;
    gameManager.clearGame(roomId);
    rooms.delete(roomId);
    console.log(`Deleted room ${roomId}`);
    return true;
}
//# sourceMappingURL=rooms.js.map