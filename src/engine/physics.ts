export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;
export const FLOOR_Y = 615;
export const GRAVITY = 1360;
export const BALL_RADIUS = 23;
export const RIM_RADIUS = 41;
export const RIM_TUBE_RADIUS = 5.5;
export const BACKBOARD_HEIGHT = 132;
export const BACKBOARD_THICKNESS = 11;
export const MIN_SHOT_SPEED = 460;
export const MAX_SHOT_SPEED = 1660;
export const FIXED_DT = 1 / 120;

export interface BallState {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
  inFlight: boolean;
  scoredThisShot: boolean;
  touchedRim: boolean;
  touchedBackboard: boolean;
  bonusHitThisShot: boolean;
  flightTime: number;
  squashX: number;
  squashY: number;
  trail: Array<{ x: number; y: number; alpha: number }>;
  launchX: number;
  launchY: number;
  launchPower: number;
  launchAngleDeg: number;
}

export interface HoopState {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rimRadius: number;
  backboardX: number;
  backboardTop: number;
  backboardBottom: number;
  rimFlash: number;
  swishFlare: number;
}

export interface NetNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  restOffsetX: number;
  restOffsetY: number;
}

export interface BonusTarget {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  pulse: number;
  points: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface PhysicsEvents {
  bouncedFloor: boolean;
  floorIntensity: number;
  hitRim: boolean;
  rimIntensity: number;
  hitBackboard: boolean;
  backboardIntensity: number;
  scored: boolean;
  swish: boolean;
  bankShot: boolean;
  hitBonusTarget: boolean;
  shotSettled: boolean;
}

export function createBall(x = 300, y = 485): BallState {
  return {
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    rotation: 0,
    angularVelocity: 0,
    inFlight: false,
    scoredThisShot: false,
    touchedRim: false,
    touchedBackboard: false,
    bonusHitThisShot: false,
    flightTime: 0,
    squashX: 1,
    squashY: 1,
    trail: [],
    launchX: x,
    launchY: y,
    launchPower: 0,
    launchAngleDeg: 0,
  };
}

export function createHoop(x = 1015, y = 278): HoopState {
  return {
    baseX: x,
    baseY: y,
    x,
    y,
    vx: 0,
    vy: 0,
    rimRadius: RIM_RADIUS,
    backboardX: x + RIM_RADIUS + 18,
    backboardTop: y - 108,
    backboardBottom: y + 24,
    rimFlash: 0,
    swishFlare: 0,
  };
}

export function createNet(hoop: HoopState): NetNode[] {
  // 2 rows x 5 columns = 10 dynamic net nodes attached below fixed rim hooks
  const nodes: NetNode[] = [];
  const rows = [
    { offsetY: 28, widthFactor: 0.72 },
    { offsetY: 58, widthFactor: 0.5 },
  ];
  for (const row of rows) {
    const halfW = hoop.rimRadius * row.widthFactor;
    for (let col = 0; col < 5; col++) {
      const t = col / 4;
      const offsetX = -halfW + t * halfW * 2;
      nodes.push({
        x: hoop.x + offsetX,
        y: hoop.y + row.offsetY,
        vx: 0,
        vy: 0,
        restOffsetX: offsetX,
        restOffsetY: row.offsetY,
      });
    }
  }
  return nodes;
}

export function updateHoopPosition(
  hoop: HoopState,
  elapsedSec: number,
  movingEnabled: boolean,
  difficultyFactor: number,
  seedOffset = 0,
) {
  const prevX = hoop.x;
  const prevY = hoop.y;

  if (movingEnabled) {
    const speed = 1.15 + Math.min(1.65, difficultyFactor * 0.14);
    const ampX = 78 + Math.min(35, difficultyFactor * 4);
    const ampY = difficultyFactor > 3 ? Math.min(28, (difficultyFactor - 3) * 5) : 0;
    hoop.x = hoop.baseX + Math.sin(elapsedSec * speed + seedOffset) * ampX;
    hoop.y = hoop.baseY + Math.cos(elapsedSec * speed * 0.7 + seedOffset) * ampY;
  } else {
    hoop.x = hoop.baseX;
    hoop.y = hoop.baseY;
  }

  hoop.vx = (hoop.x - prevX) / FIXED_DT;
  hoop.vy = (hoop.y - prevY) / FIXED_DT;
  hoop.backboardX = hoop.x + hoop.rimRadius + 18;
  hoop.backboardTop = hoop.y - 108;
  hoop.backboardBottom = hoop.y + 24;
  hoop.rimFlash = Math.max(0, hoop.rimFlash - FIXED_DT * 3.5);
  hoop.swishFlare = Math.max(0, hoop.swishFlare - FIXED_DT * 2.4);
}

export function updateNet(net: NetNode[], hoop: HoopState, ball: BallState) {
  for (const node of net) {
    const targetX = hoop.x + node.restOffsetX;
    const targetY = hoop.y + node.restOffsetY;
    const stiffness = 62;
    const damping = 0.88;

    const fx = (targetX - node.x) * stiffness;
    const fy = (targetY - node.y) * stiffness;

    node.vx = (node.vx + fx * FIXED_DT) * damping;
    node.vy = (node.vy + fy * FIXED_DT) * damping;

    // Ball-to-net interaction when ball passes through hoop region
    if (ball.inFlight) {
      const dx = node.x - ball.x;
      const dy = node.y - ball.y;
      const dist = Math.hypot(dx, dy);
      const influence = BALL_RADIUS + 14;
      if (dist < influence && dist > 0.01) {
        const push = (influence - dist) * 18;
        node.vx += (dx / dist) * push + ball.vx * 0.04;
        node.vy += (dy / dist) * push + ball.vy * 0.05;
      }
    }

    node.x += node.vx * FIXED_DT;
    node.y += node.vy * FIXED_DT;
  }
}

function collideCirclePeg(
  ball: BallState,
  pegX: number,
  pegY: number,
  pegR: number,
  restitution: number,
): number {
  const dx = ball.x - pegX;
  const dy = ball.y - pegY;
  const dist = Math.hypot(dx, dy);
  const minDist = BALL_RADIUS + pegR;

  if (dist < minDist && dist > 0.0001) {
    const nx = dx / dist;
    const ny = dy / dist;

    // Push ball outside peg overlap
    const overlap = minDist - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    // Relative velocity along normal
    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      const impulse = -(1 + restitution) * vn;
      ball.vx += nx * impulse;
      ball.vy += ny * impulse;

      // Tangential friction -> angular spin
      const tx = -ny;
      const ty = nx;
      const vt = ball.vx * tx + ball.vy * ty;
      ball.angularVelocity = vt / BALL_RADIUS;
      ball.vx *= 0.96;
      return Math.abs(vn);
    }
  }
  return 0;
}

export function stepBallPhysics(
  ball: BallState,
  hoop: HoopState,
  bonusTarget: BonusTarget,
  windAccelX: number,
  events: PhysicsEvents,
) {
  // Recover squash/stretch toward 1.0 smoothly
  ball.squashX += (1 - ball.squashX) * 0.22;
  ball.squashY += (1 - ball.squashY) * 0.22;

  if (!ball.inFlight) return;

  ball.prevX = ball.x;
  ball.prevY = ball.y;
  ball.flightTime += FIXED_DT;

  // Air drag + gravity + optional wind
  ball.vx += windAccelX * FIXED_DT;
  ball.vx *= 0.9992;
  ball.vy += GRAVITY * FIXED_DT;

  ball.x += ball.vx * FIXED_DT;
  ball.y += ball.vy * FIXED_DT;
  ball.rotation += ball.angularVelocity * FIXED_DT;

  // Bonus target check
  if (bonusTarget.active && !ball.bonusHitThisShot) {
    const distBonus = Math.hypot(ball.x - bonusTarget.x, ball.y - bonusTarget.y);
    if (distBonus <= BALL_RADIUS + bonusTarget.radius) {
      ball.bonusHitThisShot = true;
      events.hitBonusTarget = true;
    }
  }

  // Backboard collision (vertical slab at hoop.backboardX)
  const boardLeft = hoop.backboardX;
  const boardRight = hoop.backboardX + BACKBOARD_THICKNESS;
  if (
    ball.y + BALL_RADIUS > hoop.backboardTop &&
    ball.y - BALL_RADIUS < hoop.backboardBottom
  ) {
    if (ball.x + BALL_RADIUS > boardLeft && ball.prevX + BALL_RADIUS <= boardLeft + 14 && ball.vx > 0) {
      ball.x = boardLeft - BALL_RADIUS;
      const impact = Math.abs(ball.vx);
      ball.vx = -ball.vx * 0.72 + hoop.vx * 0.2;
      ball.vy *= 0.92;
      ball.angularVelocity = -ball.vy / BALL_RADIUS * 0.45;
      ball.touchedBackboard = true;
      ball.squashX = 0.86;
      ball.squashY = 1.14;
      events.hitBackboard = true;
      events.backboardIntensity = Math.min(1, impact / 600);
    } else if (ball.x - BALL_RADIUS < boardRight && ball.prevX - BALL_RADIUS >= boardRight - 14 && ball.vx < 0) {
      ball.x = boardRight + BALL_RADIUS;
      ball.vx = -ball.vx * 0.65;
      ball.touchedBackboard = true;
      events.hitBackboard = true;
      events.backboardIntensity = 0.45;
    }
  }

  // Rim front & back circular pegs
  const frontPegX = hoop.x - hoop.rimRadius;
  const backPegX = hoop.x + hoop.rimRadius;
  const rimImpact1 = collideCirclePeg(ball, frontPegX, hoop.y, RIM_TUBE_RADIUS, 0.58);
  const rimImpact2 = collideCirclePeg(ball, backPegX, hoop.y, RIM_TUBE_RADIUS, 0.58);
  const maxRimImpact = Math.max(rimImpact1, rimImpact2);
  if (maxRimImpact > 45) {
    ball.touchedRim = true;
    hoop.rimFlash = 1;
    events.hitRim = true;
    events.rimIntensity = Math.min(1, maxRimImpact / 580);
  }

  // Basket detection: crossing rim horizontal line downward inside opening
  if (
    !ball.scoredThisShot &&
    ball.vy > 0 &&
    ball.prevY <= hoop.y + 4 &&
    ball.y > hoop.y + 4 &&
    Math.abs(ball.x - hoop.x) < hoop.rimRadius - 5
  ) {
    ball.scoredThisShot = true;
    // Slight net drag slows ball realistically as it passes through twine
    ball.vx *= 0.52;
    ball.vy *= 0.78;
    hoop.swishFlare = 1;
    events.scored = true;
    events.swish = !ball.touchedRim && !ball.touchedBackboard;
    events.bankShot = ball.touchedBackboard && !ball.touchedRim;
  }

  // Floor collision
  if (ball.y + BALL_RADIUS >= FLOOR_Y) {
    ball.y = FLOOR_Y - BALL_RADIUS;
    const impact = Math.abs(ball.vy);
    if (impact > 90) {
      ball.vy = -ball.vy * 0.68;
      ball.vx *= 0.84;
      ball.angularVelocity = ball.vx / BALL_RADIUS;
      const squash = Math.min(0.24, impact / 3200);
      ball.squashY = 1 - squash;
      ball.squashX = 1 + squash;
      events.bouncedFloor = true;
      events.floorIntensity = Math.min(1, impact / 800);
    } else {
      ball.vy = 0;
      ball.vx *= 0.9;
      ball.angularVelocity = ball.vx / BALL_RADIUS;
    }
  }

  // Soft ceiling / side walls so errant mega-shots don't vanish forever
  if (ball.x - BALL_RADIUS < 16) {
    ball.x = 16 + BALL_RADIUS;
    ball.vx = Math.abs(ball.vx) * 0.65;
  } else if (ball.x + BALL_RADIUS > WORLD_WIDTH + 90) {
    ball.x = WORLD_WIDTH + 90 - BALL_RADIUS;
    ball.vx = -Math.abs(ball.vx) * 0.65;
  }

  // Shot settle condition: scored & bounced/dropped past net, OR missed & bounced/rolled out
  if (
    (ball.scoredThisShot && ball.y > hoop.y + 135) ||
    (!ball.scoredThisShot &&
      ball.flightTime > 0.45 &&
      (ball.y >= FLOOR_Y - BALL_RADIUS - 2 && Math.abs(ball.vy) < 120 && ball.flightTime > 1.25)) ||
    ball.flightTime > 3.6
  ) {
    events.shotSettled = true;
  }
}

export function predictTrajectory(
  startX: number,
  startY: number,
  vx: number,
  vy: number,
  windAccelX: number,
  steps = 46,
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  let x = startX;
  let y = startY;
  let cvx = vx;
  let cvy = vy;
  const stepDt = FIXED_DT * 3; // 1/40s per dot for clean spacing

  for (let i = 0; i < steps; i++) {
    cvx += windAccelX * stepDt;
    cvx *= 0.9976;
    cvy += GRAVITY * stepDt;
    x += cvx * stepDt;
    y += cvy * stepDt;
    if (y > FLOOR_Y) break;
    points.push({ x, y });
  }
  return points;
}
