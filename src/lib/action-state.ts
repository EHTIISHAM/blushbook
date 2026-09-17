/**
 * Shared shape for form server actions.
 *
 * This lives outside the "use server" files on purpose: those may only export
 * async functions, so the idle constant needs a home of its own.
 */
export interface ActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export const IDLE: ActionState = { status: "idle" };
