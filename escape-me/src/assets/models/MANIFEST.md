# EscapeMe v5 — 3D Assets Manifest

Generated 2026-11-11 by the assets subagent. **No app source code was modified** — files only staged here.

## Models — Kenney Furniture Kit (CC0)

- **Pack:** Kenney Furniture Kit v1.0/2.0 (140 assets), by Kenney (kenney.nl)
- **License: CC0 1.0** — https://creativecommons.org/publicdomain/zero/1.0/ — free for personal/commercial use, attribution NOT required (credit appreciated). Full license text copied to `KENNEY-LICENSE.txt` in this folder (from the zip's License.txt).
- **Source page:** https://kenney.nl/assets/furniture-kit
- **How obtained:** the zip URL is not in the static HTML. The page's `initiateDownload()` JS fetches a signed link from `https://kenney.nl/download-link/<hex('assets/furniture-kit')>`; that endpoint was called with a browser UA + same-origin referer and returned a signed `kenney.nl/download/...` URL, from which `kenney_furniture-kit.zip` (4.9 MB) was downloaded directly from kenney.nl. No mirror needed — this is the official source.
- **Format:** GLB (binary glTF 2.0), extracted from the zip's `Models/GLTF format/` folder and renamed to kebab-case. Original Kenney filename kept in the table for traceability.
- **Validation:** every GLB below was parsed headlessly (GLB header + JSON chunk): magic/version OK, meshes/nodes listed, triangle counts from index accessors, bounding boxes from POSITION accessor min/max. **53/53 valid.** Max 830 tris per model (limit was 30k). No embedded image textures (images: 0 in all) — shading is flat materials/palette colors.
- **Style warning (important):** Kenney is *stylized low-poly, flat-shaded* — clean and game-ready, but NOT photorealistic/PBR. If v5 needs a realistic look, these work best with good lighting/shadows, or as placeholders for procedural PBR models.
- **Scale warning (important):** Kenney uses stylized, inconsistent proportions on a grid — NOT uniform real-world scale. Beds are near real footprint (~1.6 x 1.9), while seating/doors are ~half height (door ~1.01 units tall, chair ~0.47). Per-file bbox (file units, X x Y x Z, Y-up) is in the table — **normalize scale per category when placing** (e.g. door x~2.0, chairs/sofa x~1.8-1.9, kitchen units x~1.9 to reach ~0.9m counters).
- **Count/size:** 53 GLB files, total 826 KB (~0.81 MB) — well under the 25 MB budget. Total triangles across all files: ~11,772 (if every piece placed once).
- **Not in Kenney kit:** no picture frame, no dedicated wardrobe (see wardrobe.glb note). The full 140-model zip also contains variants not staged (extra chairs/sofas/tables, kitchen corners, stairs, walls, toiletSquare, showerRound, etc.) — re-extract from the official zip if more variants are needed.

| File | What it is | Kenney original | Nodes | Meshes | Tris | BBox (units) | Size | Notes |
|---|---|---|---|---|---|---|---|---|
| `armchair.glb` | Armchair / lounge chair | `loungeChair.glb` | loungeChair(Clone) | Mesh loungeChair | 128 | 0.49 x 0.46 x 0.41 | 9 KB |  |
| `bathroom-cabinet.glb` | Bathroom cabinet | `bathroomCabinet.glb` | bathroomCabinet(Clone), door | Mesh bathroomCabinet, Mesh door | 64 | 0.43 x 0.39 x 0.22 | 7 KB | Node 'door' separate. |
| `bathroom-mirror.glb` | Bathroom mirror | `bathroomMirror.glb` | bathroomMirror(Clone) | Mesh bathroomMirror | 72 | 0.30 x 0.43 x 0.14 | 6 KB |  |
| `bathroom-sink.glb` | Bathroom sink / vanity sink | `bathroomSink.glb` | bathroomSink(Clone) | Mesh bathroomSink | 316 | 0.34 x 0.56 x 0.29 | 22 KB |  |
| `bathtub.glb` | Bathtub | `bathtub.glb` | bathtub(Clone) | Mesh bathtub | 602 | 1.19 x 0.42 x 0.56 | 34 KB |  |
| `bed-bunk.glb` | Bed — bunk bed with covers + pillows | `bedBunk.glb` | bedBunk(Clone), coverBottom, coverTop, pillowBottom, pillowTop | Mesh bedBunk, Mesh cover, Mesh cover, Mesh pillowLeft, Mesh pillowLeft | 580 | 1.62 x 0.98 x 1.89 | 39 KB | Great for kids' room. Nodes: coverBottom/coverTop/pillowBottom/pillowTop. |
| `bed-double.glb` | Bed — double, with cover + 2 pillows | `bedDouble.glb` | bedDouble(Clone), cover, pillowLeft, pillowRight | Mesh bedDouble, Mesh cover, Mesh pillowLeft, Mesh pillowLeft | 264 | 1.62 x 0.51 x 1.91 | 22 KB | Nodes: cover, pillowLeft, pillowRight. |
| `bed-single.glb` | Bed — single, with cover + pillow | `bedSingle.glb` | bedSingle(Clone), cover, pillow | Mesh bedSingle, Mesh cover, Mesh pillowLeft | 214 | 1.62 x 0.51 x 1.89 | 18 KB | Nodes: cover, pillow separate meshes. Footprint ~1.62 x 1.89 file units is near real scale. |
| `bookshelf-low.glb` | Bookshelf — low open bookcase | `bookcaseOpenLow.glb` | bookcaseOpenLow(Clone) | Mesh bookcaseOpenLow | 184 | 0.40 x 0.40 x 0.25 | 11 KB |  |
| `bookshelf.glb` | Bookshelf — open bookcase | `bookcaseOpen.glb` | bookcaseOpen(Clone) | Mesh bookcaseOpen | 320 | 0.40 x 0.88 x 0.25 | 17 KB | Empty shelves; add books/props procedurally if wanted. |
| `ceiling-lamp.glb` | Ceiling lamp (square) | `lampSquareCeiling.glb` | lampSquareCeiling(Clone) | Mesh lampSquareCeiling | 60 | 0.12 x 0.23 x 0.12 | 5 KB |  |
| `chair-cushion.glb` | Chair with cushion | `chairCushion.glb` | chairCushion(Clone) | Mesh chairCushion | 198 | 0.20 x 0.46 x 0.20 | 12 KB |  |
| `chair-desk.glb` | Desk/office chair | `chairDesk.glb` | chairDesk(Clone), chair | Mesh chairDesk, Mesh chair | 588 | 0.48 x 0.42 x 0.44 | 38 KB |  |
| `chair-dining.glb` | Dining chair (wooden) | `chair.glb` | chair(Clone) | Mesh chair | 170 | 0.20 x 0.47 x 0.20 | 10 KB | File height ~0.47 units — Kenney kit is ~half-scale for seating; scale ~1.9x to reach ~0.9m. |
| `coat-rack.glb` | Standing coat rack | `coatRackStanding.glb` | coatRackStanding(Clone) | Mesh coatRackStanding | 190 | 0.27 x 0.77 x 0.27 | 12 KB | Entryway piece. |
| `coffee-table.glb` | Coffee table | `tableCoffee.glb` | tableCoffee(Clone) | Mesh tableCoffee | 124 | 0.66 x 0.23 x 0.40 | 8 KB |  |
| `computer-screen.glb` | Computer monitor (desk prop) | `computerScreen.glb` | computerScreen(Clone) | Mesh computerScreen | 72 | 0.39 x 0.29 x 0.10 | 6 KB |  |
| `desk.glb` | Desk with drawer | `desk.glb` | desk(Clone), drawer | Mesh desk, Mesh drawer | 198 | 0.73 x 0.38 x 0.56 | 14 KB | Node 'drawer' separate. |
| `dining-table.glb` | Dining table | `table.glb` | table(Clone) | Mesh table | 120 | 0.84 x 0.33 x 0.45 | 8 KB | Pair with chair-dining.glb x4-6. |
| `door-open.glb` | Open doorway (frame only, no panel) | `doorwayOpen.glb` | doorwayOpen(Clone) | Mesh doorwayOpen | 28 | 0.49 x 1.01 x 0.09 | 3 KB | Use for permanently-open passages. |
| `door.glb` | Interior door — doorway frame + door panel | `doorway.glb` | doorway(Clone), door | Mesh doorway, Mesh door | 188 | 0.49 x 1.01 x 0.15 | 14 KB | Nodes: doorway frame + 'door' panel separate — door can be rotated open in code. File height ~1.01 units (~half real) — scale ~2x for a 2m door, and scale the room/other furniture consistently. |
| `dresser.glb` | Dresser — side table with 2 drawers | `sideTableDrawers.glb` | sideTableDrawers(Clone), drawerLeft, drawerRight | Mesh sideTableDrawers, Mesh drawer, Mesh drawer | 238 | 0.53 x 0.38 x 0.39 | 18 KB | Nodes: drawerLeft/drawerRight separate. |
| `dryer.glb` | Tumble dryer | `dryer.glb` | dryer(Clone), dryerDoor | Mesh dryer, Mesh dryerDoor | 262 | 0.39 x 0.60 x 0.38 | 17 KB | Node 'dryerDoor' separate. |
| `floor-lamp.glb` | Floor lamp (square shade) | `lampSquareFloor.glb` | lampSquareFloor(Clone) | Mesh lampSquareFloor | 60 | 0.12 x 0.86 x 0.12 | 5 KB | Add a PointLight in code at shade height if lit effect wanted. |
| `fridge-large.glb` | Fridge — large double-door | `kitchenFridgeLarge.glb` | kitchenFridgeLarge(Clone), doorLeft, doorRight | Mesh kitchenFridgeLarge, Mesh doorLeft, Mesh doorRight | 436 | 0.79 x 1.32 x 0.39 | 29 KB | Nodes doorLeft/doorRight separate. |
| `fridge.glb` | Fridge — top-freezer fridge | `kitchenFridge.glb` | kitchenFridge(Clone), doorFreezer, doorFridge | Mesh kitchenFridge, Mesh doorFreezer, Mesh doorFridge | 250 | 0.43 x 0.92 x 0.32 | 19 KB | Nodes doorFreezer/doorFridge separate — openable in code. |
| `kitchen-cabinet-drawer.glb` | Kitchen base cabinet with drawer + door | `kitchenCabinetDrawer.glb` | kitchenCabinetDrawer(Clone), door, drawer | Mesh kitchenCabinetDrawer, Mesh door, Mesh drawer | 174 | 0.43 x 0.45 x 0.48 | 15 KB | Nodes: door, drawer are separate. |
| `kitchen-cabinet-upper.glb` | Kitchen wall/upper cabinet | `kitchenCabinetUpper.glb` | kitchenCabinetUpper(Clone), door | Mesh kitchenCabinetUpper, Mesh door | 80 | 0.43 x 0.39 x 0.23 | 7 KB | Mount at height; door is separate node. |
| `kitchen-cabinet.glb` | Kitchen base cabinet with door | `kitchenCabinet.glb` | kitchenCabinet(Clone), door | Mesh kitchenCabinet, Mesh door | 114 | 0.43 x 0.45 x 0.48 | 10 KB | Modular: tile multiple units along a wall. Door is separate node 'door'. |
| `kitchen-counter.glb` | Kitchen counter / bar unit | `kitchenBar.glb` | kitchenBar(Clone) | Mesh kitchenBar | 76 | 0.43 x 0.42 x 0.21 | 5 KB |  |
| `kitchen-sink.glb` | Kitchen sink cabinet unit | `kitchenSink.glb` | kitchenSink(Clone), door | Mesh kitchenSink, Mesh door | 318 | 0.43 x 0.49 x 0.48 | 22 KB | 6 materials incl. metal faucet parts. |
| `microwave.glb` | Microwave | `kitchenMicrowave.glb` | kitchenMicrowave(Clone), Group | Mesh kitchenMicrowave, Mesh Group 389 | 152 | 0.29 x 0.18 x 0.23 | 10 KB | Countertop prop. |
| `nightstand.glb` | Nightstand / bedside cabinet with drawer | `cabinetBedDrawer.glb` | cabinetBedDrawer(Clone), door, drawer | Mesh cabinetBedDrawer, Mesh door, Mesh drawer | 182 | 0.27 x 0.26 x 0.38 | 15 KB | Nodes: door, drawer separate. |
| `plant-small.glb` | Small plant | `plantSmall1.glb` | plantSmall1(Clone) | Mesh plantSmall1 | 102 | 0.19 x 0.28 x 0.19 | 8 KB |  |
| `plant.glb` | Potted plant | `pottedPlant.glb` | pottedPlant(Clone), plant | Mesh pottedPlant, Mesh plant | 60 | 0.25 x 0.54 x 0.29 | 7 KB | Nodes: pot + plant separate. |
| `range-hood.glb` | Range hood (modern) | `hoodModern.glb` | hoodModern(Clone) | Mesh hoodModern | 28 | 0.43 x 0.40 x 0.28 | 3 KB | Mount above stove. |
| `rug-round.glb` | Round rug (mesh) | `rugRound.glb` | rugRound(Clone) | Mesh rugRound | 188 | 0.92 x 0.01 x 0.92 | 9 KB | Flat mesh rug; project also has tex-rug.jpg texture rug. |
| `shower.glb` | Shower stall with 2 doors | `shower.glb` | shower(Clone), doorLeft, doorRight | Mesh shower, Mesh doorLeft, Mesh doorRight | 810 | 1.30 x 2.49 x 1.28 | 50 KB | Largest piece (810 tris). Nodes doorLeft/doorRight. Bbox height 2.49 units is OVER real scale vs other pieces — normalize scale when placing. |
| `side-table.glb` | Side table | `sideTable.glb` | sideTable(Clone) | Mesh sideTable | 118 | 0.53 x 0.38 x 0.22 | 8 KB |  |
| `sofa-design.glb` | Sofa — design/modern sofa variant | `loungeDesignSofa.glb` | loungeDesignSofa(Clone) | Mesh loungeDesignSofa | 116 | 1.12 x 0.40 x 0.41 | 8 KB | Alternate sofa style. |
| `sofa-long.glb` | Sofa — long sofa | `loungeSofaLong.glb` | loungeSofaLong(Clone) | Mesh loungeSofaLong | 186 | 0.98 x 0.46 x 0.82 | 12 KB |  |
| `sofa.glb` | Sofa — 2-seat lounge sofa | `loungeSofa.glb` | loungeSofa(Clone) | Mesh loungeSofa | 128 | 0.98 x 0.46 x 0.41 | 9 KB | Stylized proportions: ~0.98m wide in file units; scale up ~1.8-2x for real-world. |
| `stool-bar.glb` | Bar stool | `stoolBar.glb` | stoolBar(Clone) | Mesh stoolBar | 176 | 0.27 x 0.43 x 0.23 | 11 KB | Pairs with kitchen-counter.glb. |
| `stove-electric.glb` | Electric stove / cooktop unit | `kitchenStoveElectric.glb` | kitchenStoveElectric(Clone) | Mesh kitchenStoveElectric | 338 | 0.43 x 0.45 x 0.45 | 18 KB |  |
| `stove.glb` | Stove/oven — gas stove with oven door | `kitchenStove.glb` | kitchenStove(Clone), door | Mesh kitchenStove, Mesh door | 830 | 0.43 x 0.45 x 0.48 | 53 KB | Node 'door' = oven door, separate. |
| `table-lamp.glb` | Table lamp (round shade) | `lampRoundTable.glb` | lampRoundTable(Clone) | Mesh lampRoundTable | 76 | 0.15 x 0.31 x 0.18 | 6 KB |  |
| `table-round.glb` | Round table | `tableRound.glb` | tableRound(Clone) | Mesh tableRound | 80 | 0.69 x 0.37 x 0.80 | 6 KB |  |
| `toilet.glb` | Toilet with cover | `toilet.glb` | toilet(Clone), cover | Mesh toilet, Mesh cover | 230 | 1.00 x 0.95 x 0.79 | 17 KB | Node 'cover' separate. |
| `tv-stand.glb` | TV stand / television cabinet | `cabinetTelevision.glb` | cabinetTelevision(Clone) | Mesh cabinetTelevision | 154 | 0.80 x 0.31 x 0.25 | 10 KB |  |
| `tv.glb` | TV — modern flat-screen | `televisionModern.glb` | televisionModern(Clone) | Mesh televisionModern | 72 | 0.68 x 0.45 x 0.13 | 6 KB | Screen is a separate material; can be emissive/replaced in code. |
| `wall-lamp.glb` | Wall lamp / sconce | `lampWall.glb` | lampWall(Clone) | Mesh lampWall | 42 | 0.39 x 0.16 x 0.26 | 4 KB |  |
| `wardrobe.glb` | Wardrobe — closed cabinet with 2 doors (Kenney bookcaseClosedDoors repurposed as wardrobe) | `bookcaseClosedDoors.glb` | bookcaseClosedDoors(Clone), doorLeft, doorRight | Mesh bookcaseClosedDoors, Mesh doorLeft, Mesh doorRight | 296 | 0.56 x 0.85 x 0.27 | 22 KB | Kenney kit has NO dedicated wardrobe; this closed-door cabinet is the closest piece and reads as a wardrobe in a room. Nodes doorLeft/doorRight separate — openable. |
| `washing-machine.glb` | Washing machine | `washer.glb` | washer(Clone), washerDoor | Mesh washer, Mesh washerDoor | 720 | 0.39 x 0.50 x 0.48 | 46 KB | Node 'washerDoor' separate. |

## Textures — ambientCG (CC0)

Staged into `~/workspace/escape-me/src/assets/` (NOT in models/). Color maps only, 1024x1024 JPG, from the official 1K-JPG packs. License for all ambientCG assets: **CC0 1.0** (https://ambientcg.com — 'all assets are CC0').

| File | What it is | ambientCG asset | Source URL | Size |
|---|---|---|---|---|
| `tex-marble-counter.jpg` | Marble countertop color map | Marble012 (1K-JPG) | https://ambientcg.com/view?id=Marble012 — file: https://ambientcg.com/get?file=Marble012_1K-JPG.zip | 1.2 MB |
| `tex-kitchen-tile.jpg` | Kitchen wall/floor tile color map | Tiles141 (1K-JPG) | https://ambientcg.com/view?id=Tiles141 — file: https://ambientcg.com/get?file=Tiles141_1K-JPG.zip | 1.1 MB |
| `tex-bathroom-tile.jpg` | Bathroom tile color map | Tiles139 (1K-JPG) | https://ambientcg.com/view?id=Tiles139 — file: https://ambientcg.com/get?file=Tiles139_1K-JPG.zip | 1.1 MB |

Notes: only the `_Color.jpg` map was extracted from each pack; the packs also contain Normal/Roughness/Displacement maps if PBR is wanted later (re-download from the same get?file= URL). Existing project textures (tex-wood-floor, tex-wall, tex-rug, tex-door, tex-desk/desk-wood, tex-cork) were left untouched.

## Coverage vs. requested list

Requested → staged: sofa ✓ (x3 variants), armchair ✓, coffee table ✓, dining table ✓ + dining chairs ✓, bookshelf ✓ (x2), TV ✓ + TV stand ✓, kitchen cabinets/counter ✓ (base, drawer, upper, counter/bar, sink unit), fridge ✓ (x2), oven/stove ✓ (gas + electric), bed single ✓, bed double ✓ (+ bunk bonus), wardrobe ✓ (repurposed closed-door cabinet — see note), desk ✓ + desk chair ✓, nightstand ✓, dresser ✓, bathroom sink ✓ + bathroom cabinet ✓ (+ mirror), bathtub ✓, washing machine ✓ (+ dryer), interior door ✓ (frame + separate door panel, plus open doorway), plant ✓ (x2), floor lamp ✓ + ceiling lamp ✓ (+ table/wall lamps), rug ✓ (mesh + existing texture). Picture frame ✗ — not in Kenney kit; procedural (box + existing frame-*.jpg photos) recommended. Bonuses: toilet, shower, microwave, range hood, bar stool, coat rack, computer screen, side table, round table.
