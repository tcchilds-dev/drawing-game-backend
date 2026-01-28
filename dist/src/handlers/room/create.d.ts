import type { EventDependencies, RoomCallback } from "../../types/event.types.js";
import { type RoomConfig } from "../../types/main.types.js";
export declare function createRoom({ io: _io, socket }: EventDependencies): (payload: Partial<RoomConfig>, callback: RoomCallback) => Promise<void>;
//# sourceMappingURL=create.d.ts.map