/**
 * Gera os efeitos sonoros curtos (WAV 16-bit mono) a partir das mesmas notas do protótipo.
 * Uso: node scripts/generate-sounds.js
 */
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const SOUNDS = {
  coin: [880, 1175],
  up: [523, 659, 784, 1047],
  tap: [660],
};

function render(notes) {
  const step = 0.08;
  const len = 0.25;
  const total = Math.ceil((step * (notes.length - 1) + len) * RATE);
  const out = new Float32Array(total);
  notes.forEach((f, i) => {
    const start = Math.floor(i * step * RATE);
    for (let n = 0; n < len * RATE; n++) {
      const t = n / RATE;
      const phase = (t * f) % 1;
      const tri = 4 * Math.abs(phase - 0.5) - 1;
      const env = t < 0.01 ? t / 0.01 : Math.exp(-(t - 0.01) * 18);
      out[start + n] += tri * env * 0.28;
    }
  });
  return out;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const dir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(dir, { recursive: true });
for (const [name, notes] of Object.entries(SOUNDS)) {
  fs.writeFileSync(path.join(dir, `${name}.wav`), toWav(render(notes)));
}
console.log('sons gerados em', dir);
