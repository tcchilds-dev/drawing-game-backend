import type { EventDependencies, SimpleCallback } from "../../types/event.types.js";
import { validateUsername } from "../../validation/typia.js";

export function setUsername({ io: _io, socket }: EventDependencies) {
  return async (payload: string, callback: SimpleCallback) => {
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
