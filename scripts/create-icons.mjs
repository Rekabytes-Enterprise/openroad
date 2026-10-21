import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const source = await readFile('public/icons/icon.svg');
for (const size of [192, 512]) await sharp(source).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
await sharp(source).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png');
const padded = await sharp(source).resize(320, 320).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#305cf0' } }).composite([{ input: padded, gravity: 'center' }]).png().toFile('public/icons/maskable-512.png');
