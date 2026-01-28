import { randomUUID } from "node:crypto";
import type { EventDependencies, RoomCallback } from "../../types/event.types.js";
import {
  DEFAULT_ROOM_CONFIG,
  type DrawingState,
  type Room,
  type RoomConfig,
  type User,
} from "../../types/main.types.js";
import { validateRoomConfig } from "../../validation/typia.js";
import { rooms } from "./rooms.js";

export function createRoom({ io: _io, socket }: EventDependencies) {
  return async (payload: Partial<RoomConfig>, callback: RoomCallback) => {
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

    const roomConfig: RoomConfig = {
      ...DEFAULT_ROOM_CONFIG,
      ...payload,
    };

    console.log(roomConfig);

    const user: User = {
      id: socket.id,
      username: socket.data.username || "Guest",
      score: 0,
    };

    console.log(user);

    const startingDrawState: DrawingState = {
      currentArtist: null,
      currentWord: null,
      correctlyGuessed: [],
      startedAt: null,
      completedStrokes: [],
      activeStroke: null,
    };

    const room: Room = {
      id: randomUUID(),
      config: roomConfig,
      players: [user],
      guessages: [],
      drawingState: startingDrawState,
      phase: "waiting",
      currentRound: 0,
    };

    console.log(room);
    console.log(room.id);

    rooms.set(room.id, room);

    console.log(rooms);

    socket.join(room.id);

    callback({ success: true, room: room });
  };
}
