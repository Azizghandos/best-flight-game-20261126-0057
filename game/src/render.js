// Everything the player sees: sky, sea and islands, the runway, the rings, the
// plane itself and the HUD. The camera follows the plane; the world scrolls past
// it. All art is drawn on the canvas — no images, no network.

import { CARGO, FONT, MISSIONS, PALETTE, RING, RUNWAY, VIEW } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_CLEARED = 'cleared';
export const SCREEN_FAILED = 'failed';
export const SCREEN_CRASHED = 'crashed';

const PLANE_SCREEN_X = 460;
/** Screen y of sea level; altitude maps upward from here. */
const SEA_Y = 596;
/** World units of altitude per screen pixel: the highest ring (430) still sits
 *  below the HUD, and the runway still reads clearly at the bottom. */
const ALT_SCALE = 1.15;

function screenY(altitude) {
  return SEA_Y - altitude / ALT_SCALE;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = VIEW.width * dpr;
  canvas.height = VIEW.height * dpr;
  ctx.scale(dpr, dpr);

  let skyGradient = null;
  let seaGradient = null;

  function paintSky(now) {
    if (!skyGradient) {
      skyGradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
      skyGradient.addColorStop(0, PALETTE.skyTop);
      skyGradient.addColorStop(0.45, PALETTE.skyMid);
      skyGradient.addColorStop(0.72, PALETTE.skyLow);
      skyGradient.addColorStop(1, PALETTE.seaDeep);
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Low sun over the sea, drifting almost imperceptibly.
    const sunX = 1050 + Math.sin(now * 0.01) * 20;
    const sunY = 150 + Math.cos(now * 0.008) * 8;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150);
    glow.addColorStop(0, PALETTE.sunCore);
    glow.addColorStop(0.35, PALETTE.sun);
    glow.addColorStop(1, 'rgba(255, 243, 196, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
  }

  function paintCloud(x, y, scale, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x, y, 66 * scale, 20 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 42 * scale, y + 8 * scale, 40 * scale, 15 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 44 * scale, y + 8 * scale, 44 * scale, 16 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function paintSea(state, cameraX, now) {
    if (!seaGradient) {
      seaGradient = ctx.createLinearGradient(0, SEA_Y, 0, VIEW.height);
      seaGradient.addColorStop(0, PALETTE.seaShallow);
      seaGradient.addColorStop(1, PALETTE.seaDeep);
    }
    ctx.fillStyle = seaGradient;
    ctx.fillRect(0, SEA_Y, VIEW.width, VIEW.height - SEA_Y);
    // Rolling wave lines and sparkles, placed from world x so they scroll with the sea.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 2;
    const firstWave = Math.floor(cameraX / 90) * 90;
    for (let wx = firstWave; wx < cameraX + VIEW.width + 90; wx += 90) {
      const sx = wx - cameraX;
      const bob = Math.sin(now * 1.4 + wx * 0.05) * 3;
      ctx.beginPath();
      ctx.moveTo(sx, SEA_Y + 26 + bob);
      ctx.quadraticCurveTo(sx + 22, SEA_Y + 20 + bob, sx + 46, SEA_Y + 26 + bob);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.seaSparkle;
    for (let i = 0; i < 40; i += 1) {
      const wx = Math.floor(cameraX / 47 + i) * 47 + ((i * 137) % 47);
      const sx = wx - cameraX;
      if (sx < 0 || sx > VIEW.width) continue;
      const sy = SEA_Y + 14 + ((i * 53) % 100);
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(now * 2 + i);
      ctx.fillRect(sx, sy, 3, 2);
    }
    ctx.globalAlpha = 1;
  }

  function paintIsland(state, island, cameraX, groundHeightAt) {
    const x0 = island.x0 - cameraX;
    const x1 = island.x1 - cameraX;
    if (x1 < -50 || x0 > VIEW.width + 50) return;
    const top = (x) => screenY(groundHeightAt(x));
    // Sand rim first, slightly lower and wider than the grass.
    ctx.fillStyle = PALETTE.sand;
    ctx.beginPath();
    ctx.moveTo(x0 - 8, SEA_Y + 4);
    for (let x = island.x0; x <= island.x1; x += 24) ctx.lineTo(x - cameraX, top(x) + 8);
    ctx.lineTo(x1 + 8, SEA_Y + 4);
    ctx.closePath();
    ctx.fill();
    // Grass body following the island's profile.
    const grass = ctx.createLinearGradient(0, screenY(island.peak), 0, SEA_Y);
    grass.addColorStop(0, PALETTE.grass);
    grass.addColorStop(1, PALETTE.grassDark);
    ctx.fillStyle = grass;
    ctx.beginPath();
    ctx.moveTo(x0, SEA_Y + 2);
    for (let x = island.x0; x <= island.x1; x += 24) ctx.lineTo(x - cameraX, top(x));
    ctx.lineTo(x1, SEA_Y + 2);
    ctx.closePath();
    ctx.fill();
    // Jungle crown near the peak.
    ctx.fillStyle = PALETTE.jungle;
    const peakX = (island.x0 + island.x1) / 2 - cameraX;
    ctx.beginPath();
    ctx.ellipse(peakX, top((island.x0 + island.x1) / 2) + 6, (island.x1 - island.x0) * 0.22, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Palm trees.
    for (let i = 0; i < island.palms.length; i += 1) {
      const palm = island.palms[i];
      const px = palm.x - cameraX;
      const py = top(palm.x);
      const h = 26 * palm.size;
      ctx.strokeStyle = PALETTE.trunk;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + palm.lean * 20, py - h * 0.6, px + palm.lean * 26, py - h);
      ctx.stroke();
      ctx.fillStyle = PALETTE.palm;
      for (let f = 0; f < 5; f += 1) {
        const a = -Math.PI * 0.15 - f * 0.5 + palm.lean;
        ctx.beginPath();
        ctx.ellipse(px + palm.lean * 26 + Math.cos(a) * 12, py - h + Math.sin(a) * 7, 13, 4.5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Little houses on the home island.
    if (island.houses) {
      for (let i = 0; i < island.houses; i += 1) {
        const hx = island.x0 + 120 + i * 90 - cameraX;
        const hy = top(island.x0 + 120 + i * 90);
        ctx.fillStyle = '#f6f1e7';
        ctx.fillRect(hx, hy - 14, 20, 14);
        ctx.fillStyle = '#c93322';
        ctx.beginPath();
        ctx.moveTo(hx - 2, hy - 14);
        ctx.lineTo(hx + 10, hy - 24);
        ctx.lineTo(hx + 22, hy - 14);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Island name, floating over the peak.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '600 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(island.name, peakX, top((island.x0 + island.x1) / 2) - 32);
  }

  function paintRunway(cameraX) {
    const x0 = RUNWAY.x0 - cameraX;
    const x1 = RUNWAY.x1 - cameraX;
    if (x1 < -20 || x0 > VIEW.width + 20) return;
    const y = screenY(RUNWAY.ground);
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(x0, y - 4, x1 - x0, 8);
    ctx.fillStyle = PALETTE.runwayLine;
    for (let x = x0 + 30; x < x1 - 30; x += 70) ctx.fillRect(x, y - 1, 34, 2);
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = '700 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('RUNWAY 09', (x0 + x1) / 2, y - 12);
    // Windsock at the runway's east end.
    const wx = x1 - 40;
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wx, y - 4);
    ctx.lineTo(wx, y - 34);
    ctx.stroke();
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath();
    ctx.moveTo(wx, y - 34);
    ctx.lineTo(wx + 22, y - 30);
    ctx.lineTo(wx, y - 25);
    ctx.closePath();
    ctx.fill();
  }

  function paintRings(state, cameraX) {
    if (state.missionIndex !== 0) return;
    for (let i = 0; i < state.rings.length; i += 1) {
      const ring = state.rings[i];
      const sx = ring.x - cameraX;
      const sy = screenY(ring.y);
      if (sx < -80 || sx > VIEW.width + 80) continue;
      const pulse = 1 + Math.sin(performance.now() / 300 + i) * 0.04;
      ctx.save();
      ctx.shadowColor = PALETTE.ringOuter;
      ctx.shadowBlur = ring.hit ? 0 : 26;
      ctx.strokeStyle = ring.hit ? PALETTE.hudGood : PALETTE.ringOuter;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(sx, sy, RING.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = ring.hit ? PALETTE.hudGood : PALETTE.ringInner;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, RING.radius * pulse - 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (ring.hit) {
        ctx.strokeStyle = PALETTE.hudGood;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(sx - 16, sy);
        ctx.lineTo(sx - 4, sy + 12);
        ctx.lineTo(sx + 18, sy - 12);
        ctx.stroke();
      } else {
        ctx.fillStyle = ring.hit ? PALETTE.hudGood : PALETTE.hudAccent;
        ctx.font = '800 20px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), sx, sy + 7);
      }
    }
    // Arrow at the screen edge pointing at the next ring.
    const next = state.rings.find((ring) => !ring.hit);
    if (next) {
      const sx = next.x - cameraX;
      if (sx > VIEW.width - 40 || sx < 40) {
        const edgeX = sx > VIEW.width - 40 ? VIEW.width - 46 : 46;
        const edgeY = screenY(next.y);
        const dir = sx > VIEW.width - 40 ? 1 : -1;
        ctx.fillStyle = PALETTE.ringOuter;
        ctx.beginPath();
        ctx.moveTo(edgeX + dir * 16, edgeY);
        ctx.lineTo(edgeX - dir * 8, edgeY - 12);
        ctx.lineTo(edgeX - dir * 8, edgeY + 12);
        ctx.closePath();
        ctx.fill();
        ctx.font = '700 12px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('NEXT RING', edgeX, edgeY + 30);
      }
    }
  }

  function paintTargets(state, cameraX, groundHeightAt) {
    if (state.missionIndex !== 2) return;
    for (let i = 0; i < state.targets.length; i += 1) {
      const target = state.targets[i];
      const sx = target.x - cameraX;
      const sy = screenY(groundHeightAt(target.x));
      if (sx < -120 || sx > VIEW.width + 120) continue;
      ctx.save();
      const doneGood = target.done && target.result !== null && !target.result.startsWith('MISS');
      ctx.strokeStyle = target.done ? (doneGood ? PALETTE.hudGood : PALETTE.hudWarn) : '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sx, sy - 4, CARGO.targetRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = target.done ? PALETTE.hudGood : PALETTE.hudAccent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy - 4, CARGO.targetRadius / 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = '800 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('DROP ' + target.order + (target.done ? ' — ' + target.result : ''), sx, sy - CARGO.targetRadius - 12);
      ctx.restore();
    }
  }

  function paintCrates(state, cameraX) {
    for (let i = 0; i < state.crates.length; i += 1) {
      const crate = state.crates[i];
      const sx = crate.x - cameraX;
      const sy = screenY(crate.y);
      if (sx < -40 || sx > VIEW.width + 40) continue;
      if (crate.chute && !crate.landed) {
        ctx.fillStyle = '#ff5a3c';
        ctx.beginPath();
        ctx.arc(sx, sy - 26, 18, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx - 16, sy - 26);
        ctx.lineTo(sx - 6, sy - 8);
        ctx.moveTo(sx + 16, sy - 26);
        ctx.lineTo(sx + 6, sy - 8);
        ctx.stroke();
      }
      ctx.fillStyle = '#b07a3a';
      ctx.fillRect(sx - 9, sy - 9, 18, 18);
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 9, sy - 9, 18, 18);
      ctx.beginPath();
      ctx.moveTo(sx - 9, sy - 9);
      ctx.lineTo(sx + 9, sy + 9);
      ctx.moveTo(sx + 9, sy - 9);
      ctx.lineTo(sx - 9, sy + 9);
      ctx.stroke();
    }
  }

  function paintParticles(state, cameraX) {
    for (let i = 0; i < state.particles.length; i += 1) {
      const p = state.particles[i];
      const sx = p.x - cameraX;
      const sy = screenY(p.y);
      if (sx < -20 || sx > VIEW.width + 20) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.colour;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * (0.5 + p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintPlane(state, cameraX, groundHeightAt) {
    const plane = state.plane;
    if (state.status === 'crashed') return;
    const sx = plane.x - cameraX;
    const sy = screenY(plane.y);
    // Soft shadow on the ground below, fading and shrinking with altitude.
    const groundY = screenY(groundHeightAt(plane.x));
    const heightAbove = Math.max(0, plane.y - groundHeightAt(plane.x));
    const shadowAlpha = clamp(0.35 - heightAbove / 1400, 0.05, 0.35);
    const shadowScale = clamp(1 - heightAbove / 2400, 0.45, 1);
    ctx.fillStyle = 'rgba(10, 30, 45, ' + shadowAlpha.toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(sx, groundY + 4, 44 * shadowScale, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const facingWest = Math.abs(plane.heading) > Math.PI / 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-plane.pitch * (facingWest ? -1 : 1));
    ctx.scale(facingWest ? -1 : 1, 1);
    // Tail.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-26, -2);
    ctx.lineTo(-40, -20);
    ctx.lineTo(-30, -20);
    ctx.lineTo(-18, -4);
    ctx.closePath();
    ctx.fill();
    // Far wing (darker, behind the fuselage).
    ctx.fillStyle = '#a32718';
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(-16, -22);
    ctx.lineTo(-4, -22);
    ctx.lineTo(8, -2);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly stripe.
    ctx.fillStyle = PALETTE.planeBelly;
    ctx.beginPath();
    ctx.ellipse(2, 4, 30, 5, 0, 0, Math.PI);
    ctx.fill();
    // Lit cockpit window.
    ctx.fillStyle = PALETTE.planeGlass;
    ctx.beginPath();
    ctx.ellipse(16, -5, 9, 5, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(14, -7, 3.5, 2, -0.25, 0, Math.PI * 2);
    ctx.fill();
    // Near wing.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.lineTo(-14, 24);
    ctx.lineTo(0, 24);
    ctx.lineTo(12, 2);
    ctx.closePath();
    ctx.fill();
    // Yellow cheatline.
    ctx.fillStyle = PALETTE.planeTrim;
    ctx.fillRect(-30, -2, 58, 2.5);
    // Spinning propeller.
    const a = plane.propAngle;
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(34 + Math.cos(a) * 16, Math.sin(a) * 16);
    ctx.lineTo(34 - Math.cos(a) * 16, -Math.sin(a) * 16);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(34, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Wreck smoke is drawn by the particle system; a crashed plane leaves a mark.
    if (state.crashedAt) {
      const cx = state.crashedAt.x - cameraX;
      const cy = screenY(state.crashedAt.y);
      ctx.fillStyle = 'rgba(30, 30, 30, 0.5)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, 26, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function gauge(x, y, w, label, value, max, colour) {
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 46, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '700 11px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 10, y + 15);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '800 17px ' + FONT;
    ctx.fillText(String(Math.round(value)), x + 10, y + 36);
    const barX = x + 62;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(barX, y + 26, w - 72, 8, 4);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(barX, y + 26, Math.max(4, (w - 72) * clamp(value / max, 0, 1)), 8, 4);
    ctx.fill();
  }

  function paintHud(state, screen) {
    const plane = state.plane;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.beginPath();
    ctx.roundRect(12, 12, VIEW.width - 24, 64, 10);
    ctx.fill();

    const altFt = Math.round(plane.y * 3.2);
    const spdKt = Math.round(plane.speed * 0.9);
    const hdgDeg = ((Math.round((plane.heading * 180) / Math.PI) % 360) + 360) % 360;
    gauge(24, 22, 190, 'ALTITUDE  ft', altFt, 2300, PALETTE.hudAccent);
    gauge(224, 22, 190, 'SPEED  kt', spdKt, 300, spdKt > 240 ? PALETTE.hudBad : PALETTE.hudGood);
    gauge(424, 22, 190, 'HEADING', hdgDeg, 360, PALETTE.hudAccent);

    // Throttle and fuel.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '700 11px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('THR', 634, 37);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(668, 28, 110, 10, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.beginPath();
    ctx.roundRect(668, 28, Math.max(4, 110 * plane.throttle), 10, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('FUEL', 634, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(668, 53, 110, 10, 5);
    ctx.fill();
    ctx.fillStyle = plane.fuel < 25 ? PALETTE.hudBad : PALETTE.hudGood;
    ctx.beginPath();
    ctx.roundRect(668, 53, Math.max(4, 110 * (plane.fuel / 100)), 10, 5);
    ctx.fill();

    // Score, timer, mission.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '800 24px ' + FONT;
    ctx.fillText('SCORE ' + state.score, VIEW.width - 24, 42);
    const timeColour = state.timeLeft < 30 ? PALETTE.hudBad : PALETTE.hudText;
    ctx.fillStyle = timeColour;
    ctx.font = '800 20px ' + FONT;
    const mins = Math.floor(Math.max(0, state.timeLeft) / 60);
    const secs = Math.floor(Math.max(0, state.timeLeft) % 60);
    ctx.fillText('⏱ ' + mins + ':' + String(secs).padStart(2, '0'), VIEW.width - 24, 66);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = '800 15px ' + FONT;
    ctx.fillText(state.mission.short, 806, 40);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 12px ' + FONT;
    const objective =
      state.missionIndex === 0 ? 'Rings ' + state.ringsHit + '/' + RING.count :
      state.missionIndex === 1 ? (state.beaconPassed ? 'Beacon ✓ — land on the runway' : 'Fly east past the beacon island') :
      'Drops ' + state.dropsDone + '/' + state.targets.length + '  •  Crates ' + state.cratesLeft;
    ctx.fillText(objective, 806, 60);

    // Attempts as little planes.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '700 11px ' + FONT;
    ctx.fillText('ATTEMPTS', 24, 100);
    for (let i = 0; i < state.attemptsLeft; i += 1) {
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.beginPath();
      ctx.ellipse(100 + i * 26, 96, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Damage warning.
    if (plane.damage > 0) {
      ctx.fillStyle = plane.damage > 60 ? PALETTE.hudBad : PALETTE.hudWarn;
      ctx.font = '800 14px ' + FONT;
      ctx.textAlign = 'left';
      ctx.fillText('DAMAGE ' + Math.round(plane.damage) + '%', 200, 100);
    }

    // Centre banner (TOUCHDOWN!, CRASHED, ring hits...).
    if (state.banner) {
      ctx.save();
      ctx.font = '800 44px ' + FONT;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(state.banner, VIEW.width / 2, 210);
      ctx.restore();
    }

    // Objective hint along the bottom while flying.
    if (screen === SCREEN_PLAY && state.message) {
      ctx.fillStyle = 'rgba(8, 24, 40, 0.6)';
      ctx.beginPath();
      ctx.roundRect(VIEW.width / 2 - 330, VIEW.height - 44, 660, 30, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = '600 14px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(state.message, VIEW.width / 2, VIEW.height - 24);
    }
  }

  function paintTitle(state, best, cleared) {
    ctx.fillStyle = 'rgba(6, 20, 34, 0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 76px ' + FONT;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 24;
    ctx.fillText('NUSANTARA SKIES', VIEW.width / 2, 168);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = '700 24px ' + FONT;
    ctx.fillText('Island-hopper flight game  •  rings, landings & cargo drops', VIEW.width / 2, 208);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '600 17px ' + FONT;
    ctx.fillText('Fly the red island-hopper across the archipelago. Three missions, one plane,', VIEW.width / 2, 250);
    ctx.fillText('not much fuel — and a runway that is smaller than it looks.', VIEW.width / 2, 274);

    // Mission buttons.
    const buttonY = 330;
    const buttonW = 330;
    const gap = 30;
    const totalW = buttonW * 3 + gap * 2;
    let bx = (VIEW.width - totalW) / 2;
    for (let i = 0; i < MISSIONS.length; i += 1) {
      const mission = MISSIONS[i];
      const done = cleared.includes(mission.id);
      ctx.fillStyle = done ? 'rgba(123, 228, 149, 0.25)' : PALETTE.hudPanel;
      ctx.strokeStyle = done ? PALETTE.hudGood : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, buttonY, buttonW, 150, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.font = '800 15px ' + FONT;
      ctx.fillText('MISSION ' + (i + 1) + '  —  press ' + (i + 1), bx + buttonW / 2, buttonY + 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 26px ' + FONT;
      ctx.fillText(mission.name, bx + buttonW / 2, buttonY + 68);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '600 13px ' + FONT;
      const words = mission.description.split(' ');
      let line = '';
      let lineY = buttonY + 96;
      for (let w = 0; w < words.length; w += 1) {
        const test = line ? line + ' ' + words[w] : words[w];
        if (ctx.measureText(test).width > buttonW - 36 && line) {
          ctx.fillText(line, bx + buttonW / 2, lineY);
          line = words[w];
          lineY += 18;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, bx + buttonW / 2, lineY);
      if (done) {
        ctx.fillStyle = PALETTE.hudGood;
        ctx.font = '800 15px ' + FONT;
        ctx.fillText('✓ CLEARED', bx + buttonW / 2, buttonY + 138);
      }
      bx += buttonW + gap;
    }

    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '600 16px ' + FONT;
    ctx.fillText('↑ / ↓  climb & descend      ← / →  turn      Shift / Ctrl  throttle      Space  drop cargo / confirm      P  pause', VIEW.width / 2, 540);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 15px ' + FONT;
    ctx.fillText('Click a mission or press 1, 2 or 3 to fly. Best score: ' + best, VIEW.width / 2, 576);
  }

  function paintOverlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(6, 20, 34, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#ffffff';
    ctx.font = '800 58px ' + FONT;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 20;
    ctx.fillText(title, VIEW.width / 2, 300);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '600 19px ' + FONT;
    for (let i = 0; i < lines.length; i += 1) ctx.fillText(lines[i], VIEW.width / 2, 348 + i * 32);
  }

  return {
    /** Paint one frame. `screen` is one of the SCREEN_* constants. */
    draw(state, screen, best, cleared, now) {
      const plane = state.plane;
      const cameraX = clamp(plane.x - PLANE_SCREEN_X, -80, 15000 - VIEW.width + 80);
      const groundHeightAt = (x) => {
        let height = 0;
        const islands = state.archipelago.islands;
        for (let i = 0; i < islands.length; i += 1) {
          const island = islands[i];
          if (x >= island.x0 && x <= island.x1) {
            const t = (x - island.x0) / (island.x1 - island.x0);
            height = Math.max(height, island.peak * Math.pow(Math.sin(Math.PI * t), 0.75));
          }
        }
        if (x >= RUNWAY.x0 && x <= RUNWAY.x1) height = Math.max(height, RUNWAY.ground);
        return height;
      };

      paintSky(now);
      for (let i = 0; i < state.archipelago.clouds.length; i += 1) {
        const cloud = state.archipelago.clouds[i];
        const sx = cloud.x * 0.35 - cameraX * 0.35;
        if (sx > -160 && sx < VIEW.width + 160) paintCloud(sx, cloud.y * 0.55, cloud.scale * 0.8, 0.5);
      }
      paintSea(state, cameraX, now);
      for (let i = 0; i < state.archipelago.islands.length; i += 1) {
        paintIsland(state, state.archipelago.islands[i], cameraX, groundHeightAt);
      }
      paintRunway(cameraX);
      paintRings(state, cameraX);
      paintTargets(state, cameraX, groundHeightAt);
      paintCrates(state, cameraX);
      paintParticles(state, cameraX);
      paintPlane(state, cameraX, groundHeightAt);
      for (let i = 0; i < state.archipelago.clouds.length; i += 1) {
        const cloud = state.archipelago.clouds[i];
        const sx = cloud.x - cameraX;
        if (sx > -180 && sx < VIEW.width + 180) paintCloud(sx, cloud.y, cloud.scale, 0.85);
      }

      if (screen === SCREEN_TITLE) {
        paintTitle(state, best, cleared);
        return;
      }
      paintHud(state, screen);
      if (screen === SCREEN_PAUSED) {
        paintOverlay('PAUSED', ['Press P or Space to keep flying.', 'Score ' + state.score + '  •  ' + state.mission.name]);
      } else if (screen === SCREEN_OVER) {
        paintOverlay('GAME OVER', [
          'Score ' + state.score + '   •   Best ' + best,
          'Press Space or click to fly again.',
        ]);
      } else if (screen === SCREEN_FAILED) {
        paintOverlay('SORTIE OVER', [
          'Out of attempts on ' + state.mission.name + '.',
          'Score ' + state.score + '   •   Best ' + best,
          'Press Space to try another mission, or 1 / 2 / 3 to pick one.',
        ], PALETTE.hudBad);
      } else if (screen === SCREEN_CLEARED) {
        const next = state.missionIndex + 1 < MISSIONS.length ? MISSIONS[state.missionIndex + 1] : null;
        paintOverlay('MISSION COMPLETE!', [
          state.mission.name + ' cleared.  Score ' + state.score,
          next ? 'Next up: ' + next.name + ' — press ' + (state.missionIndex + 2) + ' or Space.' : 'All three missions cleared — you own these skies!',
          'Press Space to continue.',
        ], PALETTE.hudGood);
      } else if (screen === SCREEN_CRASHED) {
        const attempts = state.attemptsLeft > 0
          ? 'Press Space to retry — ' + state.attemptsLeft + ' attempt' + (state.attemptsLeft === 1 ? '' : 's') + ' left.'
          : 'No attempts left.';
        paintOverlay(state.status === 'failed' ? 'SORTIE OVER' : 'CRASHED', [
          'Score ' + state.score + '   •   Best ' + best,
          attempts,
        ], PALETTE.hudBad);
      }
    },
  };
}
