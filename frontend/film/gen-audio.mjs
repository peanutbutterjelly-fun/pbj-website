// node film/gen-audio.mjs -> film/out/audio.wav (synthesized, on the beat grid) + film/beats.js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(dir + '/beats.json'));
const BEAT = cfg.beatSec, SR = 44100, DUR = cfg.duration, N = SR * DUR, NB = DUR / BEAT;
const beats = [...Array(NB)].map((_, i) => +(i * BEAT).toFixed(4));
writeFileSync(dir + '/beats.js', 'const BEATS = ' + JSON.stringify({ ...cfg, beats }) + ';\n');
mkdirSync(dir + '/out', { recursive: true });

let seed = 1234567;
const rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const noise = () => rand() * 2 - 1;
const L = new Float32Array(N), R = new Float32Array(N);
const duck = new Float32Array(N).fill(1);
const mix = (t0, len, fn, gain = 1, pan = 0, ducked = false) => {
  const i0 = Math.round(t0 * SR), n = Math.round(len * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n && i0 + i < N; i++) {
    if (i0 + i < 0) continue;
    const s = fn(i / SR, i) * (ducked ? duck[i0 + i] : 1);
    L[i0 + i] += s * gl; R[i0 + i] += s * gr;
  }
};
for (let b = 0; b < NB; b++) { const i0 = Math.round(b * BEAT * SR); for (let i = 0; i < SR * .5 && i0 + i < N; i++) duck[i0 + i] = Math.min(duck[i0 + i], 1 - .85 * Math.exp(-(i / SR) * 9)); }

const kick = (t0, g = 1) => { let ph = 0; mix(t0, .4, (x) => { ph += TAU(48 + 130 * Math.exp(-x * 28)) / SR; return (Math.sin(ph) * Math.exp(-x * 7) + (x < .004 ? noise() * .5 : 0)) * 1.1; }, g); };
const TAUc = Math.PI * 2; function TAU(f) { return TAUc * f; }
const clap = (t0, g = 1) => { let p = 0; mix(t0, .3, (x) => { const n = noise(), h = n - p; p = n; const e = Math.exp(-x * 16) + .7 * Math.exp(-Math.max(0, x - .012) * 40) * (x > .012) + .5 * Math.exp(-Math.max(0, x - .024) * 40) * (x > .024); return h * e * .55; }, g, .1); };
const hat = (t0, g = 1, len = .06) => { let p = 0; mix(t0, len + .02, (x) => { const n = noise(), h = n - p; p = n; return h * Math.exp(-x * (len > .1 ? 18 : 60)) * .28; }, g, rand() * .6 - .3); };
const bass = (t0, f, len = .22, g = 1) => mix(t0, len, (x) => (Math.sin(TAUc * f * x) + .35 * Math.sin(TAUc * f * 2 * x)) * Math.min(1, x / .006) * Math.exp(-x * 5) * .55, g, 0, true);
const saw = (f, x, h = 7) => { let s = 0; for (let k = 1; k <= h; k++) s += Math.sin(TAUc * f * k * x) / k; return s; };
const arp = (t0, f, g = 1, pan = 0) => mix(t0, .22, (x) => saw(f, x) * Math.min(1, x / .003) * Math.exp(-x * 13) * .16, g, pan, true);
const blip = (t0, f) => mix(t0, .16, (x) => Math.sign(Math.sin(TAUc * f * x)) * Math.exp(-x * 20) * .13, 1, 0);
const riser = (t0, len) => { let y = 0; mix(t0, len, (x) => { const u = x / len; y += (.015 + .85 * u * u) * (noise() - y); return y * Math.pow(u, 1.4) * .9; }, 1, 0); };
const impact = (t0, g = 1) => { let ph = 0, y = 0; mix(t0, 1.6, (x) => { ph += TAUc * (38 + 70 * Math.exp(-x * 9)) / SR; y += .08 * (noise() - y); return (Math.sin(ph) * Math.exp(-x * 2.6) * .9 + y * Math.exp(-x * 7) * .9); }, g); };
const chord = (t0, len) => [220, 261.63, 329.63, 440, 110].forEach((f, i) => mix(t0, len, (x) => saw(f * (1 + (i - 2) * .002), x, 9) * Math.exp(-x * 2.2) * .07, 1, (i - 2) * .3));

const PENT = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 659.25];
const BASS = [55, 55, 65.41, 55, 82.41, 55, 73.42, 55];
const at = (b) => b * BEAT;
for (let b = 0; b < NB; b++) {
  kick(at(b), b >= 28 ? .7 : 1);
  if (b < 4) blip(at(b), [220, 261.63, 329.63, 440][b]);
  if (b % 2 === 1 && b < 28) clap(at(b), b >= 20 ? 1.1 : .8);
  if (b >= 4 && b < 28) hat(at(b) + BEAT / 2, .9, b % 4 === 3 ? .14 : .06);
  if (b >= 20 && b < 28) { hat(at(b) + BEAT / 4, .6); hat(at(b) + BEAT * .75, .6); }
  if (b >= 4 && b < 28) for (let h = 0; h < 2; h++) bass(at(b) + h * BEAT / 2, BASS[((b % 4) * 2 + h) % 8]);
  if (b >= 12 && b < 28) for (let s = 0; s < 4; s++) {
    const idx = b >= 24 ? (b - 24) * 4 + s : Math.floor(rand() * 8);
    arp(at(b) + s * BEAT / 4, PENT[idx % 8] * (b >= 24 ? 2 : 1), b >= 20 ? 1 : .6, s % 2 ? .5 : -.5);
  }
  if (b >= 26 && b < 28) { clap(at(b) + BEAT / 4, .6); clap(at(b) + BEAT * .75, .8); }
}
for (const s of cfg.scenes.slice(1)) { riser(s - BEAT, BEAT); impact(s - .02, s === 14 ? 1.4 : 1); }
chord(14, 1.0);
kick(14.5, .8);
writeFileSync(dir + '/out/beat-check.txt', 'beats ' + NB + ' scenes ' + cfg.scenes.join(',') + '\n');

let peak = 0;
for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.1); R[i] = Math.tanh(R[i] * 1.1); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
const k = .89 / peak;
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * k * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * k * 32767), 46 + i * 4); }
writeFileSync(dir + '/out/audio.wav', buf);
console.log('audio written, peak', peak.toFixed(2));
