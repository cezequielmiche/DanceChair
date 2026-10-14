// Recibe píxeles RGBA (base64, de abajo hacia arriba, alfa premultiplicado) desde el teléfono y guarda PNG.
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const DEST = process.argv[2], TMP = process.argv[3];
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try {
      const { id, w, h, rgba } = JSON.parse(body);
      if (!/^[a-z0-9_-]+$/.test(id)) throw new Error('id inválido');
      const src = Buffer.from(rgba, 'base64');
      if (src.length !== w * h * 4) throw new Error(`tamaño ${src.length} != ${w * h * 4}`);
      const out = Buffer.alloc(src.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = ((h - 1 - y) * w + x) * 4, o = (y * w + x) * 4, a = src[i + 3];
          for (let c = 0; c < 3; c++) out[o + c] = a ? Math.min(255, Math.round((src[i + c] * 255) / a)) : 0;
          out[o + 3] = a;
        }
      }
      const raw = path.join(TMP, id + '.rgba');
      fs.writeFileSync(raw, out);
      const f = path.join(DEST, id + '.png');
      execFileSync('magick', ['-size', `${w}x${h}`, '-depth', '8', 'rgba:' + raw, '-trim', '+repage', f]);
      console.log('guardado', f, fs.statSync(f).size);
      res.end('ok');
    } catch (e) { console.log('error', e.message); res.statusCode = 400; res.end(e.message); }
  });
}).listen(8099, () => console.log('escuchando 8099'));
