import { validateGuessage } from "../validation/typia.js";
import { gameManager } from "../game/GameManager.js";
import { getActiveRoomId } from "../room/activeRoom.js";
import { convertRoom, rooms } from "../room/rooms.js";
export function handleGuessage({ io, socket }) {
    return async (payload) => {
        const playerId = socket.data.playerId;
        if (!playerId) {
            console.log("playerId not set");
            return;
        }
        const sanitizedPayload = {
            ...payload,
            playerId,
        };
        const result = validateGuessage(sanitizedPayload);
        if (result.success === false) {
            console.log("guessage validation failed", result.errors);
            return;
        }
        const roomId = getActiveRoomId(socket);
        if (!roomId) {
            console.log("player not in a room");
            return;
        }
        const room = rooms.get(roomId);
        if (!room)
            return;
        const isCorrect = gameManager.checkGuess(roomId, playerId, payload.guessage);
        if (!isCorrect) {
            room.guessages.push(sanitizedPayload);
            io.to(roomId).emit("room:update", convertRoom(room));
        }
        // If correct, gameManager.checkGuess already emits "guess:correct"
    };
}
//# sourceMappingURL=guessage.js.map