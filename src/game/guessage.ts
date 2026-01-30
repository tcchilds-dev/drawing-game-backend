import type { EventDependencies } from "../types/event.types.js";
import type { Guessage } from "../types/main.types.js";
import { validateGuessage } from "../validation/typia.js";
import { gameManager } from "../game/GameManager.js";
import { convertRoom, rooms } from "../room/rooms.js";

export function handleGuessage({ io, socket }: EventDependencies) {
  return async (payload: Guessage) => {
    const result = validateGuessage(payload);
    if (result.success === false) {
      console.log("guessage validation failed", result.errors);
      return;
    }

    const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
    if (!roomId) {
      console.log("player not in a room");
      return;
    }

    const room = rooms.get(roomId);
    if (!room) return;

    const isCorrect = gameManager.checkGuess(roomId, socket.id, payload.guessage);

    if (!isCorrect) {
      room.guessages.push(payload);
      io.to(roomId).emit("room:update", convertRoom(room));
    }
    // If correct, gameManager.checkGuess already emits "guess:correct"
  };
}
