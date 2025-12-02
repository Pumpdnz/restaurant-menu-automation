#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

async function compressImage(inputPath, outputPath, quality = 85) {
  const stats = await fs.stat(inputPath);
  const originalSize = stats.size;

  let image = sharp(inputPath);
  const metadata = await image.metadata();

  // Resize if too large
  if (metadata.width > 1920) {
    image = image.resize(1920, null, {
      withoutEnlargement: true,
      fit: 'inside'
    });
  }

  // Compress
  image = image.jpeg({
    quality,
    progressive: true,
    mozjpeg: true
  });

  await image.toFile(outputPath);

  const compressedSize = (await fs.stat(outputPath)).size;

  // If still > 1MB, reduce quality and retry
  if (compressedSize > 1048576 && quality > 50) {
    console.log(`  Reducing quality to ${quality - 10}...`);
    return compressImage(inputPath, outputPath, quality - 10);
  }

  return {
    originalSize,
    compressedSize,
    ratio: ((originalSize - compressedSize) / originalSize * 100).toFixed(1)
  };
}

async function main() {
  const inputDir = process.argv[2] || '../../planning/pdf-extraction/chaat-street-photos';
  const outputDir = process.argv[3] || './compressed-images';

  console.log('🗜️  Image Compression Tool\n');
  console.log(`Input:  ${path.resolve(inputDir)}`);
  console.log(`Output: ${path.resolve(outputDir)}\n`);

  await fs.mkdir(outputDir, { recursive: true });

  const images = glob.sync(path.join(inputDir, '*.{jpg,jpeg,JPG,JPEG}'));

  if (images.length === 0) {
    console.error('❌ No images found in input directory');
    process.exit(1);
  }

  console.log(`Found ${images.length} images\n`);

  let totalOriginal = 0;
  let totalCompressed = 0;
  const results = [];

  for (let i = 0; i < images.length; i++) {
    const inputPath = images[i];
    const filename = path.basename(inputPath);
    const outputPath = path.join(outputDir, filename);

    process.stdout.write(`[${i + 1}/${images.length}] ${filename}... `);

    try {
      const result = await compressImage(inputPath, outputPath);
      totalOriginal += result.originalSize;
      totalCompressed += result.compressedSize;

      console.log(`${(result.originalSize / 1024 / 1024).toFixed(1)}MB → ${(result.compressedSize / 1024).toFixed(0)}KB (${result.ratio}% saved)`);

      results.push({
        filename,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        ratio: result.ratio
      });
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Save report
  const report = {
    total: images.length,
    successful: results.length,
    totalOriginalSize: totalOriginal,
    totalCompressedSize: totalCompressed,
    averageRatio: ((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(1),
    results
  };

  await fs.writeFile(
    path.join(outputDir, 'compression-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`\n✅ Compression Complete!\n`);
  console.log(`Total:       ${images.length} images`);
  console.log(`Successful:  ${results.length}`);
  console.log(`Failed:      ${images.length - results.length}`);
  console.log(`Original:    ${(totalOriginal / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Compressed:  ${(totalCompressed / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Saved:       ${report.averageRatio}%`);
  console.log(`\n📄 Report saved: ${path.join(outputDir, 'compression-report.json')}`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
