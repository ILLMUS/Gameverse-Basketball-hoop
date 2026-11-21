import { useEffect, useRef } from 'react';
import { GAME_MODES } from '../data/catalog';
import { soundEngine } from '../engine/audio';
import {
  createSeededRng,
  getDailyConditions,
  maybeSpawnBonusTarget,
  pickNextSpot,
} from '../engine/modes';
import {
  type BallState,
  type BonusTarget,
  createBall,
  createHoop,
  createNet,
  FIXED_DT,
  GRAVITY,
  type HoopState,
  MAX_SHOT_SPEED,
  MIN_SHOT_SPEED,
  type NetNode,
  type Particle,
  type PhysicsEvents,
  stepBallPhysics,
  updateHoopPosition,
  updateNet,
  WORLD_WIDTH,
} from '../engine/physics';
import {
  type CameraState,
  computeCameraProjection,
  type FloatingCallout,
  renderGameFrame,
  screenToWorld,
} from '../engine/renderer';
import type {
  EquippedLoadout,
  GameModeId,
  GameSettings,
  LiveHudState,
  ShotTelemetry,
} from '../types/game';

interface GameCanvasProps {
  mode: GameModeId;
  isPlaying: boolean;
  isPaused: boolean;
  showcaseMode: boolean;
  equipped: EquippedLoadout;
  settings: GameSettings;
  matchKey: number;
  onHudUpdate: (hud: LiveHudState) => void;
  onMatchEnd: (summary: {
    score: number;
    baskets: number;
    attempts: number;
    misses: number;
    maxStreak: number;
    swishes: number;
    threePointers: number;
    durationMs: number;
    dailySeed?: string;
    shots: ShotTelemetry[];
  }) => void;
}

const PARTICLE_POOL_SIZE = 120;

function createParticlePool(): Particle[] {
  return Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 3,
    color: '#22C55E',
    alpha: 1,
    life: 0,
    maxLife: 0.6,
  }));
}

function spawnParticleBurst(
  pool: Particle[],
  x: number,
  y: number,
  count: number,
  colors: string[],
  speedScale = 1,
) {
  let spawned = 0;
  for (let i = 0; i < pool.length && spawned < count; i++) {
    const p = pool[i];
    if (!p.active) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (90 + Math.random() * 240) * speedScale;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 60;
      p.size = 2.5 + Math.random() * 4;
      p.color = colors[spawned % colors.length];
      p.maxLife = 0.45 + Math.random() * 0.45;
      p.life = p.maxLife;
      p.alpha = 1;
      spawned++;
    }
  }
}

export function GameCanvas({
  mode,
  isPlaying,
  isPaused,
  showcaseMode,
  equipped,
  settings,
  matchKey,
  onHudUpdate,
  onMatchEnd,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep latest props in refs so requestAnimationFrame never needs teardown on settings/equipped changes
  const propsRef = useRef({
    mode,
    isPlaying,
    isPaused,
    showcaseMode,
    equipped,
    settings,
    onHudUpdate,
    onMatchEnd,
  });
  propsRef.current = {
    mode,
    isPlaying,
    isPaused,
    showcaseMode,
    equipped,
    settings,
    onHudUpdate,
    onMatchEnd,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Preload generated arena & street backdrops
    const arenaImg = new Image();
    arenaImg.src = '/src/assets/images/arena_key_art_1795265394222.jpg';
    const streetImg = new Image();
    streetImg.src = '/src/assets/images/street_court_backdrop_1795265394366.jpg';
    const bgImages: Record<string, HTMLImageElement> = {
      arena: arenaImg,
      street: streetImg,
    };

    const modeConfig = GAME_MODES[mode];
    const daily = mode === 'daily' ? getDailyConditions() : undefined;
    const rng = daily ? createSeededRng(`bonus-${daily.dateKey}`) : Math.random;

    let shotIndex = 0;
    let streak = 0;
    let maxStreak = 0;
    let score = 0;
    let baskets = 0;
    let attempts = 0;
    let misses = 0;
    let swishes = 0;
    let threePointers = 0;
    let timeRemaining: number | null = modeConfig.durationSeconds;
    let lastTickSecond = timeRemaining !== null ? Math.ceil(timeRemaining) : -1;
    let matchEnded = false;
    let matchStartMs = performance.now();
    let elapsedSec = 0;
    let hitstopSec = 0;
    let showcaseCooldown = 0.6;
    let lastHudEmitMs = 0;
    let bannerCounter = 0;
    let currentBanner: LiveHudState['shotBanner'] = null;
    let bannerExpiresAt = 0;

    const shotsTelemetry: ShotTelemetry[] = [];
    const firstSpot = pickNextSpot(mode, 0, 0, daily);
    let currentSpot = firstSpot;
    let isMoneyBall = (mode === 'three_point' || mode === 'daily') && (shotIndex + 1) % 5 === 0;

    const hoop: HoopState = createHoop(1015, daily ? daily.hoopBaseY : 278);
    const net: NetNode[] = createNet(hoop);
    const ball: BallState = createBall(currentSpot.x, currentSpot.y);
    let bonusTarget: BonusTarget = maybeSpawnBonusTarget(mode, shotIndex, hoop.x, hoop.y, rng);
    const particles = createParticlePool();
    const callouts: FloatingCallout[] = [];

    const camera: CameraState = {
      x: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      shakeTime: 0,
      shakeMagnitude: 0,
    };

    // Drag / Aim state (in screen pixels for drag delta, computed cleanly into launch velocity)
    let pointerDown = false;
    let activePointerId: number | null = null;
    let dragStartScreenX = 0;
    let dragStartScreenY = 0;
    let dragCurrScreenX = 0;
    let dragCurrScreenY = 0;
    let aimVx = 660;
    let aimVy = -920;
    let aimPowerRatio = 0.5;
    let canLaunchAim = false;

    const computeAimFromDrag = () => {
      const dxScreen = dragCurrScreenX - dragStartScreenX;
      const dyScreen = dragCurrScreenY - dragStartScreenY;
      const dragDist = Math.hypot(dxScreen, dyScreen);

      if (dragDist < 14) {
        canLaunchAim = false;
        aimPowerRatio = 0;
        return;
      }

      const dragMode = propsRef.current.settings.dragControlMode;
      let dirX = dxScreen;
      let dirY = dyScreen;

      if (dragMode === 'slingshot') {
        dirX = -dxScreen;
        dirY = -dyScreen;
      } else if (dragMode === 'auto') {
        // Pull-back slingshot if dragging left/down; direct swipe if dragging right/up
        if (dxScreen < -10 || dyScreen > 18) {
          dirX = -dxScreen;
          dirY = -dyScreen;
        }
      }

      // Ensure upward/forward shot bias so accidental slight downward jitters still arc cleanly
      if (dirY > -30) {
        dirY = -Math.max(30, Math.abs(dirX) * 0.45);
      }
      if (dirX < 20) {
        dirX = 20;
      }

      const len = Math.hypot(dirX, dirY);
      const nx = dirX / len;
      const ny = dirY / len;

      const maxDragPx = 210;
      const ratio = Math.min(1, Math.max(0.08, (dragDist - 14) / (maxDragPx - 14)));
      const speed = MIN_SHOT_SPEED + (MAX_SHOT_SPEED - MIN_SHOT_SPEED) * Math.pow(ratio, 0.88);

      aimVx = nx * speed;
      aimVy = ny * speed;
      aimPowerRatio = ratio;
      canLaunchAim = true;
    };

    const emitHud = (force = false) => {
      const now = performance.now();
      if (!force && now - lastHudEmitMs < 60) return;
      lastHudEmitMs = now;

      if (currentBanner && now > bannerExpiresAt) {
        currentBanner = null;
      }

      const multiplier = streak >= 10 ? 4 : streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
      propsRef.current.onHudUpdate({
        score,
        baskets,
        attempts,
        misses,
        streak,
        maxStreak,
        swishes,
        threePointers,
        timeRemaining,
        shotBanner: currentBanner,
        spotLabel: currentSpot.label,
        multiplier,
        isMoneyBall,
      });
    };

    const finishMatch = () => {
      if (matchEnded) return;
      matchEnded = true;
      soundEngine.playBuzzer();
      propsRef.current.onMatchEnd({
        score,
        baskets,
        attempts,
        misses,
        maxStreak,
        swishes,
        threePointers,
        durationMs: Math.round(performance.now() - matchStartMs),
        dailySeed: daily?.dateKey,
        shots: shotsTelemetry,
      });
    };

    const resetBallToNextSpot = () => {
      currentSpot = pickNextSpot(mode, shotIndex, streak, daily);
      isMoneyBall = (mode === 'three_point' || mode === 'daily') && (shotIndex + 1) % 5 === 0;
      ball.x = currentSpot.x;
      ball.y = currentSpot.y;
      ball.prevX = currentSpot.x;
      ball.prevY = currentSpot.y;
      ball.vx = 0;
      ball.vy = 0;
      ball.angularVelocity = 0;
      ball.inFlight = false;
      ball.scoredThisShot = false;
      ball.touchedRim = false;
      ball.touchedBackboard = false;
      ball.bonusHitThisShot = false;
      ball.flightTime = 0;
      ball.trail = [];
      ball.launchX = currentSpot.x;
      ball.launchY = currentSpot.y;
      bonusTarget = maybeSpawnBonusTarget(mode, shotIndex, hoop.x, hoop.y, rng);
    };

    // Push initial HUD state immediately
    emitHud(true);

    // ResizeObserver for crisp HiDPI rendering
    const updateSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    // Pointer Events (unified mouse + mobile touch)
    const onPointerDown = (e: PointerEvent) => {
      if (propsRef.current.showcaseMode || !propsRef.current.isPlaying || propsRef.current.isPaused) {
        return;
      }
      if (ball.inFlight || matchEnded) return;
      if (timeRemaining !== null && timeRemaining <= 0) return;

      soundEngine.unlock();
      pointerDown = true;
      activePointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);

      const rect = canvas.getBoundingClientRect();
      const worldPt = screenToWorld(e.clientX, e.clientY, rect, camera);
      // Allow grabbing anywhere on the court for effortless mobile play
      dragStartScreenX = e.clientX;
      dragStartScreenY = e.clientY;
      dragCurrScreenX = e.clientX;
      dragCurrScreenY = e.clientY;
      canLaunchAim = false;
      aimPowerRatio = 0;

      // Subtle visual squash feedback on grab
      if (Math.hypot(worldPt.x - ball.x, worldPt.y - ball.y) < 110) {
        ball.squashX = 1.07;
        ball.squashY = 0.93;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown || e.pointerId !== activePointerId) return;
      dragCurrScreenX = e.clientX;
      dragCurrScreenY = e.clientY;
      computeAimFromDrag();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDown || e.pointerId !== activePointerId) return;
      pointerDown = false;
      activePointerId = null;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }

      if (canLaunchAim && !ball.inFlight && !matchEnded) {
        ball.vx = aimVx;
        ball.vy = aimVy;
        ball.inFlight = true;
        ball.flightTime = 0;
        ball.scoredThisShot = false;
        ball.touchedRim = false;
        ball.touchedBackboard = false;
        ball.bonusHitThisShot = false;
        ball.angularVelocity = aimVx / 115;
        ball.launchX = ball.x;
        ball.launchY = ball.y;
        ball.launchPower = aimPowerRatio;
        ball.launchAngleDeg = Math.round((-Math.atan2(aimVy, aimVx) * 180) / Math.PI);
        ball.squashX = 0.88;
        ball.squashY = 1.14;
        attempts++;
        soundEngine.playShoot();
        emitHud(true);
      }
      canLaunchAim = false;
    };

    const onPointerCancel = () => {
      pointerDown = false;
      activePointerId = null;
      canLaunchAim = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

    // Main 60fps simulation & render loop
    let rafId = 0;
    let lastFrameMs = performance.now();
    let accumulator = 0;

    const frame = (nowMs: number) => {
      rafId = requestAnimationFrame(frame);

      const rawDt = (nowMs - lastFrameMs) / 1000;
      lastFrameMs = nowMs;
      const dt = Math.min(rawDt, 0.05);

      const {
        isPlaying: playing,
        isPaused: paused,
        showcaseMode: showcase,
        equipped: eq,
        settings: cfg,
      } = propsRef.current;

      const simulationActive = showcase || (playing && !paused);

      if (simulationActive && !matchEnded) {
        // Handle micro-hitstop freeze frame on heavy swish/rim impacts
        if (hitstopSec > 0) {
          hitstopSec = Math.max(0, hitstopSec - dt);
        } else {
          elapsedSec += dt;

          // Countdown timer for timed modes
          if (!showcase && timeRemaining !== null) {
            timeRemaining = Math.max(0, timeRemaining - dt);
            const ceilSec = Math.ceil(timeRemaining);
            if (ceilSec <= 10 && ceilSec > 0 && ceilSec !== lastTickSecond) {
              lastTickSecond = ceilSec;
              soundEngine.playCountdownTick(ceilSec <= 3);
            }
            // End match when timer hits 0 AND no ball is still mid-air (buzzer beater rule!)
            if (timeRemaining <= 0 && !ball.inFlight) {
              finishMatch();
              return;
            }
          }

          // Showcase AI auto-shooter for live Title Screen background
          if (showcase && !ball.inFlight) {
            showcaseCooldown -= dt;
            if (showcaseCooldown <= 0) {
              const targetX = hoop.x + (Math.random() - 0.5) * 14;
              const targetY = hoop.y;
              const flightT = 1.05;
              const dx = targetX - ball.x;
              const dy = targetY - ball.y;
              ball.vx = dx / flightT;
              ball.vy = (dy - 0.5 * GRAVITY * flightT * flightT) / flightT;
              ball.inFlight = true;
              ball.flightTime = 0;
              ball.scoredThisShot = false;
              ball.touchedRim = false;
              ball.touchedBackboard = false;
              ball.angularVelocity = 6.2;
              showcaseCooldown = 1.15;
            }
          }

          // Fixed timestep physics accumulator
          accumulator += dt;
          const windAccelX = daily ? daily.windAccelX : mode === 'timed_90' && score >= 40 ? -18 : 0;

          while (accumulator >= FIXED_DT) {
            accumulator -= FIXED_DT;

            updateHoopPosition(
              hoop,
              elapsedSec,
              modeConfig.movingHoop,
              baskets,
              daily?.movingSpeedOffset ?? 0,
            );

            const events: PhysicsEvents = {
              bouncedFloor: false,
              floorIntensity: 0,
              hitRim: false,
              rimIntensity: 0,
              hitBackboard: false,
              backboardIntensity: 0,
              scored: false,
              swish: false,
              bankShot: false,
              hitBonusTarget: false,
              shotSettled: false,
            };

            stepBallPhysics(ball, hoop, bonusTarget, windAccelX, events);
            updateNet(net, hoop, ball);

            // Process physics events
            if (events.hitBonusTarget) {
              bonusTarget.active = false;
              spawnParticleBurst(particles, bonusTarget.x, bonusTarget.y, 18, ['#38BDF8', '#22C55E'], 0.9);
              callouts.push({
                x: bonusTarget.x,
                y: bonusTarget.y - 16,
                vy: -55,
                text: `TARGET +${bonusTarget.points}`,
                color: '#38BDF8',
                alpha: 1,
                scale: 1,
              });
              if (!showcase) soundEngine.playCountdownTick(true);
            }

            if (events.bouncedFloor && !showcase) {
              soundEngine.playBounce(events.floorIntensity);
            }

            if (events.hitBackboard && !showcase) {
              soundEngine.playBackboardHit(events.backboardIntensity);
            }

            if (events.hitRim) {
              if (!showcase) soundEngine.playRimClang(events.rimIntensity);
              if (cfg.screenShakeEnabled && events.rimIntensity > 0.55) {
                camera.shakeTime = 0.16;
                camera.shakeMagnitude = 6;
              }
            }

            if (events.scored) {
              if (showcase) {
                spawnParticleBurst(particles, hoop.x, hoop.y + 10, 22, ['#22C55E', '#8B5CF6', '#38BDF8'], 1.1);
                hoop.swishFlare = 1;
              } else {
                streak++;
                maxStreak = Math.max(maxStreak, streak);
                baskets++;
                if (events.swish) swishes++;
                if (currentSpot.isThreePoint) threePointers++;

                const basePts = currentSpot.isThreePoint ? 3 : 2;
                const swishBonus = events.swish ? 1 : 0;
                const bankBonus = events.bankShot ? 1 : 0;
                const streakBonus = streak >= 10 ? 3 : streak >= 6 ? 2 : streak >= 3 ? 1 : 0;
                const moneyBonus = isMoneyBall ? 2 : 0;
                const targetBonus = ball.bonusHitThisShot ? bonusTarget.points : 0;
                const totalShotPts =
                  basePts + swishBonus + bankBonus + streakBonus + moneyBonus + targetBonus;

                score += totalShotPts;
                shotIndex++;

                shotsTelemetry.push({
                  timestampOffsetMs: Math.round(performance.now() - matchStartMs),
                  power: Number(ball.launchPower.toFixed(2)),
                  angleDeg: ball.launchAngleDeg,
                  scored: true,
                  points: totalShotPts,
                  swish: events.swish,
                  bankShot: events.bankShot,
                  bonusHit: ball.bonusHitThisShot,
                  threePointer: currentSpot.isThreePoint,
                });

                soundEngine.playScore(streak, events.swish);

                const burstColors = isMoneyBall
                  ? ['#FBBF24', '#22C55E', '#FEF08A']
                  : events.swish
                  ? ['#22C55E', '#38BDF8', '#A78BFA']
                  : ['#22C55E', '#F8FAFC'];
                spawnParticleBurst(
                  particles,
                  hoop.x,
                  hoop.y + 12,
                  events.swish ? 30 : 18,
                  burstColors,
                  events.swish ? 1.25 : 0.9,
                );

                if (events.swish && cfg.screenShakeEnabled) {
                  hitstopSec = 0.032;
                  camera.shakeTime = 0.14;
                  camera.shakeMagnitude = 5;
                }

                let label = currentSpot.isThreePoint ? `3PT +${totalShotPts}` : `BUCKET +${totalShotPts}`;
                let sub: string | undefined;
                let tone: 'emerald' | 'purple' | 'blue' | 'amber' = currentSpot.isThreePoint ? 'purple' : 'emerald';

                if (events.swish) {
                  label = `SWISH! +${totalShotPts}`;
                  tone = 'emerald';
                } else if (events.bankShot) {
                  label = `BANK SHOT! +${totalShotPts}`;
                  tone = 'blue';
                }
                if (isMoneyBall) {
                  sub = 'Money Ball Bonus';
                  tone = 'amber';
                } else if (streak >= 3) {
                  sub = `${streak} Shot Streak`;
                }

                bannerCounter++;
                currentBanner = { text: label, subtext: sub, tone, id: bannerCounter };
                bannerExpiresAt = performance.now() + 1450;

                callouts.push({
                  x: hoop.x,
                  y: hoop.y - 36,
                  vy: -65,
                  text: label,
                  color: tone === 'amber' ? '#FBBF24' : tone === 'purple' ? '#C084FC' : '#4ADE80',
                  alpha: 1,
                  scale: events.swish ? 1.2 : 1,
                });

                emitHud(true);
              }
            }

            if (events.shotSettled) {
              if (!showcase && !ball.scoredThisShot) {
                misses++;
                streak = 0;
                shotIndex++;
                shotsTelemetry.push({
                  timestampOffsetMs: Math.round(performance.now() - matchStartMs),
                  power: Number(ball.launchPower.toFixed(2)),
                  angleDeg: ball.launchAngleDeg,
                  scored: false,
                  points: 0,
                  swish: false,
                  bankShot: false,
                  bonusHit: false,
                  threePointer: currentSpot.isThreePoint,
                });

                bannerCounter++;
                currentBanner = {
                  text: 'MISSED',
                  subtext: modeConfig.missEndsRun ? 'Streak Ended' : undefined,
                  tone: 'amber',
                  id: bannerCounter,
                };
                bannerExpiresAt = performance.now() + 950;
                emitHud(true);

                if (modeConfig.missEndsRun) {
                  finishMatch();
                  return;
                }
              }

              // Check buzzer-beater finish after ball settles
              if (!showcase && timeRemaining !== null && timeRemaining <= 0) {
                finishMatch();
                return;
              }

              resetBallToNextSpot();
            }
          }

          // Trail update
          if (ball.inFlight) {
            ball.trail.push({ x: ball.x, y: ball.y, alpha: 1 });
            if (ball.trail.length > 16) ball.trail.shift();
          }
          for (const t of ball.trail) {
            t.alpha = Math.max(0, t.alpha - dt * 3.5);
          }

          // Update particles & floating callouts
          for (const p of particles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) {
              p.active = false;
              continue;
            }
            p.vy += 420 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.alpha = p.life / p.maxLife;
          }

          for (let i = callouts.length - 1; i >= 0; i--) {
            const c = callouts[i];
            c.y += c.vy * dt;
            c.alpha -= dt * 0.95;
            if (c.alpha <= 0) callouts.splice(i, 1);
          }

          if (camera.shakeTime > 0) {
            camera.shakeTime = Math.max(0, camera.shakeTime - dt * 2.5);
          }
        }
      }

      // Periodic timer HUD refresh during active timed play
      if (!showcase && playing && !paused && timeRemaining !== null) {
        emitHud(false);
      }

      // Responsive camera projection
      const rect = container.getBoundingClientRect();
      const proj = computeCameraProjection(rect.width, rect.height, ball, hoop, camera.x);
      camera.scale = proj.scale;
      camera.offsetX = proj.offsetX;
      camera.offsetY = proj.offsetY;
      camera.x = proj.camX;

      const windAccelX = daily ? daily.windAccelX : mode === 'timed_90' && score >= 40 ? -18 : 0;

      renderGameFrame(ctx, rect.width, rect.height, {
        ball,
        hoop,
        net,
        bonusTarget,
        particles,
        callouts,
        equipped: eq,
        isAiming: !showcase && pointerDown && canLaunchAim,
        aimVx,
        aimVy,
        aimPowerRatio,
        showAimGuide: cfg.aimGuideEnabled,
        aimGuideLength: cfg.aimGuideLength,
        windAccelX,
        streak,
        score,
        isMoneyBall: !showcase && isMoneyBall,
        elapsedSec,
        spotLabel: showcase ? 'Gameverse Arena' : currentSpot.label,
        isThreePointSpot: currentSpot.isThreePoint,
        camera,
        bgImages,
      });
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    };
    // Re-initialize canvas engine cleanly when mode or matchKey changes
  }, [mode, matchKey]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none bg-[#07090E]">
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none cursor-crosshair"
        aria-label="Basketball Hoops Arcade Court"
      />
      {!showcaseMode && (
        <div className="pointer-events-none sr-only">
          Active Gameverse Basketball Court — {WORLD_WIDTH} virtual units
        </div>
      )}
    </div>
  );
}
