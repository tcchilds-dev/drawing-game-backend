import { validateWord } from "../validation/typia.js";
import { gameManager } from "../game/GameManager.js";
export function chooseWord({ io: _io, socket }) {
    return async (payload, callback) => {
        const result = validateWord(payload);
        if (result.success === false) {
            console.log(result.errors);
            callback({ success: false, error: "word validation failed" });
            return;
        }
        const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
        if (!roomId) {
            callback({ success: false, error: "player is not in the room" });
            return;
        }
        const word = gameManager.selectWord(roomId, socket.id, payload);
        if (!word) {
            console.log("word selection failed");
            return;
        }
        callback({ success: true, word: word });
    };
}
//# sourceMappingURL=word.js.map