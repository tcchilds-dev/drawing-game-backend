import { randomUUID } from "node:crypto";
import { DEFAULT_ROOM_CONFIG, } from "../types/main.types.js";
import { validateRoomConfig } from "../validation/typia.js";
import { convertRoom, rooms } from "./rooms.js";
import { removeSocketFromAllRooms } from "./leave.js";
export function createRoom({ io, socket }) {
    return async (payload, callback) => {
        if (typeof callback !== "function") {
            console.log("callback was not a function");
            return;
        }
        const result = validateRoomConfig(payload);
        if (result.success === false) {
            callback({ success: false, error: "room config validation failed" });
            console.log(result.errors);
            return;
        }
        if (!socket.data.playerId) {
            callback({ success: false, error: "playerId not set" });
            return;
        }
        removeSocketFromAllRooms({ io, socket });
        const roomConfig = {
            ...DEFAULT_ROOM_CONFIG,
            ...payload,
        };
        const user = {
            id: socket.id,
            playerId: socket.data.playerId,
            username: socket.data.username || "Guest",
            score: 0,
        };
        const startingDrawState = {
            currentArtist: null,
            correctlyGuessed: [],
            startedAt: null,
            completedStrokes: [],
            activeStroke: null,
        };
        const room = {
            id: randomUUID(),
            creator: socket.id,
            config: roomConfig,
            players: new Map(),
            guessages: [],
            drawingState: startingDrawState,
            phase: "lobby",
            currentRound: 0,
        };
        room.players.set(socket.id, user);
        rooms.set(room.id, room);
        socket.join(room.id);
        const convertedRoom = convertRoom(room);
        callback({ success: true, room: convertedRoom });
    };
}
//# sourceMappingURL=create.js.map