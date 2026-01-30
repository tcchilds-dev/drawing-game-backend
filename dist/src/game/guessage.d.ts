import type { EventDependencies } from "../types/event.types.js";
import type { Guessage } from "../types/main.types.js";
export declare function handleGuessage({ io, socket }: EventDependencies): (payload: Guessage) => Promise<void>;
//# sourceMappingURL=guessage.d.ts.map