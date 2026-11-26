// The simulation: one propeller plane over a seeded Indonesian archipelago.
// Side view: x is distance east along the island chain, y is altitude above the sea.
// The plane flies, climbs, turns, burns fuel, threads rings, drops crates and lands.
// No rendering here — render.js paints this state.

import {
  ATTEMPTS,
  CARGO,
  MISSION_CLEAR,
  MISSIONS,
  PLANE,
  RING,
  RUNWAY,
  WORLD_LENGTH,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_CENTRE_RING = 2;
export const EVENT_DROP = 4;
export const EVENT_DROP_HIT = 8;
export const EVENT_BULLSEYE = 16;
export const EVENT_LANDED = 32;
export const EVENT_ROUGH = 64;
export const EVENT_CRASH = 128;
export const EVENT_FUEL_EMPTY = 256;
export const EVENT_MISSION_CLEAR = 512;
export const EVENT_SORTIE_OVER = 1024;
export const EVENT_BEACON = 2048;

/** Island names along the chain, west to east. */
const ISLAND_NAMES = [
  'Pulau Merak', 'Pulau Bintang', 'Pulau Kelapa', 'Pulau Ombak', 'Pulau Senja',
  'Pulau Karang', 'Pulau Terbang', 'Pulau Damai', 'Pulau Angin', 'Pulau Cahaya',
];

function bumpShape(t) {
  // Smooth island profile: 0 at the shores, 1 at the peak.
  return Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.75);
}

/** Build the archipelago, ring course, drop targets and clouds from one seed. */
export function generateArchipelago(random) {
  const islands = [];
  // Home island with the flat runway strip.
  islands.push({
    x0: 300, x1: 2100, peak: RUNWAY.ground, name: 'Pulau Merak (Home)',
    runway: true, palms: [], houses: 6,
  });
  let x = 2600;
  let nameIndex = 1;
  while (x < WORLD_LENGTH - 1200) {
    const width = random.range(900, 1600);
    const peak = random.range(70, 190);
    const island = {
      x0: x, x1: x + width, peak, name: ISLAND_NAMES[nameIndex % ISLAND_NAMES.length],
      runway: false, palms: [], houses: random.int(0, 5),
    };
    const palmCount = random.int(4, 10);
    for (let i = 0; i < palmCount; i += 1) {
      island.palms.push({
        x: random.range(island.x0 + 80, island.x1 - 80),
        size: random.range(0.7, 1.3),
        lean: random.range(-0.25, 0.25),
      });
    }
    islands.push(island);
    x += width + random.range(900, 1700);
    nameIndex += 1;
  }

  const rings = [];
  for (let i = 0; i < RING.count; i += 1) {
    rings.push({
      x: RING.firstX + i * RING.spacing + random.range(-120, 120),
      y: random.range(RING.minAlt, RING.maxAlt),
      hit: false,
      centre: false,
    });
  }

  // Drop targets sit on three roomy islands east of home.
  const targetIslands = islands.filter((island) => !island.runway && island.x1 - island.x0 > 1000).slice(0, 3);
  const targets = targetIslands.map((island, index) => ({
    x: (island.x0 + island.x1) / 2,
    island: island.name,
    order: index + 1,
    done: false,
    result: null,
  }));

  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: random.range(0, WORLD_LENGTH),
      y: random.range(90, 470),
      scale: random.range(0.7, 1.9),
      drift: random.range(4, 12),
    });
  }

  return { islands, rings, targets, clouds };
}

/** Ground height at world x: island bumps, flat on the runway strip, 0 over the sea. */
export function groundHeightAt(archipelago, x) {
  if (x >= RUNWAY.x0 && x <= RUNWAY.x1) return RUNWAY.ground;
  let height = 0;
  for (let i = 0; i < archipelago.islands.length; i += 1) {
    const island = archipelago.islands[i];
    if (x >= island.x0 && x <= island.x1) {
      const t = (x - island.x0) / (island.x1 - island.x0);
      height = Math.max(height, island.peak * bumpShape(t));
    }
  }
  return height;
}

function freshPlane() {
  return {
    x: (RUNWAY.x0 + RUNWAY.x1) / 2,
    y: RUNWAY.ground,
    heading: 0,
    pitch: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelMax,
    damage: 0,
    onGround: true,
    flying: false,
    propAngle: 0,
  };
}

export function createWorld(random) {
  const archipelago = generateArchipelago(random);
  const state = {
    archipelago,
    plane: freshPlane(),
    missionIndex: 0,
    mission: MISSIONS[0],
    rings: [],
    targets: [],
    crates: [],
    particles: [],
    ringsHit: 0,
    dropsDone: 0,
    cratesLeft: CARGO.crates,
    beaconPassed: false,
    timeLeft: MISSIONS[0].timeLimit,
    elapsed: 0,
    score: 0,
    attempts: ATTEMPTS,
    attemptsLeft: ATTEMPTS,
    status: 'ready',
    banner: null,
    bannerUntil: 0,
    message: '',
    attract: false,
    crashedAt: null,
    landedQuality: null,
    wind: CARGO.wind,
  };

  function showBanner(text, seconds) {
    state.banner = text;
    state.bannerUntil = state.elapsed + seconds;
  }

  function spawnParticles(x, y, count, kind, colour) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.range(0, Math.PI * 2);
      const speed = random.range(30, kind === 'explosion' ? 260 : 120);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (kind === 'dust' ? 30 : 0),
        life: random.range(0.5, kind === 'explosion' ? 1.4 : 0.9),
        maxLife: 1.4,
        kind,
        colour,
        size: random.range(3, kind === 'explosion' ? 12 : 7),
      });
    }
  }

  function resetSortie(missionIndex) {
    state.missionIndex = missionIndex;
    state.mission = MISSIONS[missionIndex];
    state.plane = freshPlane();
    state.rings = archipelago.rings.map((ring) => ({ ...ring, hit: false, centre: false }));
    state.targets = archipelago.targets.map((target) => ({ ...target, done: false, result: null }));
    state.crates = [];
    state.particles = [];
    state.ringsHit = 0;
    state.dropsDone = 0;
    state.cratesLeft = CARGO.crates;
    state.beaconPassed = false;
    state.timeLeft = state.mission.timeLimit;
    state.elapsed = 0;
    state.attemptsLeft = ATTEMPTS;
    state.status = 'ready';
    state.banner = null;
    state.crashedAt = null;
    state.landedQuality = null;
    state.message = state.mission.hint;
  }

  /** Spend one attempt after a crash or a timeout. The plane stays wrecked on
   *  screen until the player retries; when no attempts are left the sortie is over. */
  function spendAttempt(reason) {
    state.attemptsLeft -= 1;
    if (state.attemptsLeft <= 0) {
      state.status = 'failed';
      showBanner('SORTIE OVER — ' + reason, 4);
      return EVENT_SORTIE_OVER;
    }
    state.status = 'crashed';
    showBanner(reason + ' — ' + state.attemptsLeft + ' attempt' + (state.attemptsLeft === 1 ? '' : 's') + ' left', 4);
    return EVENT_NONE;
  }

  function clearMission() {
    const bonus = MISSION_CLEAR.base + Math.round(state.timeLeft) * MISSION_CLEAR.perSecondLeft;
    state.score += bonus;
    state.status = 'cleared';
    showBanner('MISSION COMPLETE!  +' + bonus + ' pts', 4);
    return EVENT_MISSION_CLEAR;
  }

  function crashPlane(kind) {
    const plane = state.plane;
    state.status = 'crashed';
    state.crashedAt = { x: plane.x, y: plane.y };
    if (kind === 'sea') {
      spawnParticles(plane.x, 6, 26, 'splash', '#bfefff');
      showBanner('SPLASHED DOWN!', 3);
    } else {
      spawnParticles(plane.x, plane.y, 34, 'explosion', '#ff7a3c');
      spawnParticles(plane.x, plane.y, 16, 'smoke', '#5a5a5a');
      showBanner('CRASHED!', 3);
    }
    return EVENT_CRASH | spendAttempt(kind === 'sea' ? 'SPLASHED DOWN' : 'CRASHED');
  }

  function landPlane() {
    const plane = state.plane;
    const sink = Math.abs(plane.speed * Math.sin(plane.pitch));
    const centre = Math.abs(plane.x - (RUNWAY.x0 + RUNWAY.x1) / 2) / ((RUNWAY.x1 - RUNWAY.x0) / 2);
    const axisDeviation = Math.min(Math.abs(plane.heading), Math.abs(Math.abs(plane.heading) - Math.PI));
    const quality = Math.max(0, 100 - Math.round(sink * 0.5) - Math.round(centre * 25) - Math.round(axisDeviation * 30));
    state.landedQuality = { sink: Math.round(sink), speed: Math.round(plane.speed), quality };
    plane.onGround = true;
    plane.flying = false;
    plane.speed = 0;
    plane.pitch = 0;
    spawnParticles(plane.x, plane.y + 4, 18, 'dust', '#d9bd72');
    showBanner('TOUCHDOWN!  Quality ' + quality + '/100', 3);
    if (state.missionIndex === 1 && state.beaconPassed) {
      state.score += quality * 3;
      return EVENT_LANDED | clearMission();
    }
    return EVENT_LANDED;
  }

  function checkRings() {
    const plane = state.plane;
    let events = EVENT_NONE;
    for (let i = 0; i < state.rings.length; i += 1) {
      const ring = state.rings[i];
      if (ring.hit) continue;
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < RING.radius) {
        ring.hit = true;
        ring.centre = dist < RING.radius * 0.45;
        state.ringsHit += 1;
        const points = RING.points + (ring.centre ? RING.centreBonus : 0);
        state.score += points;
        showBanner(
          ring.centre ? 'PERFECT! Ring ' + state.ringsHit + '/' + RING.count + '  +' + points : 'Ring ' + state.ringsHit + '/' + RING.count + '  +' + points,
          1.6,
        );
        events |= ring.centre ? EVENT_CENTRE_RING : EVENT_RING;
        if (state.ringsHit >= RING.count) events |= clearMission();
        break;
      }
    }
    return events;
  }

  function releaseCrate() {
    const plane = state.plane;
    if (state.cratesLeft <= 0 || !plane.flying) return EVENT_NONE;
    state.cratesLeft -= 1;
    state.crates.push({
      x: plane.x, y: plane.y, vx: Math.cos(plane.heading) * plane.speed * 0.3 + state.wind * 0.5,
      vy: 0, landed: false, scored: false, chute: false,
    });
    showBanner('Crate away! ' + state.cratesLeft + ' left', 1.4);
    return EVENT_DROP;
  }

  function stepCrates(dt) {
    let events = EVENT_NONE;
    for (let i = 0; i < state.crates.length; i += 1) {
      const crate = state.crates[i];
      if (crate.landed) continue;
      crate.vy = Math.min(crate.vy + 260 * dt, CARGO.fallSpeed);
      if (crate.vy > 60) crate.chute = true;
      crate.vx += (state.wind - crate.vx) * 0.25 * dt;
      crate.x += crate.vx * dt;
      crate.y -= crate.vy * dt;
      const ground = groundHeightAt(archipelago, crate.x);
      if (crate.y <= ground + 6) {
        crate.y = ground + 6;
        crate.landed = true;
        spawnParticles(crate.x, crate.y, 10, 'dust', '#d9bd72');
        const target = state.targets.find((t) => !t.done);
        if (target) {
          const miss = Math.abs(crate.x - target.x);
          target.done = true;
          state.dropsDone += 1;
          if (miss <= CARGO.targetRadius) {
            const bullseye = miss <= CARGO.targetRadius / 3;
            const points = CARGO.points + (bullseye ? CARGO.bullseyeBonus : 0);
            state.score += points;
            target.result = bullseye ? 'BULLSEYE' : 'HIT';
            showBanner(bullseye ? 'BULLSEYE!  +' + points : 'Supply delivered!  +' + points, 2);
            events |= bullseye ? EVENT_BULLSEYE : EVENT_DROP_HIT;
          } else {
            target.result = 'MISS (' + Math.round(miss) + 'm)';
            showBanner('Crate missed the target by ' + Math.round(miss) + 'm', 2);
            events |= EVENT_DROP_HIT;
          }
        } else {
          events |= EVENT_DROP_HIT;
        }
        if (state.dropsDone >= state.targets.length && state.cratesLeft === 0) {
          events |= clearMission();
        } else if (state.cratesLeft === 0 && state.crates.every((c) => c.landed) && state.dropsDone >= state.targets.length) {
          events |= clearMission();
        }
      }
    }
    return events;
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke') {
        p.vy += 24 * dt;
        p.vx *= 0.98;
      } else if (p.kind === 'splash') {
        p.vy -= 320 * dt;
      } else {
        p.vy -= 60 * dt;
        p.vx *= 0.985;
      }
    }
  }

  /** Advance the simulation one fixed step. `input` is {pitch, turn, throttleUp, throttleDown, action}. */
  function step(dt, input, attract) {
    state.elapsed += dt;
    if (state.banner && state.elapsed > state.bannerUntil) state.banner = null;
    for (let i = 0; i < state.archipelago.clouds.length; i += 1) {
      const cloud = state.archipelago.clouds[i];
      cloud.x += cloud.drift * dt;
      if (cloud.x > WORLD_LENGTH + 400) cloud.x = -400;
    }
    stepParticles(dt);

    const plane = state.plane;
    plane.propAngle += dt * (4 + plane.throttle * 26);

    if (attract) {
      // Title-screen fly-past: cruise east at a gentle altitude, wrap around the chain.
      plane.throttle = 0.55;
      plane.speed = 210;
      plane.pitch = Math.sin(state.elapsed * 0.25) * 0.08;
      plane.heading = 0;
      plane.x += plane.speed * dt;
      plane.y = 250 + Math.sin(state.elapsed * 0.35) * 60;
      plane.flying = true;
      if (plane.x > WORLD_LENGTH - 600) plane.x = 400;
      return EVENT_NONE;
    }

    if (state.status === 'crashed' || state.status === 'failed' || state.status === 'cleared') {
      return EVENT_NONE;
    }

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      showBanner('OUT OF TIME!', 3);
      return EVENT_SORTIE_OVER | spendAttempt('OUT OF TIME');
    }

    // Throttle and speed.
    if (input.throttleUp) plane.throttle = Math.min(1, plane.throttle + dt * 0.7);
    if (input.throttleDown) plane.throttle = Math.max(0, plane.throttle - dt * 0.7);
    if (plane.fuel <= 0) {
      plane.throttle = 0;
      if (plane.flying && !plane._fuelWarned) {
        plane._fuelWarned = true;
        showBanner('FUEL EMPTY — gliding!', 2.5);
        return EVENT_FUEL_EMPTY;
      }
    }
    plane.fuel = Math.max(0, plane.fuel - plane.throttle * PLANE.fuelBurn * dt);
    const targetSpeed = plane.throttle * PLANE.maxSpeed;
    if (plane.speed < targetSpeed) {
      plane.speed = Math.min(targetSpeed, plane.speed + PLANE.accel * dt);
    } else {
      plane.speed = Math.max(0, plane.speed - PLANE.accel * PLANE.drag * dt);
    }

    // Pitch toward the stick, turn with the stick; turning bleeds a little speed.
    const pitchTarget = input.pitch * PLANE.maxPitch;
    plane.pitch += (pitchTarget - plane.pitch) * Math.min(1, dt * 6);
    plane.heading += input.turn * PLANE.turnRate * dt * (0.4 + 0.6 * Math.min(1, plane.speed / 200));
    if (plane.heading > Math.PI) plane.heading -= Math.PI * 2;
    if (plane.heading < -Math.PI) plane.heading += Math.PI * 2;

    // Take-off roll: enough speed on the runway lifts the plane.
    if (plane.onGround) {
      if (plane.speed > PLANE.stallSpeed + 25 && plane.pitch > 0.05) {
        plane.onGround = false;
        plane.flying = true;
        spawnParticles(plane.x, plane.y + 4, 12, 'dust', '#d9bd72');
      } else {
        plane.x += Math.cos(plane.heading) * plane.speed * dt;
        plane.x = Math.max(RUNWAY.x0 + 10, Math.min(RUNWAY.x1 - 10, plane.x));
        plane.y = RUNWAY.ground;
        if (input.action) return releaseCrate();
        return stepCrates(dt);
      }
    }

    // In the air: climb and sink follow pitch and speed; too slow means a stall sink.
    let verticalSpeed = plane.speed * Math.sin(plane.pitch);
    if (plane.speed < PLANE.stallSpeed) {
      verticalSpeed -= (PLANE.stallSpeed - plane.speed) * 0.9;
    }
    plane.x += Math.cos(plane.heading) * plane.speed * dt;
    plane.y += verticalSpeed * dt;
    plane.x = Math.max(60, Math.min(WORLD_LENGTH - 60, plane.x));
    if (plane.y > 560) {
      // Service ceiling: high enough to clear every ring, low enough to stay in frame.
      plane.y = 560;
      plane.pitch = Math.min(plane.pitch, 0);
    }

    // Damage smoke trails behind a battered plane.
    if (plane.damage > 45 && Math.random() < 0.35) {
      state.particles.push({
        x: plane.x - Math.cos(plane.heading) * 30, y: plane.y + 6,
        vx: -Math.cos(plane.heading) * 40, vy: 26, life: 1.1, maxLife: 1.1,
        kind: 'smoke', colour: '#4a4a4a', size: 6,
      });
    }

    let events = stepCrates(dt);
    if (input.action) events |= releaseCrate();

    // Beacon for the landing mission: pass the far island, then come home.
    if (state.missionIndex === 1 && !state.beaconPassed && plane.x > 9800) {
      state.beaconPassed = true;
      showBanner('Beacon passed — turn around and land!', 2.5);
      events |= EVENT_BEACON;
    }

    if (state.missionIndex === 0) events |= checkRings();

    // Ground and sea contact.
    const ground = groundHeightAt(archipelago, plane.x);
    if (plane.y <= ground) {
      plane.y = ground;
      const sink = Math.abs(verticalSpeed);
      // Runway 09/27 is bidirectional: landing counts flying east or west along it.
      const axisDeviation = Math.min(Math.abs(plane.heading), Math.abs(Math.abs(plane.heading) - Math.PI));
      const onRunway = plane.x >= RUNWAY.x0 && plane.x <= RUNWAY.x1 && axisDeviation < 0.35;
      if (ground <= 0.5) {
        return events | crashPlane('sea');
      }
      if (onRunway && plane.speed <= RUNWAY.maxSpeed && sink <= RUNWAY.maxSink) {
        return events | landPlane();
      }
      if (sink > PLANE.crashSinkRate || plane.speed > PLANE.crashSpeed) {
        return events | crashPlane('land');
      }
      // A survivable rough landing on grass: damage, stop, take off again if able.
      plane.damage += PLANE.roughLandingDamage;
      plane.onGround = true;
      plane.flying = false;
      plane.speed = 0;
      plane.pitch = 0;
      spawnParticles(plane.x, plane.y + 4, 16, 'dust', '#c9a86a');
      showBanner('Rough landing! Damage ' + plane.damage + '%', 2.5);
      if (plane.damage >= 100) return events | crashPlane('land');
      return events | EVENT_ROUGH;
    }

    return events;
  }

  resetSortie(0);

  return {
    state,
    resetSortie,
    step,
    groundHeightAt: (x) => groundHeightAt(archipelago, x),
    /** Start a fresh attempt after a crash or a timeout (keeps score and rings). */
    retry() {
      if (state.attemptsLeft <= 0) return false;
      state.plane = freshPlane();
      state.crates = [];
      state.particles = [];
      state.timeLeft = state.mission.timeLimit;
      state.elapsed = 0;
      state.status = 'ready';
      state.banner = null;
      state.crashedAt = null;
      state.landedQuality = null;
      state.message = state.mission.hint;
      return true;
    },
  };
}
