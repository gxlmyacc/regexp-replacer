import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * 优化扩展图标：在不明显影响观感的前提下，尽量减小 PNG 体积。
 *
 * @returns 无返回值。
 */
async function main() {
  const iconPath = path.resolve(process.cwd(), 'icon', 'favicon.png');
  if (!fs.existsSync(iconPath)) {
    console.error(`icon not found: ${iconPath}`);
    process.exit(1);
  }

  const input = fs.readFileSync(iconPath);
  const img = sharp(input, { failOn: 'none' });
  const meta = await img.metadata();

  const out = await img
    // VS Code 扩展图标无需超大尺寸；缩放到更合理的尺寸以显著降低体积。
    .resize({ width: 256, height: 256, fit: 'inside', withoutEnlargement: true })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      effort: 10,
    })
    .toBuffer();

  fs.writeFileSync(iconPath, out);
  const beforeKB = (input.length / 1024).toFixed(2);
  const afterKB = (out.length / 1024).toFixed(2);
  const dim = meta.width && meta.height ? `${meta.width}x${meta.height}` : 'unknown';
  console.log(`optimized ${dim}: ${beforeKB} KB -> ${afterKB} KB`);
}

await main();

