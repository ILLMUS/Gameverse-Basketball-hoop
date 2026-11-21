import type {
  BallSkinId,
  CourtThemeId,
  EquippedLoadout,
  HoopDesignId,
  NetStyleId,
  ShotEffectId,
} from '../types/game';
import {
  BACKBOARD_THICKNESS,
  BALL_RADIUS,
  FLOOR_Y,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type BallState,
  type BonusTarget,
  type HoopState,
  type NetNode,
  type Particle,
  predictTrajectory,
} from './physics';

export interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  alpha: number;
  scale: number;
}

export interface CameraState {
  x: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  shakeTime: number;
  shakeMagnitude: number;
}

export interface RenderContextData {
  ball: BallState;
  hoop: HoopState;
  net: NetNode[];
  bonusTarget: BonusTarget;
  particles: Particle[];
  callouts: FloatingCallout[];
  equipped: EquippedLoadout;
  isAiming: boolean;
  aimVx: number;
  aimVy: number;
  aimPowerRatio: number;
  showAimGuide: boolean;
  aimGuideLength: 'short' | 'full';
  windAccelX: number;
  streak: number;
  score: number;
  isMoneyBall: boolean;
  elapsedSec: number;
  spotLabel: string;
  isThreePointSpot: boolean;
  camera: CameraState;
  bgImages: Record<string, HTMLImageElement>;
}

const BALL_PALETTES: Record<
  BallSkinId,
  { base: string; highlight: string; shadow: string; seam: string; glow?: string }
> = {
  classic_leather: {
    base: '#EA580C',
    highlight: '#FB923C',
    shadow: '#7C2D12',
    seam: '#18181B',
  },
  neon_emerald: {
    base: '#0F172A',
    highlight: '#1E293B',
    shadow: '#020617',
    seam: '#22C55E',
    glow: 'rgba(34, 197, 94, 0.45)',
  },
  electric_purple: {
    base: '#5B21B6',
    highlight: '#8B5CF6',
    shadow: '#2E1065',
    seam: '#38BDF8',
    glow: 'rgba(139, 92, 246, 0.45)',
  },
  arc_blue: {
    base: '#0369A1',
    highlight: '#38BDF8',
    shadow: '#082F49',
    seam: '#E0F2FE',
    glow: 'rgba(56, 189, 248, 0.4)',
  },
  eswatini_pride: {
    base: '#1D4ED8',
    highlight: '#FACC15',
    shadow: '#991B1B',
    seam: '#F8FAFC',
    glow: 'rgba(250, 204, 21, 0.38)',
  },
  championship_gold: {
    base: '#D97706',
    highlight: '#FDE68A',
    shadow: '#78350F',
    seam: '#1E293B',
    glow: 'rgba(251, 191, 36, 0.5)',
  },
};

const COURT_PALETTES: Record<
  CourtThemeId,
  {
    skyTop: string;
    skyBottom: string;
    floorTop: string;
    floorBottom: string;
    lineColor: string;
    paintFill: string;
    accentGlow: string;
    beamColors: [string, string];
  }
> = {
  neon_arena: {
    skyTop: '#050811',
    skyBottom: '#0E1528',
    floorTop: '#111827',
    floorBottom: '#070B13',
    lineColor: 'rgba(34, 197, 94, 0.6)',
    paintFill: 'rgba(139, 92, 246, 0.14)',
    accentGlow: '#22C55E',
    beamColors: ['rgba(34, 197, 94, 0.12)', 'rgba(139, 92, 246, 0.12)'],
  },
  street_court: {
    skyTop: '#0F1021',
    skyBottom: '#2A1B3D',
    floorTop: '#222633',
    floorBottom: '#13161F',
    lineColor: 'rgba(248, 250, 252, 0.52)',
    paintFill: 'rgba(245, 158, 11, 0.14)',
    accentGlow: '#F59E0B',
    beamColors: ['rgba(245, 158, 11, 0.12)', 'rgba(56, 189, 248, 0.08)'],
  },
  indoor_arena: {
    skyTop: '#0A0F1A',
    skyBottom: '#172033',
    floorTop: '#925122',
    floorBottom: '#5C3010',
    lineColor: 'rgba(255, 255, 255, 0.72)',
    paintFill: 'rgba(15, 23, 42, 0.35)',
    accentGlow: '#38BDF8',
    beamColors: ['rgba(255, 255, 255, 0.11)', 'rgba(56, 189, 248, 0.09)'],
  },
  outdoor_court: {
    skyTop: '#162038',
    skyBottom: '#4A2535',
    floorTop: '#7C2D12',
    floorBottom: '#431407',
    lineColor: 'rgba(248, 250, 252, 0.7)',
    paintFill: 'rgba(14, 116, 144, 0.42)',
    accentGlow: '#38BDF8',
    beamColors: ['rgba(251, 146, 60, 0.12)', 'rgba(56, 189, 248, 0.1)'],
  },
};

export function computeCameraProjection(
  canvasWidth: number,
  canvasHeight: number,
  ball: BallState,
  hoop: HoopState,
  prevCamX: number,
): { scale: number; offsetX: number; offsetY: number; camX: number } {
  const aspect = canvasWidth / Math.max(1, canvasHeight);
  if (aspect >= 1.08) {
    // Landscape / Desktop: full court fits nicely with subtle vertical centering
    const scale = Math.min(canvasWidth / WORLD_WIDTH, canvasHeight / WORLD_HEIGHT);
    const offsetX = (canvasWidth - WORLD_WIDTH * scale) * 0.5;
    const offsetY = (canvasHeight - WORLD_HEIGHT * scale) * 0.5;
    return { scale, offsetX, offsetY, camX: 0 };
  }

  // Portrait / Narrow Mobile: zoom comfortably to 820 world units wide and pan smoothly toward ball/hoop
  const visibleWorldW = Math.min(WORLD_WIDTH, Math.max(740, canvasWidth * 1.45));
  const scale = canvasWidth / visibleWorldW;
  const targetFocusX = ball.inFlight
    ? Math.min(hoop.x + 150, Math.max(ball.x + 120, 560))
    : Math.max(ball.launchX - 110, 80);

  const desiredCamX = Math.max(
    0,
    Math.min(WORLD_WIDTH - visibleWorldW, targetFocusX - visibleWorldW * 0.45),
  );
  const camX = prevCamX + (desiredCamX - prevCamX) * 0.12;
  const offsetX = -camX * scale;
  const offsetY = (canvasHeight - WORLD_HEIGHT * scale) * 0.52;
  return { scale, offsetX, offsetY, camX };
}

export function screenToWorld(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  camera: CameraState,
): { x: number; y: number } {
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: (sx - camera.offsetX) / camera.scale,
    y: (sy - camera.offsetY) / camera.scale,
  };
}

export function renderGameFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: RenderContextData,
) {
  const { ball, hoop, net, bonusTarget, particles, callouts, equipped, camera } = data;
  const theme = COURT_PALETTES[equipped.courtTheme] ?? COURT_PALETTES.neon_arena;

  ctx.save();

  // Fill entire viewport background gradient first (covers ultra-wide or tall screens seamlessly)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, theme.skyTop);
  skyGrad.addColorStop(0.75, theme.skyBottom);
  skyGrad.addColorStop(1, theme.floorBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle generated key-art backdrop blended cleanly into the upper arena depth
  const bgKey = equipped.courtTheme === 'street_court' ? 'street' : 'arena';
  const bgImg = data.bgImages[bgKey];
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = equipped.courtTheme === 'neon_arena' ? 0.24 : 0.22;
    const imgAspect = bgImg.naturalWidth / bgImg.naturalHeight;
    const viewAspect = width / Math.max(1, height);
    let drawW = width;
    let drawH = height;
    if (viewAspect > imgAspect) {
      drawH = width / imgAspect;
    } else {
      drawW = height * imgAspect;
    }
    ctx.drawImage(bgImg, (width - drawW) * 0.5, (height - drawH) * 0.35, drawW, drawH);
    ctx.restore();
  }

  // Apply decaying camera shake
  let shakeX = 0;
  let shakeY = 0;
  if (camera.shakeTime > 0) {
    const mag = camera.shakeMagnitude * camera.shakeTime;
    shakeX = (Math.random() * 2 - 1) * mag;
    shakeY = (Math.random() * 2 - 1) * mag;
  }

  // Transform into world coordinate space
  ctx.translate(camera.offsetX + shakeX, camera.offsetY + shakeY);
  ctx.scale(camera.scale, camera.scale);

  // 1. Arena Light Beams & Architecture
  drawArenaAtmosphere(ctx, theme, data.elapsedSec, equipped.courtTheme);

  // 2. Court Floor & Markings (extends horizontally beyond 0..WORLD_WIDTH for ultra-wide viewports)
  drawCourtFloor(ctx, theme, equipped.courtTheme, data.isThreePointSpot, ball.launchX, data.spotLabel);

  // 3. Stanchion Pole & LED Shot Glow
  drawStanchion(ctx, hoop, equipped.hoopDesign, data.streak);

  // 4. Bonus Target Ring (if active)
  if (bonusTarget.active) {
    drawBonusTarget(ctx, bonusTarget, data.elapsedSec);
  }

  // 5. Aiming Guide / Trajectory Preview
  if (data.isAiming) {
    drawAimingOverlay(
      ctx,
      ball,
      data.aimVx,
      data.aimVy,
      data.aimPowerRatio,
      data.showAimGuide,
      data.aimGuideLength,
      data.windAccelX,
      theme.accentGlow,
    );
  }

  // 6. Backboard + Back Half of Rim (drawn BEFORE ball when ball is near/inside hoop)
  drawBackboard(ctx, hoop, equipped.hoopDesign, data.streak);
  drawRimBackHalf(ctx, hoop, equipped.hoopDesign);

  // 7. Shot Trail
  drawBallTrail(ctx, ball, equipped.shotEffect, data.isMoneyBall);

  // 8. Ball Ground Shadow
  drawBallShadow(ctx, ball);

  // 9. Basketball (with rotation & skin)
  drawBasketball(ctx, ball, equipped.ballSkin, data.isMoneyBall);

  // 10. Net & Front Half of Rim (drawn OVER the ball when ball passes through hoop!)
  drawNet(ctx, hoop, net, equipped.netStyle);
  drawRimFrontHalf(ctx, hoop, equipped.hoopDesign);

  // 11. Particles & Floating Score Callouts
  drawParticles(ctx, particles);
  drawCallouts(ctx, callouts);

  ctx.restore();
}

function drawArenaAtmosphere(
  ctx: CanvasRenderingContext2D,
  theme: (typeof COURT_PALETTES)['neon_arena'],
  elapsedSec: number,
  courtTheme: CourtThemeId,
) {
  ctx.save();
  // Animated volumetric spotlight cones
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(elapsedSec * 0.45 + i * 2.1) * 45;
    const baseX = 240 + i * 380;
    const grad = ctx.createLinearGradient(baseX, 0, baseX + sway, FLOOR_Y);
    grad.addColorStop(0, theme.beamColors[i % 2]);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(baseX - 35, -140);
    ctx.lineTo(baseX + 35, -140);
    ctx.lineTo(baseX + 210 + sway, FLOOR_Y);
    ctx.lineTo(baseX - 180 + sway, FLOOR_Y);
    ctx.closePath();
    ctx.fill();
  }

  // Subtle background crowd / arena tier silhouette along horizon
  ctx.fillStyle = courtTheme === 'street_court' ? 'rgba(15, 23, 42, 0.6)' : 'rgba(6, 10, 18, 0.72)';
  ctx.fillRect(-500, FLOOR_Y - 76, WORLD_WIDTH + 1000, 76);

  // Perimeter LED ribbon board
  const ribbonGrad = ctx.createLinearGradient(0, 0, WORLD_WIDTH, 0);
  ribbonGrad.addColorStop(0, 'rgba(34, 197, 94, 0.35)');
  ribbonGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.35)');
  ribbonGrad.addColorStop(1, 'rgba(56, 189, 248, 0.35)');
  ctx.fillStyle = ribbonGrad;
  ctx.fillRect(-500, FLOOR_Y - 10, WORLD_WIDTH + 1000, 3);

  ctx.restore();
}

function drawCourtFloor(
  ctx: CanvasRenderingContext2D,
  theme: (typeof COURT_PALETTES)['neon_arena'],
  courtTheme: CourtThemeId,
  isThreePointSpot: boolean,
  shooterX: number,
  spotLabel: string,
) {
  ctx.save();
  const floorGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, WORLD_HEIGHT + 450);
  floorGrad.addColorStop(0, theme.floorTop);
  floorGrad.addColorStop(1, theme.floorBottom);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(-600, FLOOR_Y, WORLD_WIDTH + 1200, 620);

  // Hardwood planks for indoor_arena or glossy court grid for neon_arena
  if (courtTheme === 'indoor_arena') {
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1;
    for (let y = FLOOR_Y + 14; y < WORLD_HEIGHT + 240; y += 16) {
      ctx.beginPath();
      ctx.moveTo(-500, y);
      ctx.lineTo(WORLD_WIDTH + 500, y);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = -200; x <= WORLD_WIDTH + 200; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, FLOOR_Y);
      ctx.lineTo(x + (x - WORLD_WIDTH * 0.5) * 0.35, WORLD_HEIGHT + 260);
      ctx.stroke();
    }
  }

  // Painted key zone near right basket
  ctx.fillStyle = theme.paintFill;
  ctx.beginPath();
  ctx.moveTo(640, FLOOR_Y);
  ctx.lineTo(1160, FLOOR_Y);
  ctx.lineTo(1230, FLOOR_Y + 95);
  ctx.lineTo(600, FLOOR_Y + 95);
  ctx.closePath();
  ctx.fill();

  // Baseline & sideline floor stripes
  ctx.strokeStyle = theme.lineColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-400, FLOOR_Y + 2);
  ctx.lineTo(WORLD_WIDTH + 400, FLOOR_Y + 2);
  ctx.stroke();

  // Three-point arc marker on floor
  ctx.beginPath();
  ctx.moveTo(335, FLOOR_Y + 2);
  ctx.lineTo(310, FLOOR_Y + 75);
  ctx.stroke();

  // Active Shooter Spot Marker on floor
  const markerColor = isThreePointSpot ? '#8B5CF6' : '#22C55E';
  ctx.fillStyle = isThreePointSpot ? 'rgba(139, 92, 246, 0.25)' : 'rgba(34, 197, 94, 0.25)';
  ctx.strokeStyle = markerColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(shooterX, FLOOR_Y + 14, 38, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Quiet floor spot label
  ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
  ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(spotLabel, shooterX, FLOOR_Y + 42);

  ctx.restore();
}

function drawStanchion(
  ctx: CanvasRenderingContext2D,
  hoop: HoopState,
  design: HoopDesignId,
  streak: number,
) {
  ctx.save();
  const postX = hoop.backboardX + 38;
  const armY = hoop.y - 38;

  // Main vertical support post
  const postGrad = ctx.createLinearGradient(postX, 0, postX + 26, 0);
  postGrad.addColorStop(0, '#1E293B');
  postGrad.addColorStop(0.5, '#334155');
  postGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = postGrad;
  ctx.fillRect(postX, armY, 24, FLOOR_Y - armY + 10);

  // Protective padding at lower post
  ctx.fillStyle = design === 'neon_cyber' ? '#0F172A' : '#1E293B';
  ctx.fillRect(postX - 5, FLOOR_Y - 185, 34, 190);
  ctx.strokeStyle = streak >= 3 ? '#22C55E' : '#38BDF8';
  ctx.lineWidth = 2;
  ctx.strokeRect(postX - 5, FLOOR_Y - 185, 34, 190);

  // Horizontal support arm connecting post to backboard
  ctx.fillStyle = '#334155';
  ctx.fillRect(hoop.backboardX + BACKBOARD_THICKNESS - 2, armY, postX - hoop.backboardX + 10, 14);
  ctx.restore();
}

function drawBackboard(
  ctx: CanvasRenderingContext2D,
  hoop: HoopState,
  design: HoopDesignId,
  streak: number,
) {
  ctx.save();
  const bx = hoop.backboardX;
  const top = hoop.backboardTop;
  const height = hoop.backboardBottom - hoop.backboardTop;

  // Subtle glow when on hot streak or swish flare
  if (hoop.swishFlare > 0.05 || streak >= 3) {
    ctx.shadowColor = streak >= 5 ? '#8B5CF6' : '#22C55E';
    ctx.shadowBlur = 14 + hoop.swishFlare * 18;
  }

  if (design === 'pro_glass') {
    ctx.fillStyle = 'rgba(226, 232, 240, 0.16)';
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
  } else if (design === 'neon_cyber') {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.strokeStyle = '#22C55E';
  } else if (design === 'gold_championship') {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = '#F59E0B';
  } else {
    ctx.fillStyle = 'rgba(71, 85, 105, 0.9)';
    ctx.strokeStyle = '#E2E8F0';
  }

  ctx.lineWidth = 3.5;
  ctx.fillRect(bx, top, BACKBOARD_THICKNESS, height);
  ctx.strokeRect(bx, top, BACKBOARD_THICKNESS, height);

  // Shooter's inner target square edge on backboard face
  ctx.fillStyle = design === 'neon_cyber' ? '#8B5CF6' : '#EF4444';
  ctx.fillRect(bx - 1, hoop.y - 42, 4, 42);

  // Rim mounting bracket
  ctx.fillStyle = '#475569';
  ctx.fillRect(hoop.x + hoop.rimRadius - 2, hoop.y - 3, 22, 7);

  ctx.restore();
}

function drawRimBackHalf(ctx: CanvasRenderingContext2D, hoop: HoopState, design: HoopDesignId) {
  ctx.save();
  const rimColor =
    hoop.rimFlash > 0.1
      ? '#FDE047'
      : design === 'neon_cyber'
      ? '#22C55E'
      : design === 'gold_championship'
      ? '#F59E0B'
      : '#F97316';

  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(hoop.x, hoop.y, hoop.rimRadius, 9, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRimFrontHalf(ctx: CanvasRenderingContext2D, hoop: HoopState, design: HoopDesignId) {
  ctx.save();
  const rimColor =
    hoop.rimFlash > 0.1
      ? '#FEF08A'
      : design === 'neon_cyber'
      ? '#34D399'
      : design === 'gold_championship'
      ? '#FBBF24'
      : '#EA580C';

  if (hoop.swishFlare > 0.05) {
    ctx.shadowColor = '#22C55E';
    ctx.shadowBlur = hoop.swishFlare * 20;
  }

  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(hoop.x, hoop.y, hoop.rimRadius, 9, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawNet(
  ctx: CanvasRenderingContext2D,
  hoop: HoopState,
  net: NetNode[],
  style: NetStyleId,
) {
  if (net.length < 10) return;
  ctx.save();

  ctx.strokeStyle =
    style === 'neon_mesh'
      ? hoop.swishFlare > 0.1
        ? '#4ADE80'
        : 'rgba(56, 189, 248, 0.85)'
      : style === 'street_chain'
      ? '#CBD5E1'
      : style === 'gold_weave'
      ? '#FCD34D'
      : 'rgba(248, 250, 252, 0.86)';

  ctx.lineWidth = style === 'street_chain' ? 2.4 : 2.1;

  // 5 rim hooks across front/back projection
  const hooks: Array<{ x: number; y: number }> = [];
  for (let col = 0; col < 5; col++) {
    const t = col / 4;
    const hx = hoop.x - hoop.rimRadius + 4 + t * (hoop.rimRadius * 2 - 8);
    hooks.push({ x: hx, y: hoop.y + 4 });
  }

  const row1 = net.slice(0, 5);
  const row2 = net.slice(5, 10);

  // Cross-woven diamond mesh lines
  ctx.beginPath();
  for (let col = 0; col < 5; col++) {
    ctx.moveTo(hooks[col].x, hooks[col].y);
    ctx.lineTo(row1[col].x, row1[col].y);
    ctx.lineTo(row2[col].x, row2[col].y);

    if (col < 4) {
      ctx.moveTo(hooks[col].x, hooks[col].y);
      ctx.lineTo(row1[col + 1].x, row1[col + 1].y);
      ctx.moveTo(hooks[col + 1].x, hooks[col + 1].y);
      ctx.lineTo(row1[col].x, row1[col].y);

      ctx.moveTo(row1[col].x, row1[col].y);
      ctx.lineTo(row2[col + 1].x, row2[col + 1].y);
      ctx.moveTo(row1[col + 1].x, row1[col + 1].y);
      ctx.lineTo(row2[col].x, row2[col].y);
    }
  }
  // Bottom gather loop
  for (let col = 0; col < 4; col++) {
    ctx.moveTo(row2[col].x, row2[col].y);
    ctx.lineTo(row2[col + 1].x, row2[col + 1].y);
  }
  ctx.stroke();

  ctx.restore();
}

function drawBonusTarget(ctx: CanvasRenderingContext2D, target: BonusTarget, elapsedSec: number) {
  ctx.save();
  const pulseScale = 1 + Math.sin(elapsedSec * 5) * 0.08;
  const r = target.radius * pulseScale;

  ctx.strokeStyle = '#38BDF8';
  ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(34, 197, 94, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(target.x, target.y, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`+${target.points}`, target.x, target.y);

  ctx.restore();
}

function drawAimingOverlay(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  vx: number,
  vy: number,
  powerRatio: number,
  showGuide: boolean,
  guideLength: 'short' | 'full',
  windAccelX: number,
  accentColor: string,
) {
  ctx.save();

  // Power ring around ball
  const ringR = BALL_RADIUS + 14;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ringR, 0, Math.PI * 2);
  ctx.stroke();

  const powerColor = powerRatio > 0.82 ? '#F59E0B' : powerRatio > 0.45 ? '#22C55E' : '#38BDF8';
  ctx.strokeStyle = powerColor;
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * powerRatio);
  ctx.stroke();

  if (showGuide) {
    const totalSteps = guideLength === 'full' ? 42 : 18;
    const pts = predictTrajectory(ball.x, ball.y, vx, vy, windAccelX, totalSteps);
    for (let i = 0; i < pts.length; i++) {
      const t = i / pts.length;
      const alpha = (1 - t) * 0.85;
      const dotR = Math.max(2, 5.2 * (1 - t * 0.55));
      ctx.fillStyle = i % 2 === 0 ? accentColor : '#38BDF8';
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Minimal directional vector tick when guide is turned off for pro players
    const angle = Math.atan2(vy, vx);
    const len = 32 + powerRatio * 48;
    ctx.strokeStyle = powerColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ball.x + Math.cos(angle) * (BALL_RADIUS + 6), ball.y + Math.sin(angle) * (BALL_RADIUS + 6));
    ctx.lineTo(ball.x + Math.cos(angle) * (BALL_RADIUS + len), ball.y + Math.sin(angle) * (BALL_RADIUS + len));
    ctx.stroke();
  }

  ctx.restore();
}

function drawBallTrail(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  effect: ShotEffectId,
  isMoneyBall: boolean,
) {
  if (ball.trail.length < 2) return;
  ctx.save();

  for (let i = 0; i < ball.trail.length; i++) {
    const pt = ball.trail[i];
    const progress = i / ball.trail.length;
    const r = BALL_RADIUS * 0.72 * progress;
    ctx.globalAlpha = pt.alpha * 0.38 * progress;

    if (isMoneyBall || effect === 'starburst_gold') {
      ctx.fillStyle = i % 2 === 0 ? '#FBBF24' : '#22C55E';
    } else if (effect === 'neon_pulse') {
      ctx.fillStyle = i % 2 === 0 ? '#22C55E' : '#38BDF8';
    } else if (effect === 'violet_comet') {
      ctx.fillStyle = i % 2 === 0 ? '#8B5CF6' : '#EC4899';
    } else {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
    }

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBallShadow(ctx: CanvasRenderingContext2D, ball: BallState) {
  const heightAboveFloor = Math.max(0, FLOOR_Y - (ball.y + BALL_RADIUS));
  const factor = Math.max(0.22, 1 - heightAboveFloor / 520);
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${0.42 * factor})`;
  ctx.beginPath();
  ctx.ellipse(ball.x, FLOOR_Y + 6, BALL_RADIUS * (1.25 - factor * 0.2), 6.5 * factor, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBasketball(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  skin: BallSkinId,
  isMoneyBall: boolean,
) {
  const palette = isMoneyBall ? BALL_PALETTES.championship_gold : BALL_PALETTES[skin] ?? BALL_PALETTES.classic_leather;

  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.scale(ball.squashX, ball.squashY);
  ctx.rotate(ball.rotation);

  if (palette.glow) {
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 16;
  }

  // Spherical radial shading
  const grad = ctx.createRadialGradient(-BALL_RADIUS * 0.32, -BALL_RADIUS * 0.34, BALL_RADIUS * 0.12, 0, 0, BALL_RADIUS);
  grad.addColorStop(0, palette.highlight);
  grad.addColorStop(0.65, palette.base);
  grad.addColorStop(1, palette.shadow);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Clip seams inside ball circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS - 0.5, 0, Math.PI * 2);
  ctx.clip();

  ctx.strokeStyle = palette.seam;
  ctx.lineWidth = 2.1;

  // Horizontal & vertical seam lines
  ctx.beginPath();
  ctx.moveTo(-BALL_RADIUS, 0);
  ctx.lineTo(BALL_RADIUS, 0);
  ctx.moveTo(0, -BALL_RADIUS);
  ctx.lineTo(0, BALL_RADIUS);
  ctx.stroke();

  // Signature curved side seams
  ctx.beginPath();
  ctx.arc(-BALL_RADIUS * 0.92, 0, BALL_RADIUS * 0.78, -0.75, 0.75);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(BALL_RADIUS * 0.92, 0, BALL_RADIUS * 0.78, Math.PI - 0.75, Math.PI + 0.75);
  ctx.stroke();
  ctx.restore();

  // Crisp outer rim stroke
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  ctx.save();
  for (const p of particles) {
    if (!p.active) continue;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCallouts(ctx: CanvasRenderingContext2D, callouts: FloatingCallout[]) {
  ctx.save();
  for (const c of callouts) {
    ctx.globalAlpha = c.alpha;
    ctx.fillStyle = c.color;
    ctx.font = `800 ${Math.round(24 * c.scale)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(c.text, c.x, c.y);
  }
  ctx.restore();
}
