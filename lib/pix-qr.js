'use strict';
// QRCode for JavaScript by Kazuhiko Arase, MIT license (see lib/vendor/QRCode/index.js).
// Self-contained QR fallback: no third-party QR website sees the PIX code.
const QRCode = require('./vendor/QRCode');
const Levels = require('./vendor/QRCode/QRErrorCorrectLevel');
function pixQrSvgDataUrl(text) {
  if (typeof text !== 'string' || !text || text.length>2500) return null;
  const qr = new QRCode(-1, Levels.M);
  qr.addData(text);
  qr.make();
  const count=qr.getModuleCount();
  let paths='';
  for(let r=0;r<count;r++)for(let c=0;c<count;c++){
    if(qr.isDark(r,c))paths+=`M${c+4} ${r+4}h1v1h-1z`;
  }
  const w=count+8;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}" shape-rendering="crispEdges"><rect width="${w}" height="${w}" fill="#fff"/><path d="${paths}" fill="#111"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
module.exports={pixQrSvgDataUrl};
