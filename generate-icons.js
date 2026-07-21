const sharp = require('sharp');

const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1A0A12"/>
      <stop offset="100%" style="stop-color:#3D0A20"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#D4AF37"/>
      <stop offset="100%" style="stop-color:#F5D060"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <text x="256" y="230" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="160" fill="#E8547A">G</text>
  <text x="256" y="400" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="80" fill="url(#gold)">Book</text>
  <circle cx="340" cy="140" r="24" fill="#D4AF37" opacity="0.8"/>
  <circle cx="370" cy="170" r="12" fill="#E8547A" opacity="0.6"/>
  <circle cx="150" cy="380" r="16" fill="#D4AF37" opacity="0.5"/>
</svg>`;

async function generate() {
  const buf = Buffer.from(svg);
  await sharp(buf).resize(512, 512).png().toFile('icons/icon-512.png');
  await sharp(buf).resize(192, 192).png().toFile('icons/icon-192.png');
  await sharp(buf).resize(180, 180).png().toFile('icons/apple-touch-icon.png');
  await sharp(buf).resize(32, 32).png().toFile('icons/favicon-32.png');
  console.log('Icons generated!');
}
generate();
