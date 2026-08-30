// Salt-Scoured Field Manual HUD: chipped field-report plates and mono readouts sit around, never over, the route decision.

import { assets } from "./assets";
import type { GridPoint, HudSnapshot } from "./types";

export interface HudActions {
  moveBy(delta: GridPoint): void;
  fight(): void;
  flee(): void;
  tribute(): void;
  trade(): void;
  restart(): void;
}

const compactNumber = (value: number) => Math.max(0, Math.round(value)).toString().padStart(2, "0");

export class HudController {
  private readonly root: HTMLDivElement;
  private readonly onClick: (event: MouseEvent) => void;

  constructor(private readonly actions: HudActions) {
    this.root = document.createElement("div");
    this.root.id = "caravan-hud";
    this.root.setAttribute("aria-live", "polite");
    document.body.appendChild(this.root);

    this.onClick = (event) => {
      const trigger = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
      if (!trigger) return;
      const action = trigger.dataset.action;
      if (action === "up") this.actions.moveBy({ col: 0, row: -1 });
      if (action === "down") this.actions.moveBy({ col: 0, row: 1 });
      if (action === "left") this.actions.moveBy({ col: -1, row: 0 });
      if (action === "right") this.actions.moveBy({ col: 1, row: 0 });
      if (action === "fight") this.actions.fight();
      if (action === "flee") this.actions.flee();
      if (action === "tribute") this.actions.tribute();
      if (action === "trade") this.actions.trade();
      if (action === "restart") this.actions.restart();
    };
    this.root.addEventListener("click", this.onClick);
  }

  render(snapshot: HudSnapshot) {
    const { state, phase, encounter, log, cargoValue, cargoWeight, routeDistance } = snapshot;
    const cargo = state.cargo;
    const phaseCopy =
      phase === "arrived"
        ? "DELIVERY VERIFIED"
        : phase === "failed"
          ? "CARAVAN LOST"
          : state.weather === "SANDSTORM"
            ? "SANDSTORM ACTIVE"
            : "ROUTE OPEN";

    const cells = snapshot.map
      .flat()
      .map((tile) => {
        const isCaravan = tile.col === state.position.col && tile.row === state.position.row;
        const classNames = [
          "map-cell",
          `terrain-${tile.kind}`,
          tile.landmark === "destination" ? "map-destination" : "",
          tile.landmark === "start" ? "map-start" : "",
          isCaravan ? "map-caravan" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<span class="${classNames}"></span>`;
      })
      .join("");

    const encounterActions = encounter
      ? `<div class="encounter-actions">
          <button data-action="fight" class="command command-danger"><span>FIGHT</span><small>risk hull / gain loot</small></button>
          <button data-action="flee" class="command"><span>FLEE</span><small>burn fuel / break contact</small></button>
          <button data-action="tribute" class="command"><span>PAY TRIBUTE</span><small>lose cargo / keep moving</small></button>
        </div>`
      : "";

    const endActions =
      phase === "arrived" || phase === "failed"
        ? `<button data-action="restart" class="restart-command">START ANOTHER RUN <b>R</b></button>`
        : "";

    this.root.className = state.weather === "SANDSTORM" ? "storm" : "";
    this.root.innerHTML = `
      <header class="mission-strip instrument-panel">
        <div class="brand-lockup">
          <span class="signal-mark" aria-hidden="true"><i></i></span>
          <div><span class="eyebrow">LONGHAUL 07</span><strong>CARAVAN</strong></div>
        </div>
        <div class="mission-readout"><span>POSITION</span><b>${snapshot.location}</b></div>
        <div class="mission-readout"><span>DAY / WEATHER</span><b>${String(state.day).padStart(2, "0")} · ${state.weather}</b></div>
        <div class="mission-readout route-readout"><span>TO WATERGATE</span><b>${routeDistance.toString().padStart(2, "0")} TILES</b></div>
      </header>

      <aside class="resource-rack instrument-panel">
        <div class="panel-kicker">SURVIVAL STOCK</div>
        ${this.resourceRow("WATER", state.water, 18, "water")}
        ${this.resourceRow("FUEL", state.fuel, 18, "fuel")}
        ${this.resourceRow("FOOD", state.food, 12, "food")}
        ${this.resourceRow("PARTS", state.parts, 8, "parts")}
        <div class="morale-line"><span>MORALE</span><div class="morale-ticks">${Array.from({ length: 10 }, (_, index) => `<i class="${index < Math.ceil(state.morale / 10) ? "on" : ""}"></i>`).join("")}</div><b>${compactNumber(state.morale)}</b></div>
        <div class="resource-footnote">RATIONS TICK WITH EVERY TILE.</div>
      </aside>

      <aside class="convoy-rack instrument-panel">
        <div class="panel-kicker">CONVOY STATUS</div>
        <div class="convoy-stat"><span>HULL INTEGRITY</span><b>${compactNumber(state.health)}%</b></div>
        <div class="hull-meter"><i style="width:${Math.max(0, state.health)}%"></i></div>
        <div class="convoy-stat"><span>PACE</span><b>${state.weather === "SANDSTORM" ? "SLOWED" : "STEADY"}</b></div>
        <div class="convoy-stat"><span>MANIFEST</span><b>${cargoWeight}/18 WT</b></div>
        <div class="cargo-list"><span>SCRAP ${cargo.scrap}</span><span>MED ${cargo.medicine}</span><span>TECH ${cargo.tech}</span></div>
        <div class="cargo-value"><span>DELIVERY VALUE</span><b>${cargoValue.toLocaleString()}<small> CR</small></b></div>
      </aside>

      <section class="field-report instrument-panel">
        <div class="report-topline"><span class="live-pip"></span><span>FIELD REPORT</span><b>${phaseCopy}</b></div>
        <p>${encounter ? encounter.report : log[0] ?? "The desert keeps its own counsel."}</p>
        ${encounterActions}
        ${snapshot.canTrade && !encounter ? `<button data-action="trade" class="trade-command">RESUPPLY &amp; TRADE AT OASIS</button>` : ""}
        ${endActions}
      </section>

      <section class="minimap instrument-panel" aria-label="Desert minimap">
        <div class="mini-label"><span>RANGE MAP</span><b>N</b></div>
        <div class="map-grid" style="grid-template-columns: repeat(${snapshot.map[0]?.length ?? 1}, 1fr)">${cells}</div>
        <div class="map-key"><span><i class="key-caravan"></i>CONVOY</span><span><i class="key-destination"></i>WATERGATE</span></div>
      </section>

      <nav class="movement-bank" aria-label="Caravan movement controls">
        <button data-action="up" aria-label="Move north">▲</button>
        <button data-action="left" aria-label="Move west">◀</button>
        <button data-action="down" aria-label="Move south">▼</button>
        <button data-action="right" aria-label="Move east">▶</button>
        <span>WASD / SELECT TILE</span>
      </nav>
    `;
  }

  dispose() {
    this.root.removeEventListener("click", this.onClick);
    this.root.remove();
  }

  private resourceRow(label: string, value: number, max: number, className: string) {
    const percentage = Math.max(0, Math.min(100, (value / max) * 100));
    return `<div class="resource-line ${className}"><div><span>${label}</span><b>${compactNumber(value)}</b></div><div class="meter"><i style="width:${percentage}%"></i></div></div>`;
  }
}
