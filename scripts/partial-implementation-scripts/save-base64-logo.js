#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

async function saveBase64Logo() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  await page.goto('https://www.noi.co.nz/');
  await page.waitForLoadState('networkidle');
  
  // Extract base64 and save directly
  const saved = await page.evaluate(() => {
    const img = document.querySelector('header img, nav img, .logo img, img[alt*="logo"], img[alt*="Noi"]');
    if (img && img.src.startsWith('data:image')) {
      const base64Data = img.src.split(',')[1];
      return base64Data;
    }
    return null;
  });
  
  if (saved) {
    // Decode base64 and save
    const buffer = Buffer.from(saved, 'base64');
    const outputPath = '/Users/giannimunro/Desktop/cursor-projects/automation/planning/downloaded-images/noi-ferrymead/logo-from-website.png';
    fs.writeFileSync(outputPath, buffer);
    console.log(`Logo saved to: ${outputPath}`);
  }
  
  await browser.close();
}

saveBase64Logo();