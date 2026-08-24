# Neon Void

**Neon Void** is a fast-paced browser arena survival roguelite built for short, replayable runs. Auto-fire, dodge, dash through escalating enemy waves, collect XP, and shape a build from randomized mutations.

## Features
- Responsive canvas gameplay with desktop keyboard and mobile touch controls
- Auto-targeting combat, dash invulnerability, projectiles and hit feedback
- Chaser, runner, tank, shooter, swarm, elite and Void Warden encounters
- XP progression with randomized build-changing upgrades
- Wave scaling, score chasing and persistent high score
- Pause/restart/game-over flows
- SFX toggle and resilient local persistence
- Procedural neon visuals with particles, trails, glow and screen shake

## Controls
- **Desktop:** WASD / Arrow Keys to move, Shift to dash, P to pause
- **Mobile:** virtual joystick + Dash button

## Stack
Next.js, React, TypeScript, Canvas 2D. No server or database is required for gameplay.

## Development
```bash
npm install
npm run dev
```

## Verification
```bash
npm run typecheck
npm run build
```

## Project structure
- `app/page.tsx` — game loop, entities, combat, progression and UI overlays
- `app/globals.css` — responsive visual system and HUD/menu styling
- `app/layout.tsx` — metadata and application shell
