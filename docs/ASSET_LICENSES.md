# Asset credits

| Asset | Origin and use |
| --- | --- |
| Blue and Sand sprites and portraits | Original OpenAI ImageGen output commissioned for this project, in `assets/source/faction-art.png`. The Python/Pillow script `scripts/build-factions.py` refines the palette and uses one pose structure for both appearances. Shipped textures are in `public/assets/factions/`. |
| Dust Yard | Original projected masonry, timber, stone and baked shadows are authored in `scripts/draw-dust-yard.py`. The distant skyline uses a crop of the original OpenAI ImageGen concept in `assets/source/dust-yard-concept.png`. The cropped skyline is baked into the 480 × 270 ground plate. Five transparent scenery layers use the depth anchors in `public/assets/dust-yard/objects.json`. |
| Agent Arena mark | Original project artwork. |
| Barlow Condensed and Inter | SIL Open Font License. Served by Google Fonts with system fallbacks. |

The supplied images informed silhouette, material detail and lighting. Their pixels and layouts are absent from shipped textures. The game uses project-created asset output and ships no imported game pack or audio.

Rebuild from the repository root with Pillow installed using `python scripts/build-factions.py` and `python scripts/draw-dust-yard.py`. Both faction sheets are 256 × 256, with 16 frames of 64 × 64 and a common ground anchor at (32, 60). Frame ranges and timing are declared in `src/battlefield.tsx`. Environment textures render at the same 2× native pixel scale as the fighters before viewport fitting.
