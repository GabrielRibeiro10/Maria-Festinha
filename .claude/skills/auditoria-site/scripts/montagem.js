// Junta as fotos de uma pasta em pranchas (várias por imagem) para olhar rápido quadro a quadro.
// Uso: node montagem.js <pasta> [--por=10] [--largura=200]
// Gera <pasta>/prancha-<grupo>-N.png usando o próprio Chromium (sem depender de Python).
const fs = require('fs'), path = require('path');
const { chromium, args } = require('./comum');
(async () => {
  const a = args(); const pasta = a._[0];
  if (!pasta) { console.log('uso: node montagem.js <pasta>'); process.exit(1); }
  const por = +(a.por || 10), larg = +(a.largura || 200);
  const fotos = fs.readdirSync(pasta).filter((f) => /\.png$/.test(f) && !f.startsWith('prancha-')).sort();
  const grupos = new Map();
  for (const f of fotos) { const g = f.replace(/-\d+\.png$/, '').replace(/\.png$/, ''); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(f); }
  const b = await chromium.launch(); const p = await b.newPage();
  for (const [g, fs_] of grupos) for (let k = 0; k < fs_.length; k += por) {
    const parte = fs_.slice(k, k + por);
    const html = `<body style="margin:0;background:#fff;display:flex;gap:6px;align-items:flex-start">${parte.map((f) =>
      `<img style="width:${larg}px" src="data:image/png;base64,${fs.readFileSync(path.join(pasta, f)).toString('base64')}">`).join('')}</body>`;
    await p.setViewportSize({ width: parte.length * (larg + 6), height: 400 }); await p.setContent(html);
    const out = path.join(pasta, `prancha-${g}-${k / por}.png`);
    await p.screenshot({ path: out, fullPage: true }); console.log(out);
  }
  await b.close();
})();
