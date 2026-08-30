# Caravan — Design Directions

## Three possible approaches

### Salt-Scoured Field Manual

**Very Brief Intro:** A sun-bleached, utilitarian expedition interface built from battered paper panels, map marks, and hard-edged low-resolution 3D forms. It makes every mile feel accountable and every ration consequential.

**Probability:** 0.041

### Rust & Sundown

**Very Brief Intro:** A cinematic rust-red dusk caravan moving through monumental black silhouettes, with bold contrast and heat-haze drama. The world feels operatic and hostile rather than tactical.

**Probability:** 0.083

### Bone Relay

**Very Brief Intro:** A stark white-salt wasteland designed around skeletal vehicles and sparse signal towers, using clinical information overlays against an almost colorless landscape. It emphasizes isolation and technical survival.

**Probability:** 0.017

## Chosen Approach: Salt-Scoured Field Manual

**Design Movement:** Late-1990s console tactical-adventure design, filtered through a battered overland expedition dossier and the restrained material language of desert field maps.

**Core Principles:** First, gameplay information must resemble equipment rather than web interface chrome. Second, the desert is composed of faceted, readable masses rather than realism. Third, every visual treatment—lines, shadows, type, and motion—should suggest imperfect, mechanical low-resolution rendering. Fourth, danger is communicated with contrast and motion, never visual clutter.

**Color Philosophy:** The base world is a limited, sun-drained mineral palette: khaki sand, ochre rock, oxidized red metal, faded petrol blue, and soot black. Heat and scarcity are communicated through warm rust accents, while safety and water use the single cool petrol-blue counterpoint. Colors should be quantized and slightly dirty, rather than luminous or modern.

**Layout Paradigm:** The playfield owns the full screen as a wide, asymmetrical expedition table. Instrument panels latch onto the left and lower edges like physical field gear, while the minimap occupies a clipped circular corner at lower right. The player’s route runs diagonally through the isometric space, never centered as a sterile dashboard would be.

**Signature Elements:** A stitched route line with red survey ticks connects the settlements; black, offset-shadow HUD cards resemble taped-on map legends; and sparse cyan technical marks identify navigable water and destination signals.

**Interaction Philosophy:** Inputs should feel decisive and mechanical. Tile selection gains a hard geometric outline, travel previews make the route visibly tick forward, and danger pauses the journey with a sharp field-report panel. There are no soft, floating controls.

**Animation:** Movement advances in discrete but smooth 180–240 ms steps, accompanied by a small dust puff and a shifting convoy shadow. HUD values update through brief flicker/number rolls. Sand grain remains subtly alive, while sandstorms use low-frequency horizontal distortion and opacity—not excessive particle effects. All nonessential animation is disabled for reduced-motion preferences.

**Typography System:** Headlines use **Barlow Condensed** in heavy uppercase for the stamped, industrial expedition tone. HUD labels and numeric readouts use **IBM Plex Mono** for dependable field-instrument clarity. Body/event text uses medium-weight Barlow for legibility. Hierarchy is established through condensed scale and letter spacing instead of decorative font variety.

**Brand Essence:** A ruthless caravan-routing survival game for players who want every desert crossing to be a calculated gamble, not an idle journey. **Tactical, weathered, unsentimental.**

**Brand Voice:** Headlines are terse operational statements, CTAs are directive verbs, and microcopy reads like notes from a caravan dispatcher. Example lines: “**MAKE WATER BEFORE DUSK.**” and “**THE ROAD SAVES FUEL. THE RUINS MAY PAY.**” Generic welcome language is prohibited.

**Wordmark & Logo:** A condensed CARAVAN wordmark is split by a thin route line that breaks and rejoins through the letterforms. The accompanying mark is a black, forward-leaning four-wheel caravan silhouette pierced by a cyan compass needle—graphic, recognizable, and without text.

**Signature Brand Color:** **Signal Petrol — #2C7D88**, a weathered blue-green reserved for water, navigable objectives, and the route’s surviving promise.

## Style Decisions

- The opening view must show three irreducible field-manual signals: a diagonal stitched route with rust-red survey ticks, offset-shadow black instrument plates, and a Signal Petrol technical or water marker.
- The CARAVAN identity combines the condensed route-split wordmark with the compass-and-caravan emblem. Plain isolated brand text is not acceptable.
- Headlines, commands, and reports remain terse dispatcher orders in the spirit of “MAKE WATER BEFORE DUSK,” never generic interface or marketing language.
