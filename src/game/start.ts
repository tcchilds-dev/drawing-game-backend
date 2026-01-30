import type { EventDependencies, SimpleCallback } from "../types/event.types.js";
import { validateRoomId } from "../validation/typia.js";
import { gameManager } from "../game/GameManager.js";
import { rooms } from "../room/rooms.js";

export function startGame({ io: _io, socket }: EventDependencies) {
  return async (payload: string, callback: SimpleCallback) => {
    if (typeof callback !== "function") return;

    const result = validateRoomId(payload);
    if (result.success === false) {
      callback({ success: false, error: "room ID is invalid" });
      return;
    }

    const roomId = payload;

    const room = rooms.get(roomId);
    if (!room) {
      callback({ success: false, error: "room does not exist" });
      return;
    }

    if (room.creator !== socket.id) {
      callback({ success: false, error: "you are not the creator" });
      return;
    }

    const gameResult = gameManager.startGame(roomId);
    if (!gameResult.success) {
      callback({ success: false, error: gameResult.error || "failed to start game" });
      return;
    }

    callback({ success: true });
  };
}
