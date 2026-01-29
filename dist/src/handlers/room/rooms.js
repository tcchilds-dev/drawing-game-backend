export const rooms = new Map();
export function convertRoom(room) {
    return {
        ...room,
        players: Object.fromEntries(room.players),
    };
}
//# sourceMappingURL=rooms.js.map