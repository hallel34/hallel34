# EscapeMe — Handoff Brief (v6, 2026-11-12)

## What this is
A digital escape-room game for a bat-mitzvah (Hebrew, RTL). A creator ("במאי") builds a game: picks 5 of 11 puzzle types, fills content about the celebrant, places each stage in a room/object of a 3D house, shares by link. Players roam the house in first person, solve in-room puzzles + overlay mini-games, collect inventory items, and open a locked final target. Scoring, paid hints, answer-reveal, JSON export/import, and a full 2D fallback (when WebGL is blocked) are all implemented.

## Stack & layout
Vite + React + TypeScript + Three.js. `npm install`, `npm run dev`, `npm run build`; `vite.single.config.ts` produces the single-file build. Game types/config in `src/types.ts`; demo game content is fictional ("נועה (דוגמה)") — no real people's data anywhere.

## Product direction (owner's words, non-negotiable)
- The world must look like a REAL, lived-in family home in first person — reference: a gameplay video of free-roam through a photoreal house (living room with a full bookshelf wall, kitchen with openable pantry, doors that open, warm realistic light).
- Structure = "גורדי בהרפתקה מהסרטים" (Compedia, 1998): one overarching goal, clickable/collectible objects, puzzles BOTH embedded in rooms AND as mini-games — "גם וגם".
- Generic house (not a real home). Design quality is the TOP criterion; the owner has rejected v1–v5 rounds on visuals. Gameplay/scoring/creator flow are considered good — do not redesign them.

## Current state (v6)
House: entrance, living room, kitchen+dining, hallway, 2 kids/parents bedrooms, bathroom. 8 Poly Haven CC0 hero models + Kenney CC0 + procedural furniture; bookshelf wall of instanced books; fridge collage; architecture trim (baseboards, architraves, beams). Verified in a headless sandbox via Playwright: full demo playthrough 10/10, 0 console errors, 2D fallback OK. Credits in CREDITS.md (in the v6 package).

## ⚠️ Why the owner is handing this over — REAL-DEVICE failures (2026-11-12)
The owner played v6 on his Android phone and rejected it ("על הפנים"). His screenshots show problems the sandbox playthrough did NOT catch:
1. **Entrance:** the camera ends up INSIDE a giant white bathtub-like object — near-plane/collision failure; half the screen is the inside of one mesh, with stretched gold/pink geometry below. Player spawn/positioning and camera collision are broken on the real device.
2. **Hallway:** the view is swallowed by one huge photographic backdrop texture (vintage film-set photo), with a big flat 2D cartoon tree graphic pasted over it — does not read as a hallway at all. Texture scale/assignment and the flat stage graphics inside the 3D world look wrong.
3. Overall: on the phone it still reads as flat/stylized, far from the realistic reference — and the app renders in a narrow phone column.

## First jobs for whoever continues
- Reproduce on a real phone viewport (touch joystick path, not just desktop WASD + scripted Playwright): fix spawn points, camera collision/clipping, and per-room texture scales.
- Raise house modeling realism toward the reference video (hero rooms: living room bookshelf wall, kitchen).
- Keep: all 11 mini-games, creator flow, scoring/hints, 2D fallback, Hebrew RTL.

---

## v7 update (2026-11-12) — real-device failures diagnosed and fixed

**Root causes found (v6 passed its sandbox test only because the test teleported):**
- The living-room TV zone was sealed by sofa + armchair + bookshelf, the fridge by the dining set, and the bathtub sat directly behind the bathroom door. Collision had a "stuck => free movement" rule, so on a phone the player squeezed through furniture and ended up inside meshes (the "inside a white bathtub" screenshot).
- The house rendered in a small card inside the 480px `.app-shell` column with a fixed 68° vertical FOV: in portrait that is ~35° horizontal, so any object filled the view (the hallway picture, a 1 m film-set still, swallowed the screen; the stage emoji sprite floated over it).
- Touch: the joystick finger also drove camera look (shared pointer state).

**What changed**
- Layout made walkable; `window.__escapeHouse.unreachable()` flood-fills the floor from spawn and must return `[]` (run it after any furniture change). Overlaps are pushed out, never walked through.
- House is full-screen (`position: fixed`), HUD overlays (goal, room, chips, inventory, exit) live inside `House3D`; FOV adapts to aspect; landscape supported; `House3D` got optional `inventory` / `onExit` props.
- Look-drag bound to one pointer id; adaptive pixel ratio when fps < 26; no `backdrop-filter` over the canvas.
- Stage/pickup markers are small sparkles on the object (no emoji billboards / sign boards). Film-set stills removed from the house; hallway "family picture" is the family-at-sunset photo in a matted frame.
- Realism: 13 more Poly Haven CC0 models (TV cabinet, plants, drawers, desk, side table, shelves, mirror, clock, pillows, framed painting, desk lamp), procedural flat TV, daylight windows, shadow light follows the player's room.

**Verified (Playwright, emulated Pixel 7 touch + landscape, software GL):** unreachable `[]`, joystick + second-finger look, pickup -> inventory, locked final target, in-room riddle, overlay stage opens, 2D fallback, 0 console errors. **NOT verified on a physical phone** — frame rate on real GPUs is unmeasured.

**Still stylized / next steps toward the reference video**
- Kenney low-poly pieces remain: kitchen cabinets, fridge, stove, wardrobes, beds, bathroom fixtures, doors, bookshelf units. Replace or rebuild procedurally with PBR materials (kitchen first).
- Lighting is unbaked: 7 point lights + 1 shadow spot. Baked lightmaps / AO would be the biggest remaining realism win.
- Windows are textured planes (no real openings / sun shafts). Hallway is only 1.6 m wide.
- Mini-games, creator flow, scoring were not touched.
