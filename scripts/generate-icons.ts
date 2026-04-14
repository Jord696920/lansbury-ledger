import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const ICON_DIR = join(process.cwd(), 'public', 'icons');
if (!existsSync(ICON_DIR)) mkdirSync(ICON_DIR, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const appIcon = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#1B3A6B"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-weight="700"
        font-size="320" fill="white">R</text>
</svg>`;

const invoiceIcon = `<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" rx="20" fill="#1B3A6B"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-weight="400"
        font-size="56" fill="white">+</text>
</svg>`;

const taxIcon = `<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" rx="20" fill="#0A7B4F"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-weight="700"
        font-size="48" fill="white">$</text>
</svg>`;

async function generateIcons() {
  for (const size of sizes) {
    await sharp(Buffer.from(appIcon))
      .resize(size, size)
      .png()
      .toFile(join(ICON_DIR, `icon-${size}.png`));
    console.log(`  generated icon-${size}.png`);
  }

  await sharp(Buffer.from(invoiceIcon)).png().toFile(join(ICON_DIR, 'shortcut-invoice.png'));
  console.log('  generated shortcut-invoice.png');

  await sharp(Buffer.from(taxIcon)).png().toFile(join(ICON_DIR, 'shortcut-tax.png'));
  console.log('  generated shortcut-tax.png');

  console.log('done');
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
