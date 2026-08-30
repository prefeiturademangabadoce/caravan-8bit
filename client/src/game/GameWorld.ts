// Salt-Scoured Field Manual world: faceted ground and curt event reports make each tile feel like a real expedition choice.

import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PointerEventTypes, type PointerInfo } from "@babylonjs/core/Events/pointerEvents";
import type { Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { assets } from "./assets";
import { HudController } from "./HudController";
import { InputManager } from "./InputManager";
import type { CaravanState, Encounter, GamePhase, GridPoint, HudSnapshot, Landmark, TerrainKind, Tile } from "./types";

const MAP_WIDTH = 12;
const MAP_HEIGHT = 10;
const TILE_SIZE = 1.14;

const terrainTone: Record<TerrainKind, Color3> = {
  sand: Color3.FromHexString("#B98B4B"),
  road: Color3.FromHexString("#756044"),
  rock: Color3.FromHexString("#7D5940"),
  ruin: Color3.FromHexString("#9E7045"),
  oasis: Color3.FromHexString("#7C8B63"),
  cliff: Color3.FromHexString("#4D3A31"),
  settlement: Color3.FromHexString("#A07852"),
};

const landmarkNames: Record<Exclude<Landmark, null>, string> = {
  start: "DUSTHOOK",
  destination: "WATERGATE",
  oasis: "KETTLE OASIS",
  cache: "ABANDONED CACHE",
};

interface PendingMove {
  from: GridPoint;
  to: GridPoint;
  elapsed: number;
  duration: number;
}

export class GameWorld {
  private readonly map = this.buildMap();
  private readonly materials: Partial<Record<TerrainKind, StandardMaterial>> = {};
  private readonly routeMarkers: Mesh[] = [];
  private readonly raiderMeshes: AbstractMesh[] = [];
  private state: CaravanState = this.makeInitialState();
  private phase: GamePhase = "travel";
  private encounter: Encounter | null = null;
  private convoy!: TransformNode;
  private highlight!: Mesh;
  private hud: HudController;
  private input: InputManager;
  private pointerObserver?: Observer<PointerInfo>;
  private pendingMove: PendingMove | null = null;
  private stormTurns = 0;
  private raidersResolved = false;
  private cacheClaimed = false;
  private oasisTraded = false;
  private demoTimer = 0;
  private demoIndex = 0;
  private readonly demoMode = new URLSearchParams(window.location.search).has("demo");
  private readonly log: string[] = ["Dusthook disappears behind the convoy. Watergate signal is holding." ];

  constructor(private readonly scene: Scene) {
    this.createMaterials();
    this.createTerrain();
    this.createConvoy();
    this.createRaiders();
    this.createRouteMarkers();
    this.moveConvoyTo(this.state.position);
    this.hud = new HudController({
      moveBy: (delta) => this.moveBy(delta),
      fight: () => this.fight(),
      flee: () => this.flee(),
      tribute: () => this.tribute(),
      trade: () => this.trade(),
      restart: () => this.restart(),
    });
    this.input = new InputManager({ moveBy: (delta) => this.moveBy(delta), restart: () => this.restart() });
    this.pointerObserver = this.scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERDOWN) return;
      const tile = info.pickInfo?.pickedMesh?.metadata?.caravanTile as GridPoint | undefined;
      if (tile) this.tryMoveTo(tile);
    });
    this.renderHud();
  }

  update(delta: number) {
    if (this.pendingMove) this.updateMovement(delta);
    if (this.demoMode && this.phase === "travel" && !this.pendingMove) {
      this.demoTimer += delta;
      if (this.demoTimer > 0.85) {
        this.demoTimer = 0;
        const path = this.findPath(this.state.position, { col: 10, row: 1 });
        const target = path[Math.min(1, path.length - 1)];
        if (target) this.tryMoveTo(target);
      }
    }
  }

  dispose() {
    this.input.dispose();
    this.hud.dispose();
    if (this.pointerObserver) this.scene.onPointerObservable.remove(this.pointerObserver);
  }

  moveBy(delta: GridPoint) {
    this.tryMoveTo({ col: this.state.position.col + delta.col, row: this.state.position.row + delta.row });
  }

  tryMoveTo(target: GridPoint) {
    if (this.phase !== "travel" || this.pendingMove) return;
    const tile = this.getTile(target);
    const distance = Math.abs(target.col - this.state.position.col) + Math.abs(target.row - this.state.position.row);
    if (!tile || !tile.passable || distance !== 1) {
      this.report("Route obstruction. The convoy needs a legal adjacent tile.");
      return;
    }
    if (this.state.fuel < 0.6) {
      this.phase = "failed";
      this.report("No fuel. The desert closes over the stalled convoy.");
      this.renderHud();
      return;
    }

    this.pendingMove = { from: { ...this.state.position }, to: target, elapsed: 0, duration: this.state.weather === "SANDSTORM" ? 0.52 : 0.31 };
    this.consumeForTile(tile);
    this.renderHud();
  }

  fight() {
    if (this.phase !== "encounter") return;
    const advantage = this.state.morale + this.state.health / 2;
    const loss = advantage > 85 ? 8 : 19;
    this.state.health = Math.max(0, this.state.health - loss);
    this.state.morale = Math.max(0, this.state.morale - 6);
    this.state.cargo.scrap += 2;
    this.state.cargo.medicine += 1;
    this.resolveEncounter(`Raiders scattered. You take usable salvage, but the lead hauler loses ${loss}% hull.`);
  }

  flee() {
    if (this.phase !== "encounter") return;
    this.state.fuel = Math.max(0, this.state.fuel - 2);
    this.state.water = Math.max(0, this.state.water - 1);
    this.state.morale = Math.max(0, this.state.morale - 4);
    this.resolveEncounter("The convoy tears through loose sand and loses the tail. Fuel tanks pay for the distance.");
  }

  tribute() {
    if (this.phase !== "encounter") return;
    const payment = Math.min(3, this.state.cargo.scrap);
    this.state.cargo.scrap -= payment;
    if (payment < 3 && this.state.cargo.medicine > 0) this.state.cargo.medicine -= 1;
    this.state.morale = Math.max(0, this.state.morale - 2);
    this.resolveEncounter("The raiders take their due and vanish into the ruins. The road is clear—for now.");
  }

  trade() {
    if (this.phase !== "travel" || !this.canTrade() || this.oasisTraded) return;
    this.oasisTraded = true;
    const barter = Math.min(2, this.state.cargo.scrap);
    this.state.cargo.scrap -= barter;
    this.state.water = Math.min(18, this.state.water + 6);
    this.state.fuel = Math.min(18, this.state.fuel + 2);
    this.state.cargo.tech += 1;
    this.state.morale = Math.min(100, this.state.morale + 8);
    this.report(`Kettle Oasis accepts ${barter} scrap. Tanks refilled; a sealed signal relay joins the manifest.`);
    this.renderHud();
  }

  restart() {
    this.state = this.makeInitialState();
    this.phase = "travel";
    this.encounter = null;
    this.pendingMove = null;
    this.stormTurns = 0;
    this.raidersResolved = false;
    this.cacheClaimed = false;
    this.oasisTraded = false;
    this.log.splice(0, this.log.length, "New manifest loaded. Dusthook gate is open.");
    this.moveConvoyTo(this.state.position);
    this.createRouteMarkers();
    this.renderHud();
  }

  private updateMovement(delta: number) {
    const move = this.pendingMove;
    if (!move) return;
    move.elapsed += delta;
    const progress = Math.min(1, move.elapsed / move.duration);
    const eased = 1 - (1 - progress) * (1 - progress);
    const from = this.gridToWorld(move.from);
    const to = this.gridToWorld(move.to);
    this.convoy.position.x = from.x + (to.x - from.x) * eased;
    this.convoy.position.z = from.z + (to.z - from.z) * eased;
    this.convoy.position.y = 0.2 + Math.sin(progress * Math.PI) * 0.08;
    this.convoy.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);

    if (progress < 1) return;
    this.state.position = { ...move.to };
    this.pendingMove = null;
    this.moveConvoyTo(this.state.position);
    this.afterMove();
  }

  private afterMove() {
    this.state.steps += 1;
    this.state.day = 1 + Math.floor(this.state.steps / 4);
    const tile = this.getTile(this.state.position)!;
    const name = tile.landmark ? landmarkNames[tile.landmark] : this.terrainName(tile.kind);
    this.report(`Convoy reaches ${name}. ${this.state.weather === "SANDSTORM" ? "The wind claws at exposed cargo." : "Scout the next tile before committing."}`);

    if (this.state.water <= 0 || this.state.health <= 0) {
      this.phase = "failed";
      this.report("The convoy cannot sustain another mile. The run ends in the open desert.");
      this.renderHud();
      return;
    }

    if (tile.landmark === "destination") {
      this.phase = "arrived";
      this.state.morale = Math.min(100, this.state.morale + 12);
      this.report(`Watergate docks receive ${this.cargoValue().toLocaleString()} credits of surviving cargo. Delivery verified.`);
      this.renderHud();
      return;
    }

    if (tile.landmark === "cache" && !this.cacheClaimed) {
      this.cacheClaimed = true;
      this.state.parts = Math.min(8, this.state.parts + 2);
      this.state.cargo.medicine += 1;
      this.report("A buried survey cache yields two parts and a sealed medical case.");
    }

    if (!this.raidersResolved && this.isRaiderZone(this.state.position)) {
      this.phase = "encounter";
      this.encounter = {
        title: "RIDGE RAIDERS",
        report: "Movement in the collapsed relay station. Three bikes roll toward the road. Your convoy is boxed in by rock.",
        threat: 3,
      };
      this.report(this.encounter.report);
      this.renderHud();
      return;
    }

    this.advanceWeather();
    this.createRouteMarkers();
    this.renderHud();
  }

  private resolveEncounter(message: string) {
    this.raidersResolved = true;
    this.phase = this.state.health <= 0 || this.state.fuel <= 0 ? "failed" : "travel";
    this.encounter = null;
    this.raiderMeshes.forEach((mesh) => (mesh.isVisible = false));
    this.report(message);
    this.createRouteMarkers();
    this.renderHud();
  }

  private consumeForTile(tile: Tile) {
    const stormMultiplier = this.state.weather === "SANDSTORM" ? 1.55 : 1;
    const fuelUse = tile.kind === "road" ? 0.65 : tile.cost;
    this.state.fuel = Math.max(0, this.state.fuel - fuelUse * stormMultiplier);
    this.state.water = Math.max(0, this.state.water - 0.85 * stormMultiplier);
    this.state.food = Math.max(0, this.state.food - 0.45);
    if ((tile.kind === "rock" || tile.kind === "ruin") && this.state.steps % 3 === 2) {
      this.state.parts = Math.max(0, this.state.parts - 1);
      this.state.health = Math.max(0, this.state.health - 3);
      this.report("Rough ground shakes a bracket loose. One spare part spent.");
    }
    if (this.state.fuel < 3) this.state.morale = Math.max(0, this.state.morale - 3);
  }

  private advanceWeather() {
    if (this.state.steps === 4) {
      this.stormTurns = 3;
      this.state.weather = "SANDSTORM";
      this.report("A brown wall rises in the southwest. Sandstorm conditions reduce pace and deepen consumption.");
      return;
    }
    if (this.stormTurns > 0) {
      this.stormTurns -= 1;
      if (this.stormTurns === 0) {
        this.state.weather = "CLEAR";
        this.report("The storm breaks. Watergate beacon returns to the horizon.");
      }
    }
  }

  private canTrade() {
    return this.getTile(this.state.position)?.landmark === "oasis" && !this.oasisTraded;
  }

  private renderHud() {
    this.hud.render({
      state: { ...this.state, position: { ...this.state.position }, cargo: { ...this.state.cargo } },
      map: this.map,
      phase: this.phase,
      encounter: this.encounter,
      log: this.log,
      location: this.getLocationName(),
      cargoValue: this.cargoValue(),
      cargoWeight: this.cargoWeight(),
      routeDistance: Math.max(0, this.findPath(this.state.position, { col: 10, row: 1 }).length - 1),
      canTrade: this.canTrade(),
    });
  }

  private report(message: string) {
    this.log.unshift(message);
    this.log.splice(3);
  }

  private cargoValue() {
    const c = this.state.cargo;
    return c.food * 16 + c.scrap * 54 + c.medicine * 165 + c.tech * 310;
  }

  private cargoWeight() {
    const c = this.state.cargo;
    return c.food + c.scrap + c.medicine + c.tech * 2;
  }

  private getLocationName() {
    const tile = this.getTile(this.state.position);
    if (tile?.landmark) return landmarkNames[tile.landmark];
    return `${this.terrainName(tile?.kind ?? "sand")} SECTOR`;
  }

  private terrainName(kind: TerrainKind) {
    return { sand: "OPEN SAND", road: "OLD ROAD", rock: "ROCK FIELD", ruin: "RELAY RUINS", oasis: "OASIS MARGIN", cliff: "CLIFF", settlement: "SETTLEMENT" }[kind];
  }

  private makeInitialState(): CaravanState {
    return {
      position: { col: 1, row: 8 },
      fuel: 16,
      water: 14,
      food: 8,
      parts: 4,
      morale: 78,
      health: 100,
      day: 1,
      cargo: { food: 3, scrap: 6, medicine: 2, tech: 1 },
      weather: "CLEAR",
      steps: 0,
    };
  }

  private createMaterials() {
    const sand = new StandardMaterial("sand-mat", this.scene);
    const sandTexture = new Texture(assets.sand, this.scene, false, true, Texture.NEAREST_SAMPLINGMODE);
    sandTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    sandTexture.wrapV = Texture.WRAP_ADDRESSMODE;
    sandTexture.uScale = 1.2;
    sandTexture.vScale = 1.2;
    sand.diffuseTexture = sandTexture;
    sand.diffuseColor = terrainTone.sand;
    sand.specularColor = Color3.Black();
    this.materials.sand = sand;

    (Object.keys(terrainTone) as TerrainKind[]).forEach((kind) => {
      if (kind === "sand") return;
      const material = new StandardMaterial(`${kind}-mat`, this.scene);
      material.diffuseColor = terrainTone[kind];
      material.specularColor = Color3.Black();
      this.materials[kind] = material;
    });
  }

  private createTerrain() {
    this.map.flat().forEach((tile) => {
      const height = tile.kind === "cliff" ? 0.8 : tile.kind === "rock" ? 0.2 : 0.12;
      const mesh = MeshBuilder.CreateBox(`tile-${tile.col}-${tile.row}`, { width: TILE_SIZE * 0.98, depth: TILE_SIZE * 0.98, height }, this.scene);
      const point = this.gridToWorld(tile);
      mesh.position = new Vector3(this.snap(point.x), height / 2 - 0.1, this.snap(point.z));
      mesh.material = this.materials[tile.kind]!;
      mesh.metadata = { caravanTile: { col: tile.col, row: tile.row } };
      if (!tile.passable) mesh.isPickable = false;

      if (tile.kind === "rock" || tile.kind === "ruin") this.addRock(tile, tile.kind === "ruin");
      if (tile.kind === "cliff") this.addCliff(tile);
      if (tile.landmark === "oasis") this.addOasis(tile);
      if (tile.landmark === "start" || tile.landmark === "destination") this.addSettlement(tile);
      if (tile.landmark === "cache") this.addCache(tile);
    });

    this.highlight = MeshBuilder.CreateGround("tile-highlight", { width: TILE_SIZE * 0.72, height: TILE_SIZE * 0.72 }, this.scene);
    this.highlight.rotation.x = Math.PI / 2;
    this.highlight.position.y = 0.01;
    const highlightMat = new StandardMaterial("highlight-mat", this.scene);
    highlightMat.diffuseColor = Color3.FromHexString("#2C7D88");
    highlightMat.emissiveColor = Color3.FromHexString("#1A4E55");
    highlightMat.alpha = 0.62;
    this.highlight.material = highlightMat;
    this.highlight.isPickable = false;
    this.highlight.setEnabled(false);
  }

  private createConvoy() {
    this.convoy = new TransformNode("convoy", this.scene);
    const rustMat = new StandardMaterial("convoy-rust", this.scene);
    const rustTexture = new Texture(assets.rust, this.scene, false, true, Texture.NEAREST_SAMPLINGMODE);
    rustTexture.uScale = 1.4;
    rustTexture.vScale = 1.4;
    rustMat.diffuseTexture = rustTexture;
    rustMat.diffuseColor = Color3.FromHexString("#A64F2D");
    rustMat.specularColor = Color3.Black();
    const black = this.makeMaterial("convoy-black", "#25231E");
    const canvas = this.makeMaterial("convoy-canvas", "#BCAD82");
    const water = this.makeMaterial("convoy-water", "#2C7D88");

    const hauler = MeshBuilder.CreateBox("lead-hauler", { width: 0.82, height: 0.38, depth: 1.05 }, this.scene);
    hauler.position = new Vector3(0, 0.38, 0.35);
    hauler.material = rustMat;
    hauler.parent = this.convoy;
    const cab = MeshBuilder.CreateBox("hauler-cab", { width: 0.74, height: 0.34, depth: 0.38 }, this.scene);
    cab.position = new Vector3(0, 0.64, 0.73);
    cab.material = black;
    cab.parent = this.convoy;
    this.addWheels(this.convoy, 0.44, 0.35, black);

    const wagon = MeshBuilder.CreateBox("cargo-wagon", { width: 0.76, height: 0.3, depth: 0.78 }, this.scene);
    wagon.position = new Vector3(0, 0.3, -0.68);
    wagon.material = rustMat;
    wagon.parent = this.convoy;
    const canopy = MeshBuilder.CreateBox("wagon-canopy", { width: 0.8, height: 0.36, depth: 0.68 }, this.scene);
    canopy.position = new Vector3(0, 0.58, -0.68);
    canopy.material = canvas;
    canopy.parent = this.convoy;
    this.addWheels(this.convoy, 0.32, -0.68, black);

    const trailer = MeshBuilder.CreateCylinder("water-trailer", { height: 0.65, diameter: 0.44, tessellation: 8 }, this.scene);
    trailer.rotation.z = Math.PI / 2;
    trailer.position = new Vector3(0, 0.34, -1.32);
    trailer.material = water;
    trailer.parent = this.convoy;
    this.addWheels(this.convoy, 0.23, -1.32, black);
    this.convoy.getChildMeshes().forEach((mesh) => (mesh.isPickable = false));
  }

  private addWheels(parent: TransformNode, spacing: number, z: number, material: StandardMaterial) {
    [-0.43, 0.43].forEach((x, index) => {
      const wheel = MeshBuilder.CreateCylinder(`wheel-${z}-${index}`, { height: 0.14, diameter: spacing, tessellation: 8 }, this.scene);
      wheel.rotation.z = Math.PI / 2;
      wheel.position = new Vector3(x, 0.18, z);
      wheel.material = material;
      wheel.parent = parent;
    });
  }

  private createRaiders() {
    const black = this.makeMaterial("raider-black", "#24221F");
    const red = this.makeMaterial("raider-red", "#A33D31");
    [[7, 5], [6, 5], [7, 4]].forEach(([col, row], index) => {
      const root = new TransformNode(`raider-${index}`, this.scene);
      const point = this.gridToWorld({ col, row });
      root.position = new Vector3(point.x + (index - 1) * 0.18, 0.18, point.z + 0.18);
      const bike = MeshBuilder.CreateBox(`raider-bike-${index}`, { width: 0.38, height: 0.22, depth: 0.58 }, this.scene);
      bike.material = black;
      bike.parent = root;
      const flag = MeshBuilder.CreateBox(`raider-flag-${index}`, { width: 0.05, height: 0.46, depth: 0.05 }, this.scene);
      flag.position.y = 0.28;
      flag.material = red;
      flag.parent = root;
      root.getChildMeshes().forEach((mesh) => { mesh.isPickable = false; this.raiderMeshes.push(mesh); });
    });
  }

  private addRock(tile: Tile, ruined = false) {
    const point = this.gridToWorld(tile);
    const material = this.makeMaterial(`rock-mat-${tile.col}-${tile.row}`, ruined ? "#825239" : "#665044");
    const count = ruined ? 3 : 2;
    for (let index = 0; index < count; index += 1) {
      const rock = MeshBuilder.CreateIcoSphere(`rock-${tile.col}-${tile.row}-${index}`, { radius: 0.2 + index * 0.06, subdivisions: 1 }, this.scene);
      rock.scaling.y = ruined ? 1.8 : 0.72;
      rock.position = new Vector3(point.x + (index - 0.6) * 0.3, 0.12, point.z + (index % 2) * 0.22 - 0.08);
      rock.rotation = new Vector3(index * 0.7, index * 1.1, 0);
      rock.material = material;
      rock.isPickable = false;
    }
  }

  private addCliff(tile: Tile) {
    const point = this.gridToWorld(tile);
    const material = this.makeMaterial(`cliff-mat-${tile.col}-${tile.row}`, "#48382F");
    const cliff = MeshBuilder.CreateIcoSphere(`cliff-${tile.col}-${tile.row}`, { radius: 0.53, subdivisions: 1 }, this.scene);
    cliff.scaling.y = 1.5;
    cliff.position = new Vector3(point.x, 0.55, point.z);
    cliff.material = material;
    cliff.isPickable = false;
  }

  private addOasis(tile: Tile) {
    const point = this.gridToWorld(tile);
    const water = this.makeMaterial(`oasis-water-${tile.col}-${tile.row}`, "#2C7D88");
    water.emissiveColor = Color3.FromHexString("#15454C");
    const pool = MeshBuilder.CreateCylinder(`oasis-pool-${tile.col}-${tile.row}`, { diameter: 0.72, height: 0.08, tessellation: 8 }, this.scene);
    pool.position = new Vector3(point.x, 0.02, point.z);
    pool.material = water;
    pool.isPickable = false;
    const trunk = this.makeMaterial(`palm-trunk-${tile.col}-${tile.row}`, "#4B3B2B");
    const leaf = this.makeMaterial(`palm-leaf-${tile.col}-${tile.row}`, "#4F6651");
    [-0.28, 0.29].forEach((offset, index) => {
      const palm = MeshBuilder.CreateCylinder(`palm-${tile.col}-${tile.row}-${index}`, { height: 0.82, diameterTop: 0.07, diameterBottom: 0.1, tessellation: 6 }, this.scene);
      palm.position = new Vector3(point.x + offset, 0.43, point.z + 0.16);
      palm.material = trunk;
      palm.isPickable = false;
      for (let leafIndex = 0; leafIndex < 4; leafIndex += 1) {
        const frond = MeshBuilder.CreateBox(`frond-${tile.col}-${tile.row}-${index}-${leafIndex}`, { width: 0.08, height: 0.045, depth: 0.56 }, this.scene);
        frond.position = new Vector3(point.x + offset, 0.82, point.z + 0.16);
        frond.rotation.y = leafIndex * (Math.PI / 2);
        frond.material = leaf;
        frond.isPickable = false;
      }
    });
  }

  private addSettlement(tile: Tile) {
    const point = this.gridToWorld(tile);
    const adobe = this.makeMaterial(`adobe-${tile.col}-${tile.row}`, "#C08B58");
    const roof = this.makeMaterial(`roof-${tile.col}-${tile.row}`, "#4B4240");
    for (let index = 0; index < 2; index += 1) {
      const building = MeshBuilder.CreateBox(`building-${tile.col}-${tile.row}-${index}`, { width: 0.36, height: 0.42 + index * 0.1, depth: 0.38 }, this.scene);
      building.position = new Vector3(point.x + (index ? 0.22 : -0.22), 0.24, point.z + 0.18);
      building.material = adobe;
      building.isPickable = false;
      const cap = MeshBuilder.CreateBox(`roof-${tile.col}-${tile.row}-${index}`, { width: 0.42, height: 0.07, depth: 0.44 }, this.scene);
      cap.position = new Vector3(building.position.x, building.position.y + 0.27, building.position.z);
      cap.material = roof;
      cap.isPickable = false;
    }
    const mast = MeshBuilder.CreateCylinder(`mast-${tile.col}-${tile.row}`, { height: 1.35, diameter: 0.05, tessellation: 4 }, this.scene);
    mast.position = new Vector3(point.x, 0.67, point.z - 0.22);
    mast.material = roof;
    mast.isPickable = false;
    if (tile.landmark === "destination") this.addSignalMarker(point);
  }

  private addSignalMarker(point: Vector3) {
    const plane = MeshBuilder.CreateDisc("watergate-signal", { radius: 0.34, tessellation: 6 }, this.scene);
    plane.rotation.x = Math.PI / 2;
    plane.position = new Vector3(point.x, 0.06, point.z);
    const marker = new StandardMaterial("watergate-signal-mat", this.scene);
    marker.diffuseColor = Color3.FromHexString("#2C7D88");
    marker.emissiveColor = Color3.FromHexString("#2C7D88");
    plane.material = marker;
    plane.isPickable = false;
    const antenna = MeshBuilder.CreateCylinder("watergate-antenna", { height: 0.92, diameter: 0.045, tessellation: 4 }, this.scene);
    antenna.position = new Vector3(point.x, 0.49, point.z);
    antenna.material = this.makeMaterial("watergate-antenna-mat", "#2C7D88");
    antenna.isPickable = false;
  }

  private addCache(tile: Tile) {
    const point = this.gridToWorld(tile);
    const crate = MeshBuilder.CreateBox(`cache-${tile.col}-${tile.row}`, { width: 0.42, height: 0.28, depth: 0.35 }, this.scene);
    crate.position = new Vector3(point.x, 0.12, point.z);
    crate.rotation.y = 0.3;
    crate.material = this.makeMaterial(`cache-mat-${tile.col}-${tile.row}`, "#684734");
    crate.isPickable = false;
  }

  private createRouteMarkers() {
    this.routeMarkers.splice(0).forEach((mesh) => mesh.dispose());
    const path = this.findPath(this.state.position, { col: 10, row: 1 });
    const markerMat = this.makeMaterial(`route-marker-${this.state.steps}`, "#A94636");
    markerMat.emissiveColor = Color3.FromHexString("#412018");
    path.slice(1).forEach((point, index) => {
      if (index % 2 !== 0) return;
      const world = this.gridToWorld(point);
      const marker = MeshBuilder.CreateDisc(`route-${index}`, { radius: 0.09, tessellation: 4 }, this.scene);
      marker.rotation.x = Math.PI / 2;
      marker.position = new Vector3(world.x, 0.01, world.z);
      marker.material = markerMat;
      marker.isPickable = false;
      this.routeMarkers.push(marker);
    });
    const current = this.gridToWorld(this.state.position);
    this.highlight.position = new Vector3(current.x, 0.015, current.z);
    this.highlight.setEnabled(true);
  }

  private moveConvoyTo(point: GridPoint) {
    const world = this.gridToWorld(point);
    this.convoy.position = new Vector3(world.x, 0.2, world.z);
  }

  private makeMaterial(name: string, color: string) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = Color3.Black();
    return material;
  }

  private gridToWorld(point: GridPoint) {
    return new Vector3((point.col - (MAP_WIDTH - 1) / 2) * TILE_SIZE, 0, (point.row - (MAP_HEIGHT - 1) / 2) * TILE_SIZE);
  }

  private snap(value: number) {
    return Math.round(value * 16) / 16;
  }

  private getTile(point: GridPoint) {
    return this.map[point.row]?.[point.col];
  }

  private isRaiderZone(point: GridPoint) {
    return (point.col === 7 && point.row === 5) || (point.col === 6 && point.row === 5);
  }

  private buildMap(): Tile[][] {
    const road = new Set(["1,8", "2,8", "3,7", "4,7", "5,6", "6,6", "7,5", "8,4", "9,3", "10,2", "10,1"]);
    const cliffs = new Set(["2,2", "2,3", "3,2", "8,7", "9,7", "9,8", "10,7", "1,5", "1,6"]);
    const ruins = new Set(["5,4", "6,4", "6,5", "7,4", "8,5"]);
    const rocks = new Set(["3,5", "4,5", "4,8", "5,8", "8,2", "9,2", "9,4", "3,3", "5,2"]);
    const landmarks: Record<string, Landmark> = { "1,8": "start", "10,1": "destination", "4,6": "oasis", "5,8": "cache" };

    return Array.from({ length: MAP_HEIGHT }, (_, row) =>
      Array.from({ length: MAP_WIDTH }, (_, col) => {
        const key = `${col},${row}`;
        const landmark = landmarks[key] ?? null;
        let kind: TerrainKind = "sand";
        if (cliffs.has(key)) kind = "cliff";
        else if (ruins.has(key)) kind = "ruin";
        else if (rocks.has(key)) kind = "rock";
        else if (road.has(key)) kind = landmark ? "settlement" : "road";
        else if (landmark === "oasis") kind = "oasis";
        return { col, row, kind, passable: kind !== "cliff", cost: kind === "road" ? 0.65 : kind === "rock" || kind === "ruin" ? 1.5 : 1, landmark };
      }),
    );
  }

  private findPath(start: GridPoint, goal: GridPoint): GridPoint[] {
    const key = (point: GridPoint) => `${point.col},${point.row}`;
    const open: GridPoint[] = [{ ...start }];
    const cameFrom = new Map<string, GridPoint>();
    const score = new Map<string, number>([[key(start), 0]]);
    const estimate = (point: GridPoint) => Math.abs(point.col - goal.col) + Math.abs(point.row - goal.row);

    while (open.length) {
      open.sort((a, b) => (score.get(key(a))! + estimate(a)) - (score.get(key(b))! + estimate(b)));
      const current = open.shift()!;
      if (current.col === goal.col && current.row === goal.row) {
        const path = [current];
        let cursor = current;
        while (cameFrom.has(key(cursor))) {
          cursor = cameFrom.get(key(cursor))!;
          path.unshift(cursor);
        }
        return path;
      }
      const neighbors = [
        { col: current.col + 1, row: current.row },
        { col: current.col - 1, row: current.row },
        { col: current.col, row: current.row + 1 },
        { col: current.col, row: current.row - 1 },
      ];
      neighbors.forEach((neighbor) => {
        const tile = this.getTile(neighbor);
        if (!tile?.passable) return;
        const nextScore = (score.get(key(current)) ?? Infinity) + tile.cost;
        if (nextScore < (score.get(key(neighbor)) ?? Infinity)) {
          cameFrom.set(key(neighbor), current);
          score.set(key(neighbor), nextScore);
          if (!open.some((point) => point.col === neighbor.col && point.row === neighbor.row)) open.push(neighbor);
        }
      });
    }
    return [start];
  }
}
