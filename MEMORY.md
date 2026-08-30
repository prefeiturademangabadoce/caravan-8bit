# Caravan — Implementation Memory

## Decisions

- The playable build uses a full-screen Babylon canvas hosted by React and a DOM field-manual HUD, keeping simulation logic framework-independent.
- The prompt requested a wide game specification. The first production slice prioritizes the entire strategic journey loop—movement, resource pressure, trade, hazards, raider decisions, scoring, and restart—over a separate tactical-combat scene.
- The desert is deterministic with curated landmark placement, but each run produces lightly varied events through a stable seeded sequence. This keeps visual verification and `?demo` reliable.
- Generated visual assets are always referenced through their `/manus-storage/...` URLs and are never copied into the project tree.

## Known Implementation Checks

- Verify React strict-mode disposal before relying on hot reload during Babylon scene construction.
- Keep the 3D canvas effect separate from HTML HUD text for readability.
- Explicitly unregister keyboard and DOM overlay listeners inside the game-handle disposal path.
- Preserve `?demo` as a zero-input visual proof of actual travel and encounter state transitions.

## Visual Review Finding

The first preview showed only a desert-colored canvas rather than the expected world and HUD. The review reinforces the selected field-manual approach and specifically requires the diagonal route, hard dossier panels, Signal Petrol marker, and custom CARAVAN lockup to be unmistakable in the opening state. The next pass explicitly assigns an active camera and adds a visible startup diagnostic if game construction rejects.
