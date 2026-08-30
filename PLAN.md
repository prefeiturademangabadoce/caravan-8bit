# Game Plan: Caravan

## First Playable Scope

The first playable build is a complete overland run through a fixed, deterministic desert map. The player must carry a starting cargo from Dusthook (Point A) to Watergate (Point B), balancing water, fuel, morale, cargo value, rough terrain, and raider pressure. The game includes a focused event-resolution loop instead of a separate tactical-combat scene: raiders can be fought, fled, or bribed, with distinct resource consequences.

## Risk Tasks

### 1. Isometric route grid and tile travel

- **Why isolated:** The visible route, orthographic camera, pointer selection, terrain cost, and world-state grid must agree; a mismatch makes the basic traversal loop unreadable.
- **Approach:** Build a fixed seeded grid with tile metadata and a deterministic breadth-first route preview. Travel occurs one logical grid step at a time through semantic move actions, while world meshes are arranged on the corresponding X/Z grid beneath an orthographic isometric camera.
- **Verify:** Arrow/WASD input and clicking an adjacent highlighted tile advance the convoy exactly one legal tile; the selected route, resource change, convoy position, and minimap dot agree after each move.

### 2. PS1-style low-resolution rendering treatment

- **Why isolated:** Post-processing and low-res canvas scaling can obscure HUD or create an unreadable playfield if applied indiscriminately.
- **Approach:** Render the 3D scene at a deliberately reduced hardware-scaled resolution, use flat/vertex lighting with a restrained palette, then apply a simple posterization and ordered-dither post-process only to the Babylon canvas. The DOM HUD stays sharp and remains outside the canvas effect.
- **Verify:** Terrain, convoy, rock forms, and raider silhouettes read as faceted blocks; the playfield visibly has quantized/dithered colors while resource panels stay crisp and readable at desktop and mobile widths.

### 3. Encounter state handoff

- **Why isolated:** Raider proximity must transition cleanly from travel to a decision state and back without duplicate moves, stale UI, or lost resource updates.
- **Approach:** Model travel and encounter as explicit game phases. The world determines an encounter only after a completed move; the HUD presents Fight, Flee, and Pay Tribute actions; resolving one applies a deterministic seeded outcome and returns to travel or run-ended state.
- **Verify:** Moving into raider threat visibly opens an encounter report; each option changes the expected health/resources/cargo/morale once, closes the decision state, and re-enables travel without a second unintended resolution.

## Main Build

Build the full-screen playfield with isometric terrain tiles, road, cliffs, ruins, oasis, Point A/B settlement anchors, a three-part caravan, ambient raider patrols, low-poly props, fogged undiscovered map edges, and a logical distance-to-destination route. Add a field-manual DOM HUD with resources, cargo, convoy status, current day/weather/location, event log, action tray, legend, and minimap. Add restart and deterministic `?demo` autoplay behavior.

- **Assets:**
  - Sand diffuse texture — repeated across 2m terrain tiles.
  - Rust metal texture — used on caravan vehicle panels.
  - Signal emblem — header, objective marker, and document favicon.
  - Field-report card texture — subtle status/encounter panel treatment.
  - Visual target — retained as the art-direction benchmark.
- **Verify:**
  - Keyboard, pointer, touch-compatible controls, and action buttons advance visible game state.
  - Resource bars and cargo value respond to travel, weather, trade, and encounters.
  - Point B ends the run with a delivery readout based on delivered cargo value and survivors.
  - No missing generated textures or obvious fallback materials.
  - HUD remains legible without overflow or overlap at desktop and mobile widths.
  - No browser-console errors during a manual run and deterministic `?demo` capture.
  - Screenshot consistency: 45-degree isometric view, mineral palette, faceted visual density, expedition field-manual interface.

