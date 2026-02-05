import typia, { tags } from "typia";
import type { RoomConfig, Guessage, Point } from "../types/main.types.js";

export const validateUsername: (
  input: unknown
) => typia.IValidation<string & tags.MinLength<3> & tags.MaxLength<20>> = typia.createValidate<
  string & tags.MinLength<3> & tags.MaxLength<20>
>();

export const validateUsernamePayload: (input: unknown) => typia.IValidation<{
  username: string & tags.MinLength<3> & tags.MaxLength<20>;
  playerId: string & tags.Format<"uuid">;
}> = typia.createValidate<{
  username: string & tags.MinLength<3> & tags.MaxLength<20>;
  playerId: string & tags.Format<"uuid">;
}>();

export const validateRoomConfig: (input: unknown) => typia.IValidation<Partial<RoomConfig>> =
  typia.createValidate<Partial<RoomConfig>>();

export const validateRoomId: (input: unknown) => typia.IValidation<string & tags.Format<"uuid">> =
  typia.createValidate<string & tags.Format<"uuid">>();

export const validateGuessage: (input: unknown) => typia.IValidation<Guessage> =
  typia.createValidate<Guessage>();

export const validateWord: (input: unknown) => typia.IValidation<string> =
  typia.createValidate<string>();

export const validateStrokeStart: (
  input: unknown
) => typia.IValidation<{ color: string; width: number }> = typia.createValidate<{
  color: string;
  width: number;
}>();

export const validateStrokePoints: (input: unknown) => typia.IValidation<{ points: Point[] }> =
  typia.createValidate<{ points: Point[] }>();
