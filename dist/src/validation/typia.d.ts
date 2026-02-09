import typia, { tags } from "typia";
import type { RoomConfig, Guessage, Point } from "../types/main.types.js";
export declare const validateUsername: (input: unknown) => typia.IValidation<string & tags.MinLength<3> & tags.MaxLength<20>>;
export declare const validateUsernamePayload: (input: unknown) => typia.IValidation<{
    username: string & tags.MinLength<3> & tags.MaxLength<20>;
    playerId: string & tags.Format<"uuid">;
}>;
export declare const validateRoomConfig: (input: unknown) => typia.IValidation<Partial<RoomConfig>>;
export declare const validateRoomId: (input: unknown) => typia.IValidation<string & tags.Format<"uuid">>;
export declare const validateGuessage: (input: unknown) => typia.IValidation<Guessage>;
export declare const validateWord: (input: unknown) => typia.IValidation<string>;
export declare const validateStrokeStart: (input: unknown) => typia.IValidation<{
    color: string;
    width: number;
}>;
export declare const validateStrokePoints: (input: unknown) => typia.IValidation<{
    points: Point[] & tags.MinItems<1> & tags.MaxItems<150>;
}>;
//# sourceMappingURL=typia.d.ts.map