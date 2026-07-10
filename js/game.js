/**
 * Invaders-Breakout
 * Hybrid arcade: Space Invaders descent + Breakout bricks + paddle lasers
 */
(() => {
  "use strict";

  // ─── Canvas / DOM ───────────────────────────────────────────
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  const elScore = document.getElementById("score");
  const elHigh = document.getElementById("high-score");
  const elLevel = document.getElementById("level");
  const elLives = document.getElementById("lives");
  const overlay = document.getElementById("overlay");
  const panelTitle = document.getElementById("panel-title");
  const panelMessage = document.getElementById("panel-message");
  const startBtn = document.getElementById("start-btn");
  const muteBtn = document.getElementById("mute-btn");

  const HIGH_KEY = "invaders-breakout-high";
  const MUTE_KEY = "invaders-breakout-mute";

  // ─── Constants ──────────────────────────────────────────────
  const PADDLE_Y = H - 48;
  const PADDLE_H = 12;
  const PADDLE_BASE_W = 72;
  const LASER_SPEED = 520;
  const LASER_COOLDOWN = 0.22;
  const BALL_SPEED = 280;
  const INVADER_COLS = 8;
  const INVADER_ROWS = 4;
  const BRICK_ROWS = 4;
  const BRICK_COLS = 10;
  const MAX_LIVES = 3;

  const BRICK_COLORS = ["#fc8181", "#f6ad55", "#f6e05e", "#68d391", "#63b3ed", "#b794f4"];
  const POWER_TYPES = ["multi", "wide", "laser", "life"];

  // ─── Audio (Web Audio API, no assets) ───────────────────────
  let audioCtx = null;
  let muted = localStorage.getItem(MUTE_KEY) === "1";

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  function beep(freq, dur, type = "square", gain = 0.04) {
    if (muted || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  const sfx = {
    shoot: () => beep(880, 0.06, "square", 0.03),
    brick: () => beep(320, 0.08, "triangle", 0.05),
    invader: () => {
      beep(180, 0.1, "sawtooth", 0.04);
      setTimeout(() => beep(120, 0.12, "sawtooth", 0.03), 40);
    },
    power: () => {
      beep(523, 0.08, "sine", 0.05);
      setTimeout(() => beep(784, 0.1, "sine", 0.05), 70);
    },
    hit: () => beep(90, 0.25, "sawtooth", 0.06),
    level: () => {
      [392, 494, 587, 784].forEach((f, i) => setTimeout(() => beep(f, 0.12, "square", 0.04), i * 90));
    },
    gameOver: () => {
      [330, 262, 196, 131].forEach((f, i) => setTimeout(() => beep(f, 0.2, "triangle", 0.05), i * 140));
    },
  };

  // ─── Input ──────────────────────────────────────────────────
  const keys = new Set();
  let pointerX = null;
  let pointerDown = false;
  let fireHeld = false;

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "ArrowRight", " ", "Spacebar"].includes(e.key)) e.preventDefault();
    keys.add(e.key);
    if (e.key === " " || e.key === "Spacebar") fireHeld = true;
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.key);
    if (e.key === " " || e.key === "Spacebar") fireHeld = false;
  });

  function canvasPoint(clientX) {
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * W;
  }

  canvas.addEventListener("mousemove", (e) => {
    pointerX = canvasPoint(e.clientX);
  });
  canvas.addEventListener("mousedown", (e) => {
    pointerDown = true;
    fireHeld = true;
    pointerX = canvasPoint(e.clientX);
    ensureAudio();
  });
  window.addEventListener("mouseup", () => {
    pointerDown = false;
    if (![...keys].some((k) => k === " " || k === "Spacebar")) fireHeld = false;
  });

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      pointerX = canvasPoint(t.clientX);
      pointerDown = true;
      fireHeld = true;
      ensureAudio();
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      pointerX = canvasPoint(t.clientX);
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      pointerDown = false;
      fireHeld = false;
    },
    { passive: false }
  );

  // ─── Game state ─────────────────────────────────────────────
  let state = "menu"; // menu | playing | paused | levelup | gameover
  let score = 0;
  let highScore = Number(localStorage.getItem(HIGH_KEY) || 0);
  let level = 1;
  let lives = MAX_LIVES;
  let lastTime = 0;
  let shake = 0;
  let laserCooldown = 0;
  let wideTimer = 0;
  let rapidTimer = 0;
  let stars = [];
  let particles = [];
  let floatingTexts = [];

  let paddle = { x: W / 2, w: PADDLE_BASE_W, h: PADDLE_H };
  let lasers = [];
  let balls = [];
  let invaders = [];
  let invaderDir = 1;
  let invaderSpeed = 28;
  let invaderDrop = 18;
  let invaderShootTimer = 0;
  let enemyShots = [];
  let bricks = [];
  let powerups = [];

  // ─── Helpers ────────────────────────────────────────────────
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function updateHud() {
    elScore.textContent = String(score);
    elHigh.textContent = String(highScore);
    elLevel.textContent = String(level);
    elLives.textContent = "❤".repeat(Math.max(0, lives)) || "—";
  }

  function setHigh(s) {
    if (s > highScore) {
      highScore = s;
      localStorage.setItem(HIGH_KEY, String(highScore));
    }
    updateHud();
  }

  function showOverlay(title, message, btnLabel = "Play Again") {
    panelTitle.textContent = title;
    panelMessage.textContent = message;
    startBtn.textContent = btnLabel;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function spawnStars() {
    stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      s: rand(0.4, 1.6),
      sp: rand(8, 28),
      a: rand(0.3, 0.9),
    }));
  }

  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = rand(40, 180);
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: rand(0.3, 0.7),
        max: 0.7,
        color,
        r: rand(1.5, 3.2),
      });
    }
  }

  function floatText(x, y, text, color = "#f6e05e") {
    floatingTexts.push({ x, y, text, color, life: 0.9, vy: -40 });
  }

  // ─── Level builders ─────────────────────────────────────────
  function buildBricks() {
    bricks = [];
    const marginX = 20;
    const top = 200;
    const gap = 3;
    const bw = (W - marginX * 2 - gap * (BRICK_COLS - 1)) / BRICK_COLS;
    const bh = 16;
    const rows = Math.min(BRICK_ROWS + Math.floor((level - 1) / 2), 6);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        // occasional gaps for shot lanes
        if (level > 1 && Math.random() < 0.08) continue;
        const isSpecial = Math.random() < 0.12 + level * 0.01;
        bricks.push({
          x: marginX + c * (bw + gap),
          y: top + r * (bh + gap),
          w: bw,
          h: bh,
          hp: r === 0 && level >= 3 ? 2 : 1,
          maxHp: r === 0 && level >= 3 ? 2 : 1,
          color: BRICK_COLORS[(r + c) % BRICK_COLORS.length],
          special: isSpecial,
          power: isSpecial ? POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)] : null,
        });
      }
    }
  }

  function buildInvaders() {
    invaders = [];
    const cols = Math.min(INVADER_COLS + Math.floor((level - 1) / 2), 10);
    const rows = Math.min(INVADER_ROWS + Math.floor((level - 1) / 3), 5);
    const iw = 28;
    const ih = 20;
    const gapX = 12;
    const gapY = 12;
    const totalW = cols * iw + (cols - 1) * gapX;
    const startX = (W - totalW) / 2;
    const startY = 40;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        invaders.push({
          x: startX + c * (iw + gapX),
          y: startY + r * (ih + gapY),
          w: iw,
          h: ih,
          row: r,
          col: c,
          alive: true,
          anim: Math.random() * Math.PI * 2,
        });
      }
    }

    invaderDir = 1;
    invaderSpeed = 24 + level * 6;
    invaderDrop = 16 + Math.min(level, 8);
    invaderShootTimer = 1.2;
    enemyShots = [];
  }

  function resetPaddle() {
    paddle.x = W / 2;
    paddle.w = PADDLE_BASE_W;
    wideTimer = 0;
    rapidTimer = 0;
    laserCooldown = 0;
  }

  function clearProjectiles() {
    lasers = [];
    balls = [];
    enemyShots = [];
    powerups = [];
  }

  function startLevel(n) {
    level = n;
    resetPaddle();
    clearProjectiles();
    buildBricks();
    buildInvaders();
    particles = [];
    floatingTexts = [];
    updateHud();
  }

  function startGame() {
    ensureAudio();
    score = 0;
    lives = MAX_LIVES;
    state = "playing";
    hideOverlay();
    startLevel(1);
    updateHud();
  }

  function nextLevel() {
    sfx.level();
    state = "levelup";
    showOverlay(
      `Level ${level} Clear!`,
      `Score: ${score}. Get ready for faster invaders and tougher barriers.`,
      "Next Level"
    );
  }

  function loseLife() {
    lives -= 1;
    sfx.hit();
    shake = 10;
    clearProjectiles();
    resetPaddle();
    updateHud();
    if (lives <= 0) {
      state = "gameover";
      setHigh(score);
      sfx.gameOver();
      showOverlay("Game Over", `Final score: ${score}. High score: ${highScore}.`, "Try Again");
    }
  }

  // ─── Combat / power-ups ─────────────────────────────────────
  function fireLaser() {
    const cd = rapidTimer > 0 ? LASER_COOLDOWN * 0.4 : LASER_COOLDOWN;
    if (laserCooldown > 0) return;
    laserCooldown = cd;
    const count = rapidTimer > 0 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : i === 0 ? -8 : 8;
      lasers.push({
        x: paddle.x + offset - 2,
        y: PADDLE_Y - 8,
        w: 4,
        h: 14,
        vy: -LASER_SPEED,
      });
    }
    sfx.shoot();
  }

  function spawnBall(x, y, angle) {
    const a = angle ?? rand(-Math.PI * 0.75, -Math.PI * 0.25);
    balls.push({
      x,
      y,
      r: 6,
      vx: Math.cos(a) * BALL_SPEED,
      vy: Math.sin(a) * BALL_SPEED,
    });
  }

  function dropPowerup(x, y, type) {
    powerups.push({ x, y, w: 20, h: 20, type, vy: 90 + level * 5 });
  }

  function applyPower(type) {
    sfx.power();
    floatText(paddle.x, PADDLE_Y - 20, type.toUpperCase(), "#4fd1c5");
    if (type === "multi") {
      const n = Math.max(1, 2 - balls.length);
      for (let i = 0; i < n; i++) spawnBall(paddle.x, PADDLE_Y - 20, rand(-2.5, -0.6));
      if (balls.length === 0) spawnBall(paddle.x, PADDLE_Y - 20, -Math.PI / 2 + rand(-0.3, 0.3));
    } else if (type === "wide") {
      wideTimer = 12;
      paddle.w = PADDLE_BASE_W * 1.55;
    } else if (type === "laser") {
      rapidTimer = 10;
    } else if (type === "life") {
      if (lives < 5) {
        lives += 1;
        updateHud();
      } else {
        score += 500;
        floatText(paddle.x, PADDLE_Y - 36, "+500", "#f6ad55");
      }
    }
  }

  function destroyBrick(b, idx) {
    b.hp -= 1;
    if (b.hp > 0) {
      sfx.brick();
      burst(b.x + b.w / 2, b.y + b.h / 2, b.color, 4);
      return;
    }
    sfx.brick();
    score += 50 * level;
    if (b.special && b.power) {
      dropPowerup(b.x + b.w / 2 - 10, b.y, b.power);
      score += 25;
    }
    burst(b.x + b.w / 2, b.y + b.h / 2, b.color, 12);
    bricks.splice(idx, 1);
    setHigh(score);
    updateHud();
  }

  function killInvader(inv) {
    if (!inv.alive) return;
    inv.alive = false;
    const pts = (50 + (INVADER_ROWS - inv.row) * 20) * Math.max(1, Math.floor(level / 2) + 1);
    score += pts;
    sfx.invader();
    burst(inv.x + inv.w / 2, inv.y + inv.h / 2, "#68d391", 14);
    floatText(inv.x + inv.w / 2, inv.y, `+${pts}`, "#68d391");
    setHigh(score);
    updateHud();
  }

  // ─── Update ─────────────────────────────────────────────────
  function update(dt) {
    // stars
    for (const s of stars) {
      s.y += s.sp * dt;
      if (s.y > H) {
        s.y = 0;
        s.x = Math.random() * W;
      }
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const f = floatingTexts[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) floatingTexts.splice(i, 1);
    }

    if (shake > 0) shake = Math.max(0, shake - dt * 30);

    if (state !== "playing") return;

    // paddle movement
    const speed = 380;
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) paddle.x -= speed * dt;
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) paddle.x += speed * dt;
    if (pointerX != null) {
      // smooth follow pointer when mouse/touch active
      const target = pointerX;
      paddle.x += (target - paddle.x) * Math.min(1, 14 * dt);
    }
    paddle.x = clamp(paddle.x, paddle.w / 2 + 4, W - paddle.w / 2 - 4);

    if (wideTimer > 0) {
      wideTimer -= dt;
      if (wideTimer <= 0) paddle.w = PADDLE_BASE_W;
    }
    if (rapidTimer > 0) rapidTimer -= dt;

    // fire
    laserCooldown = Math.max(0, laserCooldown - dt);
    if (fireHeld || keys.has(" ") || keys.has("Spacebar") || pointerDown) fireLaser();

    // lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
      const L = lasers[i];
      L.y += L.vy * dt;
      if (L.y + L.h < 0) {
        lasers.splice(i, 1);
        continue;
      }

      // hit bricks
      let hit = false;
      for (let j = bricks.length - 1; j >= 0; j--) {
        const b = bricks[j];
        if (rectsOverlap(L, b)) {
          destroyBrick(b, j);
          lasers.splice(i, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // hit invaders
      for (const inv of invaders) {
        if (!inv.alive) continue;
        if (rectsOverlap(L, inv)) {
          killInvader(inv);
          lasers.splice(i, 1);
          hit = true;
          break;
        }
      }
    }

    // balls (breakout style)
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx *= -1;
      } else if (ball.x + ball.r > W) {
        ball.x = W - ball.r;
        ball.vx *= -1;
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy *= -1;
      }

      // paddle
      const pBox = { x: paddle.x - paddle.w / 2, y: PADDLE_Y, w: paddle.w, h: paddle.h };
      if (
        ball.vy > 0 &&
        ball.y + ball.r >= PADDLE_Y &&
        ball.y - ball.r <= PADDLE_Y + paddle.h &&
        ball.x >= pBox.x &&
        ball.x <= pBox.x + pBox.w
      ) {
        const hitPos = (ball.x - paddle.x) / (paddle.w / 2);
        const angle = -Math.PI / 2 + hitPos * 1.0;
        const sp = Math.hypot(ball.vx, ball.vy) * 1.02;
        ball.vx = Math.cos(angle) * sp;
        ball.vy = Math.sin(angle) * sp;
        ball.y = PADDLE_Y - ball.r - 1;
        beep(440, 0.05, "triangle", 0.03);
      }

      // bricks
      for (let j = bricks.length - 1; j >= 0; j--) {
        const b = bricks[j];
        const box = { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };
        if (rectsOverlap(box, b)) {
          // simple bounce resolution
          const overlapL = ball.x + ball.r - b.x;
          const overlapR = b.x + b.w - (ball.x - ball.r);
          const overlapT = ball.y + ball.r - b.y;
          const overlapB = b.y + b.h - (ball.y - ball.r);
          const minX = Math.min(overlapL, overlapR);
          const minY = Math.min(overlapT, overlapB);
          if (minX < minY) ball.vx *= -1;
          else ball.vy *= -1;
          destroyBrick(b, j);
          break;
        }
      }

      // invaders
      for (const inv of invaders) {
        if (!inv.alive) continue;
        const box = { x: ball.x - ball.r, y: ball.y - ball.r, w: ball.r * 2, h: ball.r * 2 };
        if (rectsOverlap(box, inv)) {
          ball.vy *= -1;
          killInvader(inv);
          break;
        }
      }

      if (ball.y - ball.r > H) balls.splice(i, 1);
    }

    // powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt;
      const pBox = { x: paddle.x - paddle.w / 2, y: PADDLE_Y, w: paddle.w, h: paddle.h };
      if (rectsOverlap(p, pBox)) {
        applyPower(p.type);
        powerups.splice(i, 1);
      } else if (p.y > H) {
        powerups.splice(i, 1);
      }
    }

    // invaders movement
    const alive = invaders.filter((i) => i.alive);
    if (alive.length) {
      let minX = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const inv of alive) {
        inv.anim += dt * 4;
        minX = Math.min(minX, inv.x);
        maxX = Math.max(maxX, inv.x + inv.w);
        maxY = Math.max(maxY, inv.y + inv.h);
      }

      const step = invaderSpeed * dt * invaderDir;
      let drop = false;
      if (maxX + step > W - 8 || minX + step < 8) {
        invaderDir *= -1;
        drop = true;
      }

      for (const inv of alive) {
        if (drop) inv.y += invaderDrop;
        else inv.x += step;
      }

      // reach bottom / paddle line
      if (maxY + (drop ? invaderDrop : 0) >= PADDLE_Y - 4) {
        loseLife();
        // push invaders back up slightly so player can recover
        for (const inv of alive) inv.y -= invaderDrop * 2;
        if (state !== "playing") return;
      }

      // enemy fire
      invaderShootTimer -= dt;
      if (invaderShootTimer <= 0 && alive.length) {
        invaderShootTimer = Math.max(0.55, 1.6 - level * 0.1);
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        enemyShots.push({
          x: shooter.x + shooter.w / 2 - 2,
          y: shooter.y + shooter.h,
          w: 4,
          h: 10,
          vy: 180 + level * 15,
        });
      }
    }

    // enemy shots
    for (let i = enemyShots.length - 1; i >= 0; i--) {
      const s = enemyShots[i];
      s.y += s.vy * dt;

      // blocked by bricks
      let blocked = false;
      for (let j = bricks.length - 1; j >= 0; j--) {
        const b = bricks[j];
        if (rectsOverlap(s, b)) {
          destroyBrick(b, j);
          enemyShots.splice(i, 1);
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const pBox = { x: paddle.x - paddle.w / 2, y: PADDLE_Y, w: paddle.w, h: paddle.h };
      if (rectsOverlap(s, pBox)) {
        enemyShots.splice(i, 1);
        loseLife();
        if (state !== "playing") return;
        continue;
      }
      if (s.y > H) enemyShots.splice(i, 1);
    }

    // win condition: all invaders dead AND all bricks cleared
    const invadersLeft = invaders.some((i) => i.alive);
    if (!invadersLeft && bricks.length === 0) {
      score += 200 * level;
      setHigh(score);
      updateHud();
      nextLevel();
      return;
    }
    // if invaders gone but bricks remain, still advance (optional soft clear)
    if (!invadersLeft && bricks.length > 0) {
      // bonus clear remaining bricks slowly or just advance
      score += 100 * level + bricks.length * 10;
      setHigh(score);
      updateHud();
      nextLevel();
    }
  }

  // ─── Draw ───────────────────────────────────────────────────
  function drawBackground() {
    ctx.fillStyle = "#050810";
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#c5d0e8";
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // subtle grid near bottom
    ctx.strokeStyle = "rgba(79, 209, 197, 0.06)";
    ctx.beginPath();
    ctx.moveTo(0, PADDLE_Y + 20);
    ctx.lineTo(W, PADDLE_Y + 20);
    ctx.stroke();
  }

  function drawPaddle() {
    const x = paddle.x - paddle.w / 2;
    const y = PADDLE_Y;
    const g = ctx.createLinearGradient(x, y, x, y + paddle.h);
    g.addColorStop(0, "#5eead4");
    g.addColorStop(1, "#0d9488");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, paddle.w, paddle.h, 4);
    ctx.fill();

    // cannon
    ctx.fillStyle = "#99f6e4";
    ctx.fillRect(paddle.x - 3, y - 6, 6, 8);

    if (rapidTimer > 0) {
      ctx.strokeStyle = "rgba(99, 179, 237, 0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, paddle.w + 4, paddle.h + 4);
    }
  }

  function drawBrick(b) {
    const alpha = b.hp / b.maxHp;
    ctx.globalAlpha = 0.55 + 0.45 * alpha;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (b.special) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = { multi: "◎", wide: "↔", laser: "⚡", life: "♥" }[b.power] || "★";
      ctx.fillText(icon, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
    }

    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  }

  function drawInvader(inv) {
    const bob = Math.sin(inv.anim) * 2;
    const x = inv.x;
    const y = inv.y + bob;
    const w = inv.w;
    const h = inv.h;
    const colors = ["#68d391", "#4fd1c5", "#63b3ed", "#b794f4"];
    const col = colors[inv.row % colors.length];

    ctx.fillStyle = col;
    // body
    ctx.fillRect(x + 4, y + 6, w - 8, h - 8);
    // head
    ctx.fillRect(x + 8, y + 2, w - 16, 6);
    // eyes
    ctx.fillStyle = "#050810";
    ctx.fillRect(x + 8, y + 8, 5, 4);
    ctx.fillRect(x + w - 13, y + 8, 5, 4);
    // legs alternating
    ctx.fillStyle = col;
    const phase = Math.sin(inv.anim * 2) > 0;
    if (phase) {
      ctx.fillRect(x + 2, y + h - 4, 6, 4);
      ctx.fillRect(x + w - 8, y + h - 6, 6, 4);
    } else {
      ctx.fillRect(x + 2, y + h - 6, 6, 4);
      ctx.fillRect(x + w - 8, y + h - 4, 6, 4);
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawBackground();

    for (const b of bricks) drawBrick(b);
    for (const inv of invaders) if (inv.alive) drawInvader(inv);

    // lasers
    ctx.fillStyle = "#63b3ed";
    ctx.shadowColor = "#63b3ed";
    ctx.shadowBlur = 8;
    for (const L of lasers) {
      ctx.fillRect(L.x, L.y, L.w, L.h);
    }
    ctx.shadowBlur = 0;

    // enemy shots
    ctx.fillStyle = "#fc8181";
    ctx.shadowColor = "#fc8181";
    ctx.shadowBlur = 6;
    for (const s of enemyShots) {
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    ctx.shadowBlur = 0;

    // balls
    for (const ball of balls) {
      const g = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.r);
      g.addColorStop(0, "#fff7d6");
      g.addColorStop(1, "#f6ad55");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // powerups
    for (const p of powerups) {
      const colors = { multi: "#f6ad55", wide: "#4fd1c5", laser: "#63b3ed", life: "#fc8181" };
      ctx.fillStyle = colors[p.type] || "#fff";
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 4);
      ctx.fill();
      ctx.fillStyle = "#0a0e1a";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = { multi: "◎", wide: "↔", laser: "⚡", life: "♥" }[p.type] || "★";
      ctx.fillText(icon, p.x + p.w / 2, p.y + p.h / 2 + 0.5);
    }

    drawPaddle();

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // floating scores
    ctx.textAlign = "center";
    ctx.font = "bold 12px sans-serif";
    for (const f of floatingTexts) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // active power timers
    if (state === "playing") {
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(232,238,252,0.55)";
      let ty = H - 14;
      if (wideTimer > 0) {
        ctx.fillText(`WIDE ${wideTimer.toFixed(1)}s`, 10, ty);
        ty -= 14;
      }
      if (rapidTimer > 0) {
        ctx.fillText(`RAPID ${rapidTimer.toFixed(1)}s`, 10, ty);
      }
    }

    ctx.restore();
  }

  // ─── Loop ───────────────────────────────────────────────────
  function frame(ts) {
    const t = ts / 1000;
    const dt = Math.min(0.033, lastTime ? t - lastTime : 0);
    lastTime = t;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  // ─── UI hooks ───────────────────────────────────────────────
  startBtn.addEventListener("click", () => {
    ensureAudio();
    if (state === "levelup") {
      hideOverlay();
      startLevel(level + 1);
      state = "playing";
      return;
    }
    startGame();
  });

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    muteBtn.textContent = muted ? "Sound: Off" : "Sound: On";
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  });

  // Polyfill roundRect if needed
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const radius = typeof r === "number" ? r : 0;
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
      this.closePath();
      return this;
    };
  }

  // Init
  elHigh.textContent = String(highScore);
  muteBtn.textContent = muted ? "Sound: Off" : "Sound: On";
  muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  spawnStars();
  // preview empty stage art
  buildBricks();
  buildInvaders();
  invaders.forEach((i) => {
    i.alive = true;
  });
  updateHud();
  requestAnimationFrame(frame);
})();
