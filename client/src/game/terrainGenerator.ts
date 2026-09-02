// Salt-Scoured Terrain Forge: Value Noise generates endless desert, Poisson-Disk scatters landmarks without crowding.

import type { GridPoint, Landmark, TerrainKind, Tile } from "./types";

const MAP_WIDTH = 12;
const MAP_HEIGHT = 10;

// Value Noise permutation table for repeatable randomness
class ValueNoise {
  private permutation: number[];
  
  constructor(seed: number) {
    this.permutation = [];
    const random = this.seededRandom(seed);
    for (let i = 0; i < 256; i++) {
      this.permutation.push(i);
    }
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]];
    }
    // Duplicate for overflow handling
    this.permutation = [...this.permutation, ...this.permutation];
  }
  
  private seededRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }
  
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  
  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    
    const u = this.fade(x);
    const v = this.fade(y);
    
    const A = this.permutation[X] + Y;
    const B = this.permutation[X + 1] + Y;
    
    const g00 = this.grad(this.permutation[A], x, y);
    const g10 = this.grad(this.permutation[B], x - 1, y);
    const g01 = this.grad(this.permutation[A + 1], x, y - 1);
    const g11 = this.grad(this.permutation[B + 1], x - 1, y - 1);
    
    const x1 = this.lerp(g00, g10, u);
    const x2 = this.lerp(g01, g11, u);
    
    return (this.lerp(x1, x2, v) + 1) / 2; // Normalize to 0-1
  }
  
  // Fractal Brownian Motion for more natural terrain
  fbm(x: number, y: number, octaves: number = 4): number {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    
    return value / maxValue;
  }
}

// Poisson-Disk Sampling for well-spaced landmark placement
class PoissonDiskSampler {
  private width: number;
  private height: number;
  private radius: number;
  private k: number; // candidates per point
  private grid: Map<string, { col: number; row: number }>;
  private activeList: Array<{ col: number; row: number }>;
  private points: Array<{ col: number; row: number }>;
  private cellSize: number;
  
  constructor(width: number, height: number, minDistance: number) {
    this.width = width;
    this.height = height;
    this.radius = minDistance;
    this.k = 30; // attempts per point
    this.grid = new Map();
    this.activeList = [];
    this.points = [];
    this.cellSize = this.radius / Math.sqrt(2);
  }
  
  sample(count: number, excludedPoints: Set<string> = new Set()): Array<{ col: number; row: number }> {
    // Start with a random point
    const startCol = Math.floor(Math.random() * this.width);
    const startRow = Math.floor(Math.random() * this.height);
    
    if (!excludedPoints.has(`${startCol},${startRow}`)) {
      this.addPoint(startCol, startRow);
    }
    
    while (this.points.length < count && this.activeList.length > 0) {
      // Pick a random active point
      const activeIndex = Math.floor(Math.random() * this.activeList.length);
      const current = this.activeList[activeIndex];
      
      let found = false;
      for (let attempt = 0; attempt < this.k; attempt++) {
        // Generate random point in annulus
        const angle = Math.random() * Math.PI * 2;
        const distance = this.radius + Math.random() * this.radius;
        const col = Math.round(current.col + Math.cos(angle) * distance);
        const row = Math.round(current.row + Math.sin(angle) * distance);
        
        if (this.isValid(col, row) && !excludedPoints.has(`${col},${row}`)) {
          this.addPoint(col, row);
          found = true;
          break;
        }
      }
      
      if (!found) {
        this.activeList.splice(activeIndex, 1);
      }
    }
    
    // If we still need more points, try adding them randomly
    while (this.points.length < count) {
      const col = Math.floor(Math.random() * this.width);
      const row = Math.floor(Math.random() * this.height);
      const key = `${col},${row}`;
      
      if (!excludedPoints.has(key) && !this.points.some(p => p.col === col && p.row === row)) {
        let tooClose = false;
        for (const point of this.points) {
          const dist = Math.sqrt(Math.pow(point.col - col, 2) + Math.pow(point.row - row, 2));
          if (dist < this.radius) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          this.points.push({ col, row });
        }
      }
      
      // Safety valve to prevent infinite loops
      if (this.points.length >= count || count - this.points.length > 100) break;
    }
    
    return this.points.slice(0, count);
  }
  
  private isValid(col: number, row: number): boolean {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) return false;
    
    const key = `${col},${row}`;
    if (this.grid.has(key)) return false;
    
    // Check neighboring cells
    const cellCol = Math.floor(col / this.cellSize);
    const cellRow = Math.floor(row / this.cellSize);
    
    for (let dc = -2; dc <= 2; dc++) {
      for (let dr = -2; dr <= 2; dr++) {
        const neighborKey = `${cellCol + dc},${cellRow + dr}`;
        const neighbor = this.grid.get(neighborKey);
        if (neighbor) {
          const dist = Math.sqrt(Math.pow(neighbor.col - col, 2) + Math.pow(neighbor.row - row, 2));
          if (dist < this.radius) return false;
        }
      }
    }
    
    return true;
  }
  
  private addPoint(col: number, row: number) {
    this.points.push({ col, row });
    this.activeList.push({ col, row });
    
    const cellCol = Math.floor(col / this.cellSize);
    const cellRow = Math.floor(row / this.cellSize);
    this.grid.set(`${cellCol},${cellRow}`, { col, row });
  }
}

export interface TerrainConfig {
  seed: number;
  difficulty: "easy" | "normal" | "hard";
  deliveryNumber: number;
}

export function generateProceduralMap(config: TerrainConfig): { map: Tile[][]; start: GridPoint; destination: GridPoint } {
  const noise = new ValueNoise(config.seed);
  
  // Scale noise coordinates for appropriate feature size
  const scale = 0.15 + (config.deliveryNumber * 0.01); // Slightly more varied each delivery
  
  // Generate elevation and moisture maps
  const elevationMap: number[][] = [];
  const moistureMap: number[][] = [];
  
  for (let row = 0; row < MAP_HEIGHT; row++) {
    elevationMap[row] = [];
    moistureMap[row] = [];
    for (let col = 0; col < MAP_WIDTH; col++) {
      // Offset coordinates to avoid repeating patterns at origin
      const nx = (col + config.seed % 100) * scale;
      const ny = (row + config.seed % 100) * scale;
      
      elevationMap[row][col] = noise.fbm(nx, ny, 4);
      moistureMap[row][col] = noise.fbm(nx + 1000, ny + 1000, 3);
    }
  }
  
  // Determine terrain types based on elevation and moisture
  const tiles: Tile[][] = [];
  
  for (let row = 0; row < MAP_HEIGHT; row++) {
    tiles[row] = [];
    for (let col = 0; col < MAP_WIDTH; col++) {
      const elevation = elevationMap[row][col];
      const moisture = moistureMap[row][col];
      
      let kind: TerrainKind = "sand";
      
      if (elevation > 0.75) {
        kind = "cliff";
      } else if (elevation > 0.6) {
        kind = moisture > 0.5 ? "oasis" : "rock";
      } else if (elevation > 0.45) {
        kind = moisture > 0.6 ? "ruin" : "rock";
      } else if (elevation > 0.35) {
        kind = "sand";
      } else {
        kind = "sand";
      }
      
      tiles[row][col] = {
        col,
        row,
        kind,
        passable: kind !== "cliff",
        cost: getTerrainCost(kind),
        landmark: null,
      };
    }
  }
  
  // Place start and destination using Poisson-Disk for good separation
  const excludedStart = new Set<string>();
  const sampler = new PoissonDiskSampler(MAP_WIDTH, MAP_HEIGHT, 5);
  const landmarkPositions = sampler.sample(4, excludedStart);
  
  // Ensure we have valid positions
  if (landmarkPositions.length >= 2) {
    const startPos = landmarkPositions[0];
    const destPos = landmarkPositions[landmarkPositions.length - 1];
    
    // Make sure start and destination are on passable terrain
    tiles[startPos.row][startPos.col] = {
      ...tiles[startPos.row][startPos.col],
      kind: "settlement",
      passable: true,
      landmark: "start",
    };
    
    tiles[destPos.row][destPos.col] = {
      ...tiles[destPos.row][destPos.col],
      kind: "settlement",
      passable: true,
      landmark: "destination",
    };
    
    // Place oasis if not already present
    if (landmarkPositions.length >= 3) {
      const oasisPos = landmarkPositions[1];
      if (tiles[oasisPos.row][oasisPos.col].kind !== "cliff") {
        tiles[oasisPos.row][oasisPos.col] = {
          ...tiles[oasisPos.row][oasisPos.col],
          kind: "oasis",
          landmark: "oasis",
        };
      }
    }
    
    // Place cache
    if (landmarkPositions.length >= 4) {
      const cachePos = landmarkPositions[2];
      if (tiles[cachePos.row][cachePos.col].kind !== "cliff" && !tiles[cachePos.row][cachePos.col].landmark) {
        tiles[cachePos.row][cachePos.col] = {
          ...tiles[cachePos.row][cachePos.col],
          landmark: "cache",
        };
      }
    }
    
    return {
      map: tiles,
      start: startPos,
      destination: destPos,
    };
  }
  
  // Fallback to simple placement if Poisson-Disk fails
  return generateFallbackMap(tiles);
}

function getTerrainCost(kind: TerrainKind): number {
  switch (kind) {
    case "road":
    case "settlement":
      return 0.65;
    case "sand":
      return 1.0;
    case "oasis":
      return 0.8;
    case "rock":
    case "ruin":
      return 1.5;
    case "cliff":
      return Infinity;
  }
}

function generateFallbackMap(tiles: Tile[][]): { map: Tile[][]; start: GridPoint; destination: GridPoint } {
  const start = { col: 1, row: MAP_HEIGHT - 2 };
  const destination = { col: MAP_WIDTH - 2, row: 1 };
  
  // Ensure start is passable
  tiles[start.row][start.col] = {
    ...tiles[start.row][start.col],
    kind: "settlement",
    passable: true,
    landmark: "start",
  };
  
  // Ensure destination is passable
  tiles[destination.row][destination.col] = {
    ...tiles[destination.row][destination.col],
    kind: "settlement",
    passable: true,
    landmark: "destination",
  };
  
  // Add an oasis somewhere mid-map
  const oasisRow = Math.floor(MAP_HEIGHT / 2);
  const oasisCol = Math.floor(MAP_WIDTH / 3);
  tiles[oasisRow][oasisCol] = {
    ...tiles[oasisRow][oasisCol],
    kind: "oasis",
    landmark: "oasis",
  };
  
  return { map: tiles, start, destination };
}

export function generateEncounterPoints(map: Tile[][], deliveryNumber: number, seed: number): Array<{ col: number; row: number; type: string }> {
  const noise = new ValueNoise(seed + 500);
  const encounters: Array<{ col: number; row: number; type: string }> = [];
  
  const encounterTypes = ["raider_ambush", "trader_caravan", "distress_signal", "ancient_relic", "sandstorm_shelter"];
  
  // Number of encounters scales with delivery number
  const numEncounters = Math.min(3 + Math.floor(deliveryNumber / 3), 6);
  
  const sampler = new PoissonDiskSampler(MAP_WIDTH, MAP_HEIGHT, 3);
  const positions = sampler.sample(numEncounters);
  
  positions.forEach((pos, index) => {
    const tile = map[pos.row]?.[pos.col];
    if (tile && tile.passable && !tile.landmark) {
      // Choose encounter type based on terrain and noise
      const noiseVal = noise.noise2D(pos.col * 0.3, pos.row * 0.3);
      let type = encounterTypes[Math.floor(noiseVal * encounterTypes.length)];
      
      // Adjust based on terrain
      if (tile.kind === "ruin" && Math.random() > 0.5) {
        type = "ancient_relic";
      } else if (tile.kind === "rock" && Math.random() > 0.6) {
        type = "raider_ambush";
      }
      
      encounters.push({ col: pos.col, row: pos.row, type });
    }
  });
  
  return encounters;
}

export function getEncounterDescription(type: string, seed: number): { title: string; report: string; threat: number } {
  const descriptions: Record<string, Array<{ title: string; report: string; threat: number }>> = {
    raider_ambush: [
      { title: "RIDGE RAIDERS", report: "Movement in the collapsed relay station. Raiders box you in.", threat: 3 },
      { title: "DUST PIRATES", report: "Three bikes emerge from the haze. They want your cargo.", threat: 4 },
      { title: "SALVAGE HUNTERS", report: "Armed scavengers block the path. Negotiation seems unlikely.", threat: 2 },
    ],
    trader_caravan: [
      { title: "WANDERING MERCHANTS", report: "A small caravan approaches. Their leader signals peaceful intent.", threat: 0 },
      { title: "NOMAD TRADERS", report: "Salt-flat nomads offer to trade supplies.", threat: 0 },
      { title: "RELIC PEDDLERS", report: "Shady traders display questionable artifacts.", threat: 1 },
    ],
    distress_signal: [
      { title: "MAYDAY TRANSMISSION", report: "A weak signal repeats from nearby ruins. Someone's in trouble.", threat: 1 },
      { title: "BROKEN CONVOY", report: "A stalled vehicle sends up dust. Survivors wave for help.", threat: 0 },
      { title: "SOS BEACON", report: "An old emergency beacon still broadcasts. Worth investigating?", threat: 1 },
    ],
    ancient_relic: [
      { title: "PRE-STORM RUINS", report: "Ancient technology half-buried in the sand. Might contain useful parts.", threat: 0 },
      { title: "FORGOTTEN DEPOT", report: "A sealed supply cache from before the storms.", threat: 1 },
      { title: "LOST TRANSMITTER", report: "Old communication equipment still hums with power.", threat: 0 },
    ],
    sandstorm_shelter: [
      { title: "STORM CELLAR", report: "A reinforced bunker offers protection from approaching weather.", threat: 0 },
      { title: "CAVE MOUTH", report: "Natural formation provides cover from the wind.", threat: 0 },
      { title: "ABANDONED STATION", report: "Weather monitoring station with intact shelter.", threat: 0 },
    ],
  };
  
  const options = descriptions[type] ?? descriptions.raider_ambush;
  return options[Math.floor(seed * 1000) % options.length];
}
