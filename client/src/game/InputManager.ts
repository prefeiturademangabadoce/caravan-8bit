// Salt-Scoured Field Manual input: semantic navigation makes each deliberate move feel like operating expedition equipment.

import type { GridPoint } from "./types";

export interface InputTarget {
  moveBy(delta: GridPoint): void;
  restart(): void;
}

export class InputManager {
  private readonly onKeyDown: (event: KeyboardEvent) => void;

  constructor(target: InputTarget) {
    this.onKeyDown = (event) => {
      const active = document.activeElement?.tagName;
      if (active === "INPUT" || active === "TEXTAREA") return;

      const map: Record<string, GridPoint> = {
        ArrowUp: { col: 0, row: -1 },
        w: { col: 0, row: -1 },
        W: { col: 0, row: -1 },
        ArrowDown: { col: 0, row: 1 },
        s: { col: 0, row: 1 },
        S: { col: 0, row: 1 },
        ArrowLeft: { col: -1, row: 0 },
        a: { col: -1, row: 0 },
        A: { col: -1, row: 0 },
        ArrowRight: { col: 1, row: 0 },
        d: { col: 1, row: 0 },
        D: { col: 1, row: 0 },
      };
      const movement = map[event.key];
      if (movement) {
        event.preventDefault();
        target.moveBy(movement);
      }
      if (event.key.toLowerCase() === "r") target.restart();
    };
    window.addEventListener("keydown", this.onKeyDown);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
  }
}

