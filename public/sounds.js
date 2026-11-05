// Bruitages synthétisés avec la Web Audio API : aucun fichier audio à télécharger.
let ctx = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function master(volume = 0.5) {
  const g = ctx.createGain();
  g.gain.value = volume;
  g.connect(ctx.destination);
  return g;
}

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// « Pin-pon » à deux tons, comme les sirènes françaises.
function siren() {
  const t = ctx.currentTime;
  const out = master(0.25);
  const osc = ctx.createOscillator();
  osc.type = "square";
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2200;
  for (let i = 0; i < 6; i++) {
    osc.frequency.setValueAtTime(i % 2 ? 580 : 435, t + i * 0.5);
  }
  osc.connect(lp).connect(out);
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.25, t + 0.1);
  out.gain.setValueAtTime(0.25, t + 2.8);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 3);
  osc.start(t);
  osc.stop(t + 3);
  return 3000;
}

function howl() {
  const t = ctx.currentTime;
  const out = master(0.35);
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1200;
  lp.Q.value = 6;
  const vib = ctx.createOscillator();
  const vibGain = ctx.createGain();
  vib.frequency.value = 5.5;
  vibGain.gain.value = 12;
  vib.connect(vibGain).connect(osc.frequency);
  osc.frequency.setValueAtTime(280, t);
  osc.frequency.exponentialRampToValueAtTime(620, t + 0.8);
  osc.frequency.setValueAtTime(620, t + 1.6);
  osc.frequency.exponentialRampToValueAtTime(330, t + 2.8);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(1, t + 0.4);
  env.gain.setValueAtTime(1, t + 2.2);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 3);
  osc.connect(lp).connect(env).connect(out);
  osc.start(t);
  vib.start(t);
  osc.stop(t + 3);
  vib.stop(t + 3);
  return 3000;
}

function ping(freq, start, dur, vol, out, type = "sine") {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(out);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function bells() {
  const t = ctx.currentTime;
  const out = master(0.3);
  for (let i = 0; i < 16; i++) {
    const s = t + i * 0.12 + Math.random() * 0.04;
    const f = 2400 + Math.random() * 900;
    ping(f, s, 0.25, 0.5, out);
    ping(f * 1.5, s, 0.15, 0.2, out);
  }
  return 2300;
}

function roar() {
  const t = ctx.currentTime;
  const out = master(0.6);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(2.5);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.linearRampToValueAtTime(900, t + 0.6);
  lp.frequency.linearRampToValueAtTime(200, t + 2.3);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(1, t + 0.3);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  n.connect(lp).connect(env).connect(out);
  const growl = ctx.createOscillator();
  growl.type = "sawtooth";
  growl.frequency.setValueAtTime(70, t);
  growl.frequency.linearRampToValueAtTime(95, t + 0.6);
  growl.frequency.linearRampToValueAtTime(55, t + 2.3);
  const gg = ctx.createGain();
  gg.gain.value = 0.35;
  growl.connect(gg).connect(env);
  n.start(t);
  growl.start(t);
  n.stop(t + 2.5);
  growl.stop(t + 2.5);
  return 2500;
}

function magic() {
  const t = ctx.currentTime;
  const out = master(0.25);
  const notes = [1046, 1318, 1568, 2093, 2637, 3136];
  notes.forEach((f, i) => ping(f, t + i * 0.09, 0.6, 0.5, out, "triangle"));
  for (let i = 0; i < 8; i++) ping(3000 + Math.random() * 2000, t + 0.5 + i * 0.07, 0.2, 0.15, out);
  return 1600;
}

function chime() {
  const t = ctx.currentTime;
  const out = master(0.22);
  const notes = [1568, 1318, 1046, 784, 1046];
  notes.forEach((f, i) => ping(f, t + i * 0.55, 1.6, 0.5, out, "sine"));
  return 3400;
}

// Tonalité d'appel (sonnerie française : 440 Hz).
function ringOnce() {
  const t = ctx.currentTime;
  const out = master(0.12);
  const o = ctx.createOscillator();
  o.frequency.value = 440;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.03);
  g.gain.setValueAtTime(1, t + 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 1.3);
}

const SOUNDS = { siren, howl, bells, roar, magic, chime };

export async function playSound(name) {
  unlockAudio();
  if (!ctx || !SOUNDS[name]) return;
  const ms = SOUNDS[name]();
  await wait(ms);
}

// Fait sonner jusqu'à ce que `until` soit résolue (au moins une sonnerie).
export async function ringUntil(until, isCancelled) {
  unlockAudio();
  if (!ctx) return until;
  let done = false;
  until.finally(() => (done = true));
  do {
    if (isCancelled()) return;
    ringOnce();
    await wait(1300);
    if (done) break;
    await wait(700);
  } while (!done);
}
