// Copy of the frontend test hook interface (workspace docs/e2e-hook.md).
// Keep it in sync with Bomberman-2.0/src/utils/e2e.ts.

export interface E2EPlayer {
  name: string;
  x: number;
  y: number;
}

export interface E2EState {
  me: (E2EPlayer & { alive: boolean }) | null;
  enemies: E2EPlayer[];
  bombs: number;
}

export interface E2EHook {
  listenerCounts(events?: string[]): Record<string, number>;
  scenes(): string[];
  state(): E2EState | null;
  textures(): Record<string, string | null>;
}

declare global {
  interface Window {
    __e2e?: E2EHook;
  }
}
