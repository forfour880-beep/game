'use client';

import { useEffect, useRef, useState } from 'react';

type Mode = 'menu' | 'play' | 'pause' | 'upgrade' | 'over' | 'howto' | 'settings';
type EnemyKind = 'chaser' | 'runner' | 'tank' | 'shooter' | 'swarm' | 'elite' | 'boss';
type Enemy = { x: number; y: number; r: number; hp: number; maxHp: number; speed: number; kind: EnemyKind; cooldown: number; hit: number };
type Bullet = { x: number; y: number; vx: number; vy: number; life: number; friendly: boolean; damage: number; r: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number };
type Upgrade = { id: string; name: string; desc: string };

type Game = {
  mode: Mode; x: number; y: number; hp: number; maxHp: number; shield: number; speed: number;
  damage: number; fireRate: number; fireTimer: number; projectiles: number; crit: number;
  dash: boolean; dashTimer: number; dashInvuln: number; time: number; wave: number; waveTimer: number;
  spawnTimer: number; score: number; kills: number; level: number; xp: number; nextXp: number;
  enemies: Enemy[]; bullets: Bullet[]; particles: Particle[]; choices: Upgrade[]; bossSpawned: boolean;
};

const W = 1280;
const H = 720;
const SAVE = 'neon-void-v2';
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function freshGame(): Game {
  return { mode: 'menu', x: W / 2, y: H / 2, hp: 100, maxHp: 100, shield: 0, speed: 245, damage: 18, fireRate: 0.3, fireTimer: 0,
    projectiles: 1, crit: 0.08, dash: false, dashTimer: 0, dashInvuln: 0, time: 0, wave: 1, waveTimer: 0, spawnTimer: 0.5,
    score: 0, kills: 0, level: 1, xp: 0, nextXp: 70, enemies: [], bullets: [], particles: [], choices: [], bossSpawned: false };
}

function spark(g: Game, x: number, y: number, count: number, power = 110) {
  for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2; const v = 25 + Math.random() * power; g.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.25 + Math.random() * 0.45, max: 0.7, size: 2 + Math.random() * 3 }); }
}

function spawnEnemy(g: Game, kind?: EnemyKind) {
  const side = Math.floor(Math.random() * 4);
  const x = side === 0 ? -40 : side === 1 ? W + 40 : Math.random() * W;
  const y = side === 2 ? -40 : side === 3 ? H + 40 : Math.random() * H;
  const k = kind ?? (Math.random() < 0.12 ? 'runner' : g.wave > 3 && Math.random() < 0.18 ? 'tank' : g.wave > 2 && Math.random() < 0.16 ? 'shooter' : 'chaser');
  const scale = 1 + g.wave * 0.07;
  const stats: Record<EnemyKind, [number, number, number]> = {
    chaser: [15, 32 * scale, 70 + g.wave * 2], runner: [10, 24 * scale, 145], tank: [27, 210 * scale, 38], shooter: [17, 75 * scale, 52], swarm: [8, 12 * scale, 185], elite: [23, 360 * scale, 78], boss: [62, 3200 + g.wave * 300, 48]
  };
  const [r, hp, speed] = stats[k];
  g.enemies.push({ x, y, r, hp, maxHp: hp, speed, kind: k, cooldown: 1 + Math.random(), hit: 0 });
}

function nearest(g: Game) { let best: Enemy | undefined; let d = Infinity; for (const e of g.enemies) { const q = dist({ x: g.x, y: g.y }, e); if (q < d) { d = q; best = e; } } return best; }

function choices(): Upgrade[] {
  const all: Upgrade[] = [
    { id: 'damage', name: 'OVERCLOCK', desc: '+30% weapon damage' }, { id: 'rate', name: 'RAPID CORE', desc: 'Fire 22% faster' },
    { id: 'speed', name: 'VECTOR DRIVE', desc: '+20% movement speed' }, { id: 'multi', name: 'SPLIT SHOT', desc: '+1 projectile per volley' },
    { id: 'shield', name: 'PHASE SHIELD', desc: '+50 energy shield' }, { id: 'crit', name: 'RAZOR PROTOCOL', desc: '+8% critical chance' }
  ];
  return all.sort(() => Math.random() - 0.5).slice(0, 3);
}

function killEnemy(g: Game, e: Enemy) {
  const boss = e.kind === 'boss';
  g.score += boss ? 2500 : e.kind === 'elite' ? 250 : e.kind === 'tank' ? 80 : 25;
  g.kills++; g.xp += boss ? 100 : e.kind === 'elite' ? 28 : 8; spark(g, e.x, e.y, boss ? 70 : 14, boss ? 180 : 100);
}

function update(g: Game, dt: number, keys: Set<string>, touch: { x: number; y: number }) {
  g.time += dt; g.waveTimer += dt; g.spawnTimer -= dt; g.fireTimer -= dt; g.dashTimer -= dt; g.dashInvuln -= dt;
  let dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  let dy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  if (touch.x || touch.y) { dx = touch.x; dy = touch.y; }
  const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
  if (g.dash && g.dashTimer <= 0) { g.dash = false; g.dashTimer = 2; g.dashInvuln = 0.32; spark(g, g.x, g.y, 22, 140); }
  const speed = g.speed * (g.dashInvuln > 0 ? 3.8 : 1);
  g.x = clamp(g.x + dx * speed * dt, 28, W - 28); g.y = clamp(g.y + dy * speed * dt, 28, H - 28);

  if (g.waveTimer >= 28) { g.wave++; g.waveTimer = 0; g.bossSpawned = false; spark(g, g.x, g.y, 35, 150); }
  if (g.wave % 5 === 0 && !g.bossSpawned) { spawnEnemy(g, 'boss'); g.bossSpawned = true; }
  if (g.spawnTimer <= 0) { const count = Math.min(4, 1 + Math.floor(g.wave / 4)); for (let i = 0; i < count; i++) spawnEnemy(g, g.wave > 5 && Math.random() < 0.1 ? 'elite' : undefined); g.spawnTimer = Math.max(0.22, 1.05 - g.wave * 0.022); }

  if (g.fireTimer <= 0) {
    g.fireTimer = g.fireRate; const target = nearest(g);
    if (target) { const base = Math.atan2(target.y - g.y, target.x - g.x); for (let i = 0; i < g.projectiles; i++) { const offset = (i - (g.projectiles - 1) / 2) * 0.13; const a = base + offset; const crit = Math.random() < g.crit; g.bullets.push({ x: g.x, y: g.y, vx: Math.cos(a) * 610, vy: Math.sin(a) * 610, life: 1.4, friendly: true, damage: g.damage * (crit ? 2 : 1), r: 4 }); } }
  }

  for (const b of g.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
  for (const e of g.enemies) {
    e.hit = Math.max(0, e.hit - dt); const d = dist({ x: g.x, y: g.y }, e); const a = Math.atan2(g.y - e.y, g.x - e.x);
    if (e.kind === 'shooter' && d < 520) { e.cooldown -= dt; if (e.cooldown <= 0) { e.cooldown = 1.7; g.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 245, vy: Math.sin(a) * 245, life: 3, friendly: false, damage: 12, r: 6 }); } e.x += Math.cos(a) * e.speed * 0.35 * dt; e.y += Math.sin(a) * e.speed * 0.35 * dt; }
    else { e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt; }
    if (d < e.r + 15 && g.dashInvuln <= 0) { const damage = e.kind === 'boss' ? 30 : 14; if (g.shield > 0) g.shield = Math.max(0, g.shield - damage * dt); else g.hp -= damage * dt; }
  }

  for (const b of g.bullets) if (b.friendly && b.life > 0) for (const e of g.enemies) if (e.hp > 0 && dist(b, e) < b.r + e.r) { b.life = 0; e.hp -= b.damage; e.hit = 0.08; if (e.hp <= 0) killEnemy(g, e); }
  for (const b of g.bullets) if (!b.friendly && b.life > 0 && dist(b, { x: g.x, y: g.y }) < b.r + 15) { b.life = 0; if (g.dashInvuln <= 0) { if (g.shield > 0) g.shield = Math.max(0, g.shield - b.damage); else g.hp -= b.damage; } }
  g.bullets = g.bullets.filter(b => b.life > 0 && b.x > -80 && b.x < W + 80 && b.y > -80 && b.y < H + 80);
  g.enemies = g.enemies.filter(e => e.hp > 0);
  for (const p of g.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; }
  g.particles = g.particles.filter(p => p.life > 0);

  if (g.xp >= g.nextXp) { g.xp -= g.nextXp; g.level++; g.nextXp = Math.floor(g.nextXp * 1.24); g.choices = choices(); g.mode = 'upgrade'; }
  if (g.hp <= 0) { g.hp = 0; g.mode = 'over'; }
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, g: Game) {
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#050712'; ctx.fillRect(0, 0, w, h);
  const sx = w / W, sy = h / H; ctx.save(); ctx.scale(sx, sy);
  ctx.strokeStyle = 'rgba(120,130,190,.045)'; for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (const p of g.particles) { ctx.globalAlpha = p.life / p.max; ctx.fillStyle = '#8b7cff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
  for (const b of g.bullets) { ctx.fillStyle = b.friendly ? '#d9fbff' : '#ff557f'; ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); } ctx.shadowBlur = 0;
  for (const e of g.enemies) { const c = e.kind === 'boss' ? '#ff4f88' : e.kind === 'tank' ? '#e78a4a' : e.kind === 'shooter' ? '#55d9ff' : e.kind === 'runner' ? '#b06cff' : e.kind === 'elite' ? '#ff4fc5' : '#ff5f7a'; ctx.fillStyle = e.hit > 0 ? '#ffffff' : c; ctx.shadowBlur = e.kind === 'boss' || e.kind === 'elite' ? 24 : 9; ctx.shadowColor = c; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; if (e.hp < e.maxHp) { ctx.fillStyle = '#25101a'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 4); ctx.fillStyle = '#ff668d'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * e.hp / e.maxHp, 4); } }
  ctx.fillStyle = '#8c86ff'; ctx.shadowBlur = 28; ctx.shadowColor = '#756cff'; ctx.beginPath(); ctx.arc(g.x, g.y, 15, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; if (g.shield > 0) { ctx.strokeStyle = '#54dcff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(g.x, g.y, 29, 0, Math.PI * 2); ctx.stroke(); }
  const boss = g.enemies.find(e => e.kind === 'boss'); if (boss) { ctx.fillStyle = '#26101a'; ctx.fillRect(320, 18, 640, 8); ctx.fillStyle = '#ff4f88'; ctx.fillRect(320, 18, 640 * boss.hp / boss.maxHp, 8); ctx.fillStyle = '#ffd1df'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('VOID WARDEN', 640, 14); }
  ctx.restore();
}

export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null); const game = useRef<Game>(freshGame()); const keys = useRef(new Set<string>()); const touch = useRef({ x: 0, y: 0 });
  const [mode, setMode] = useState<Mode>('menu'); const [high, setHigh] = useState(0); const [sfx, setSfx] = useState(true); const [snapshot, setSnapshot] = useState({ score: 0, level: 1 });
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(SAVE) || '{}'); setHigh(Number.isFinite(saved.high) ? saved.high : 0); setSfx(saved.sfx !== false); } catch {} }, []);
  useEffect(() => { const down = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); keys.current.add(k); if (k === 'p') { const m = game.current.mode === 'play' ? 'pause' : game.current.mode === 'pause' ? 'play' : game.current.mode; game.current.mode = m; setMode(m); } if (k === 'shift') game.current.dash = true; }; const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase()); addEventListener('keydown', down); addEventListener('keyup', up); return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); }; }, []);
  useEffect(() => { const c = canvas.current; if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return; let raf = 0; let last = performance.now(); const resize = () => { const d = Math.min(devicePixelRatio || 1, 2); c.width = c.clientWidth * d; c.height = c.clientHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); }; resize(); addEventListener('resize', resize); const loop = (now: number) => { const dt = Math.min(0.033, (now - last) / 1000); last = now; const g = game.current; if (g.mode === 'play') update(g, dt, keys.current, touch.current); draw(ctx, c.clientWidth, c.clientHeight, g); if (g.mode !== mode) setMode(g.mode); if (g.mode === 'over') { setSnapshot({ score: g.score, level: g.level }); setHigh(v => Math.max(v, g.score)); try { const saved = JSON.parse(localStorage.getItem(SAVE) || '{}'); localStorage.setItem(SAVE, JSON.stringify({ high: Math.max(saved.high || 0, g.score), sfx: saved.sfx !== false })); } catch {} } raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); }; }, [mode]);
  const start = () => { game.current = freshGame(); game.current.mode = 'play'; setMode('play'); tone(240, 0.08, sfx); };
  const applyUpgrade = (id: string) => { const g = game.current; if (id === 'damage') g.damage *= 1.3; if (id === 'rate') g.fireRate *= 0.78; if (id === 'speed') g.speed *= 1.2; if (id === 'multi') g.projectiles++; if (id === 'shield') g.shield += 50; if (id === 'crit') g.crit += 0.08; g.mode = 'play'; setMode('play'); tone(720, 0.09, sfx); };
  const saveSfx = (value: boolean) => { setSfx(value); try { localStorage.setItem(SAVE, JSON.stringify({ high, sfx: value })); } catch {} };
  const setTouch = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); touch.current = { x: clamp((e.clientX - r.left - r.width / 2) / (r.width / 2), -1, 1), y: clamp((e.clientY - r.top - r.height / 2) / (r.height / 2), -1, 1) }; };
  const g = game.current;
  return <main className="game-shell"><div className="game-frame"><canvas ref={canvas} />
    {(mode === 'play' || mode === 'pause' || mode === 'upgrade') && <HUD g={g} pause={() => { const m = g.mode === 'play' ? 'pause' : 'play'; g.mode = m; setMode(m); }} dash={() => { g.dash = true; }} touch={setTouch} release={() => { touch.current = { x: 0, y: 0 }; }} />}
    {mode === 'menu' && <Overlay><span className="eyebrow">NEON VOID · ARENA SURVIVAL</span><h1 className="title">OUTLAST<br />THE VOID.</h1><p className="subtitle">Auto-fire. Dodge. Mutate. Survive escalating waves and chase a higher score every run.</p><div className="button-row"><button className="btn primary" onClick={start}>ENTER ARENA</button><button className="btn" onClick={() => setMode('howto')}>HOW TO PLAY</button><button className="btn" onClick={() => setMode('settings')}>SETTINGS</button></div><p className="hint">WASD / ARROWS · SHIFT DASH · P PAUSE · HIGH SCORE {high}</p></Overlay>}
    {mode === 'howto' && <Overlay><Panel title="FIELD MANUAL"><div className="menu-list"><Stat b="MOVE" s="WASD / ARROWS · TOUCH JOYSTICK" /><Stat b="ATTACK" s="AUTO-FIRE NEAREST TARGET" /><Stat b="DASH" s="SHIFT OR TOUCH · INVULNERABLE BURST" /><Stat b="UPGRADE" s="LEVEL UP · PICK ONE OF THREE MUTATIONS" /><Stat b="BOSS" s="EVERY FIFTH WAVE" /></div><button className="btn primary" onClick={() => setMode('menu')}>BACK</button></Panel></Overlay>}
    {mode === 'settings' && <Overlay><Panel title="TUNE IN."><div className="menu-list"><button className="btn" onClick={() => saveSfx(!sfx)}>SFX · {sfx ? 'ON' : 'OFF'}</button></div><button className="btn primary" onClick={() => setMode('menu')}>BACK</button></Panel></Overlay>}
    {mode === 'pause' && <Overlay><Panel title="BREATHE."><p className="subtitle">The void waits. Your score does not.</p><div className="button-row"><button className="btn primary" onClick={() => { g.mode = 'play'; setMode('play'); }}>RESUME</button><button className="btn" onClick={start}>RESTART</button><button className="btn" onClick={() => { g.mode = 'menu'; setMode('menu'); }}>MENU</button></div></Panel></Overlay>}
    {mode === 'upgrade' && <Overlay><Panel title="CHOOSE YOUR EDGE."><span className="eyebrow">MUTATION · LEVEL {g.level}</span><div className="menu-list">{g.choices.map(c => <button className="btn" style={{ textAlign: 'left', padding: 16 }} key={c.id} onClick={() => applyUpgrade(c.id)}><b>{c.name}</b><span style={{ display: 'block', color: '#8f98b3', fontSize: 12, marginTop: 5 }}>{c.desc}</span></button>)}</div></Panel></Overlay>}
    {mode === 'over' && <Overlay><Panel title="THE VOID WON."><div className="stat-grid"><Stat b="SCORE" s={String(snapshot.score)} /><Stat b="HIGH SCORE" s={String(Math.max(high, snapshot.score))} /><Stat b="SURVIVAL" s={formatTime(g.time)} /><Stat b="LEVEL" s={String(snapshot.level)} /></div><div className="button-row"><button className="btn primary" onClick={start}>RUN IT BACK</button><button className="btn" onClick={() => setMode('menu')}>MENU</button></div></Panel></Overlay>}
  </div></main>;
}

function HUD({ g, pause, dash, touch, release }: { g: Game; pause: () => void; dash: () => void; touch: (e: React.PointerEvent<HTMLDivElement>) => void; release: () => void }) {
  return <><div className="hud"><div className="hud-card"><div className="hud-line"><span>CORE</span><b>{Math.ceil(g.hp)}/{g.maxHp}</b></div><div className="bar"><div className="fill hp" style={{ width: `${100 * g.hp / g.maxHp}%` }} /></div><div className="hud-line" style={{ marginTop: 9 }}><span>XP · LVL {g.level}</span><b>{Math.floor(g.xp)}/{g.nextXp}</b></div><div className="bar"><div className="fill xp" style={{ width: `${100 * g.xp / g.nextXp}%` }} /></div></div><div className="hud-card" style={{ textAlign: 'right' }}><div className="hud-line"><span>WAVE</span><b>{g.wave}</b></div><div className="hud-line"><span>SCORE</span><b>{g.score}</b></div><div className="hud-line"><span>TIME</span><b>{formatTime(g.time)}</b></div></div></div><button className="btn pause" onClick={pause}>Ⅱ</button><div className="touch"><div className="stick" onPointerDown={touch} onPointerMove={touch} onPointerUp={release} onPointerCancel={release}><div className="knob" /></div><button className="dash" onPointerDown={dash}>DASH</button></div></>;
}

function Overlay({ children }: { children: React.ReactNode }) { return <div className="overlay">{children}</div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="panel"><span className="eyebrow">NEON VOID</span><h2 className="title" style={{ fontSize: 46 }}>{title}</h2>{children}</div>; }
function Stat({ b, s }: { b: string; s: string }) { return <div className="stat"><b>{b}</b><span>{s}</span></div>; }
function formatTime(t: number) { return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }
function tone(freq: number, duration: number, enabled: boolean) { if (!enabled || typeof window === 'undefined') return; try { const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AudioCtx) return; const ctx = new AudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.frequency.value = freq; gain.gain.value = 0.025; osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + duration); setTimeout(() => ctx.close(), duration * 1000 + 80); } catch {} }
