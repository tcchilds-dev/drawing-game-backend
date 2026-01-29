import type { EventDependencies, RoomCallback } from "../../types/event.types.js";
import { validateRoomId } from "../../validation/typia.js";
import { rooms } from "./rooms.js";
import type { User } from "../../types/main.types.js";

export function joinRoom({ io: _io, socket }: EventDependencies) {
  return async (payload: string, callback: RoomCallback) => {
    if (typeof callback !== "function") return;

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

    const user: User = {
      id: socket.id,
      username: socket.data.username || "Guest",
      score: 0,
    };

    room.players.push(user);

    callback({ success: true, room: room });
  };
}
