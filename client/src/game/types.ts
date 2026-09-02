// Salt-Scoured Field Manual state vocabulary: every decision is a concrete tile, ration, threat, or delivery outcome.

export type TerrainKind = "sand" | "road" | "rock" | "ruin" | "oasis" | "cliff" | "settlement";
export type Landmark = "start" | "destination" | "oasis" | "cache" | null;
export type GamePhase = "travel" | "encounter" | "arrived" | "failed";

export interface GridPoint {
  col: number;
  row: number;
}

export interface Tile extends GridPoint {
  kind: TerrainKind;
  passable: boolean;
  cost: number;
  landmark: Landmark;
}

export interface Cargo {
  food: number;
  scrap: number;
  medicine: number;
  tech: number;
}

export interface CaravanState {
  position: GridPoint;
  fuel: number;
  water: number;
  food: number;
  parts: number;
  morale: number;
  health: number;
  day: number;
  cargo: Cargo;
  weather: "CLEAR" | "SANDSTORM";
  steps: number;
}

export interface Encounter {
  title: string;
  report: string;
  threat: number;
  type?: string; // For procedural encounters
  encounterId?: string; // Unique ID for tracking
}

export interface HudSnapshot {
  state: CaravanState;
  map: Tile[][];
  phase: GamePhase;
  encounter: Encounter | null;
  log: string[];
  location: string;
  cargoValue: number;
  cargoWeight: number;
  routeDistance: number;
  canTrade: boolean;
  // Campaign fields
  deliveryNumber?: number;
  campaignActive?: boolean;
}

export interface CampaignConfig {
  enabled: boolean;
  deliveryNumber: number;
  seed: number;
  difficulty: "easy" | "normal" | "hard";
}

