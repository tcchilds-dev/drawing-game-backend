import type { EventDependencies, RoomCallback } from "../types/event.types.js";
export declare function joinRoom({ io, socket }: EventDependencies): (payload: string, callback: RoomCallback) => Promise<void>;
//# sourceMappingURL=join.d.ts.map