import { randomUUID } from "node:crypto";
import { DEFAULT_ROOM_CONFIG, } from "../../types/main.types.js";
import { validateRoomConfig } from "../../validation/typia.js";
import { convertRoom, rooms } from "./rooms.js";
export function createRoom({ io: _io, socket }) {
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
        const roomConfig = {
            ...DEFAULT_ROOM_CONFIG,
            ...payload,
        };
        console.log(roomConfig);
        const user = {
            id: socket.id,
            username: socket.data.username || "Guest",
            score: 0,
        };
        console.log(user);
        const startingDrawState = {
            currentArtist: null,
            currentWord: null,
            correctlyGuessed: [],
            startedAt: null,
            completedStrokes: [],
            activeStroke: null,
        };
        const room = {
            id: randomUUID(),
            config: roomConfig,
            players: new Map(),
            guessages: [],
            drawingState: startingDrawState,
            phase: "waiting",
            currentRound: 0,
        };
        room.players.set(socket.id, user);
        console.log(room);
        console.log(room.id);
        rooms.set(room.id, room);
        console.log(rooms);
        socket.join(room.id);
        const convertedRoom = convertRoom(room);
        callback({ success: true, room: convertedRoom });
    };
}
//# sourceMappingURL=create.js.map