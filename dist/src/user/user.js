import { validateUsername } from "../validation/typia.js";
export function setUsername({ io: _io, socket }) {
    return async (payload, callback) => {
        if (typeof callback !== "function") {
            return;
        }
        const result = validateUsername(payload);
        if (result.success === false) {
            callback({ success: false, error: "failed to validate username" });
            console.log(result.errors);
            return;
        }
        socket.data.username = payload;
        callback({ success: true });
    };
}
//# sourceMappingURL=user.js.map