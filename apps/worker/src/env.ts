import type { AnydropRoom } from "./room";

export interface Env {
  ANYDROP_ROOM: DurableObjectNamespace<AnydropRoom>;
  ROOM_SALT: string;
  // Optional comma-separated list of allowed browser origins.
  ALLOWED_ORIGINS?: string;
}
