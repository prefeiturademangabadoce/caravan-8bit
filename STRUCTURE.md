# Caravan — Runtime Structure

## Ownership

`GameCanvas.tsx` owns only the engine lifecycle. `game/scene.ts` creates the Babylon scene, textures, orthographic camera, lighting, low-resolution presentation, and a `GameWorld`. The `GameWorld` owns the logical grid, state machine, caravan, route rules, random seed, event selection, and all scene meshes that represent the world. `HudController` owns DOM updates and delegates commands back to the world without owning rules.

```text
React GameCanvas
  └── createGameScene(engine, canvas)
        ├── Babylon Scene + OrthographicCamera + render treatment
        ├── GameWorld
        │     ├── Grid map / terrain and prop meshes
        │     ├── Caravan mesh group and resource state
        │     ├── Raider groups and encounter state
        │     └── InputManager / route preview / deterministic demo timer
        └── HudController
              ├── field-manual DOM overlay
              ├── resource, cargo, event and minimap rendering
              └── semantic command dispatch
```

## Modules

| Module | Responsibility | Does not own |
| --- | --- | --- |
| `game/assets.ts` | Centralized generated-asset URLs. | Resource rules or DOM. |
| `game/types.ts` | Grid, terrain, cargo, encounter, phase, and resource contracts. | Babylon meshes. |
| `game/InputManager.ts` | Semantic movement and action callbacks from keyboard/pointer. | Travel legality or UI. |
| `game/HudController.ts` | Field-report overlay markup and live status rendering. | Canonical gameplay state. |
| `game/GameWorld.ts` | Game model, procedural-feeling fixed map, state machine, meshes, update loop. | React lifecycle. |
| `game/scene.ts` | Scene composition, camera, lights, post-process, scene-level disposal. | Long-lived DOM UI logic. |

## Data Contracts

`Tile` stores `kind`, `cost`, `passable`, and optional `landmark`. `CaravanState` stores integer grid coordinates, fuel, water, food, parts, morale, health, day, cargo, and resolved events. `GamePhase` is one of `travel`, `encounter`, `arrived`, or `failed`. A `MoveResult` is emitted after each legal tile move and is the only way the HUD learns event text and state changes.

## Rendering Contract

The 3D world is generated from simple Babylon primitives and ground textures. Desert objects use flat shading, coarse geometry, short shadows, and limited materials. The camera is locked at a true orthographic, isometric-friendly angle. The 3D canvas may be posterized/dithered; DOM instrumentation is intentionally not filtered.

## Asset Hints

The sand diffuse texture repeats every 2m of ground. Rust texture repeats every 1m of vehicle surface. The emblem is used as a 48–72px DOM mark and an in-world objective disc. The report-card texture is a CSS background treatment for 16:9/field-report panels. No GLB imports are necessary; all 3D shapes are procedural primitives.

