# Invaders-Breakout

A hybrid arcade game blending **Space Invaders** vertical shooter mechanics with **Breakout** brick-breaking gameplay.

## Core Concept
Defend your base by controlling a paddle that can also fire upward. Destroy waves of descending invaders while shattering colorful brick barriers that both obstruct your shots and provide power-ups when broken. Survive escalating difficulty as invaders speed up and barriers reform.

## How to Play
- **Mouse / Arrow Keys**: Move paddle left/right
- **Space / Click**: Fire projectiles upward
- **Objective**: Clear all bricks and invaders per level without letting invaders reach the bottom or your paddle.
- **Power-ups**: Break special bricks for multi-ball, wider paddle, laser, etc.

## Tech Stack
- Vanilla HTML5 Canvas + JavaScript (for maximum accessibility and easy Grok Build iteration)
- No external frameworks initially (add Phaser.js later if needed)
- Responsive design for desktop and mobile touch

## Development
Built iteratively with **Grok Build** CLI in the terminal.

### Local Setup
```bash
git clone https://github.com/Mr-JOlson/Invaders-Breakout.git
cd Invaders-Breakout
# Open index.html or run a local server
python3 -m http.server 8000
```

## Roadmap
- [ ] Core game loop (paddle, balls/projectiles, collisions)
- [ ] Invader AI and descent patterns
- [ ] Brick field with destructible blocks
- [ ] Levels, scoring, lives
- [ ] Sound effects and visuals
- [ ] High score persistence (localStorage)
- [ ] Deploy to GitHub Pages

## Built with Grok Build
This project demonstrates agentic development: planning, code generation, testing, and refinement directly in the repo.

---

*Original game concept. Feel free to fork and extend!*