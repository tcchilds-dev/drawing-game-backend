import { validateRoomId } from "../../validation/typia.js";
import { convertRoom, rooms } from "./rooms.js";
export function joinRoom({ io: _io, socket }) {
    return async (payload, callback) => {
        if (typeof callback !== "function")
            return;
        const result = validateRoomId(payload);
        if (result.success === false) {
            callback({ success: false, error: "room ID is invalid" });
            console.log(result.errors);
            return;
        }
        const room = rooms.get(payload);
        if (!room) {
            callback({ success: false, error: "room does not exist" });
            return;
        }
        socket.join(payload);
        const user = {
            id: socket.id,
            username: socket.data.username || "Guest",
            score: 0,
        };
        room.players.set(socket.id, user);
        const convertedRoom = convertRoom(room);
        callback({ success: true, room: convertedRoom });
    };
}
//# sourceMappingURL=join.js.map