# Invaders-Breakout

A hybrid arcade game blending **Space Invaders** vertical shooter mechanics with **Breakout** brick-breaking gameplay.

## Core Concept
Defend your base by controlling a paddle that can also fire upward. Destroy waves of descending invaders while shattering colorful brick barriers that both obstruct your shots and provide power-ups when broken. Survive escalating difficulty as invaders speed up and barriers reform.

## How to Play
- **Mouse / Arrow Keys** (or A/D): Move paddle left/right
- **Space / Click / Tap**: Launch **one** breakout ball — only when no balls are currently in play
- **Objective**: Clear invaders each level without letting them reach the bottom or hit your paddle with enemy fire
- **Ball physics**: Balls bounce off walls, paddle, and bricks; **balls destroy invaders** on contact
- **Specialty bricks** (`2×`, `3×`, `4×`): Multiply every breakout ball currently on screen (cap applies for performance)

## Tech Stack
- Vanilla HTML5 Canvas + JavaScript
- No external frameworks
- Responsive layout for desktop and mobile touch
- Web Audio API for sound (no asset files)
- High score saved in `localStorage`

## Play Online
Once GitHub Pages is enabled for this repo:  
**https://mr-jolson.github.io/Invaders-Breakout/**

## Local Setup
```bash
git clone https://github.com/Mr-JOlson/Invaders-Breakout.git
cd Invaders-Breakout
# Open index.html or run a local server
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project Structure
```
index.html      # Shell + HUD overlay
css/style.css   # Arcade UI
js/game.js      # Full game loop and systems
```

## Roadmap
- [x] Core game loop (paddle, balls/projectiles, collisions)
- [x] Invader AI and descent patterns
- [x] Brick field with destructible blocks
- [x] Levels, scoring, lives
- [x] Sound effects and visuals
- [x] High score persistence (localStorage)
- [x] Deploy-ready for GitHub Pages
- [ ] Optional: Phaser.js port / advanced particle VFX
- [ ] Optional: leaderboard beyond localStorage

## Built with Grok Build
This project demonstrates agentic development: planning, code generation, testing, and refinement directly in the repo.

---

*Original game concept. Feel free to fork and extend!*
