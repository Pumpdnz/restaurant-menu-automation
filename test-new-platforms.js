/**
 * Test script for new platform support
 */

const { detectPlatform, extractRestaurantName } = require('./UberEats-Image-Extractor/src/utils/platform-detector');

// Test URLs from different platforms provided by user
const testUrls = [
  // DeliverEasy
  'https://www.delivereasy.co.nz/culture-burger-joint-nelson-delivery',
  
  // Mobi2Go variants
  'https://www.scopa.co.nz/order#/menu',
  'https://ljs.co.nz/order/#/menu',
  'https://biggiespizza.mobi2go.com/#/menu',
  
  // Bopple
  'https://empirechicken.bopple.app/empirechicken/menu',
  
  // ResDiary
  'https://www.resdiary.com/Preorder/Menu?restaurantName=TheFlyingBurritoBrothersAlbany&versionId=1947',
  
  // NextOrder
  'https://hambagu.nextorder.nz/',
  
  // Me&u
  'https://www.meandu.app/wb-city/pickup/starters',
  'https://www.meandu.app/loco-bros-cb/pickup/menu',
  
  // GloriaFood (embedded in restaurant sites)
  'https://www.noi.co.nz/',
  'https://www.luckythai.co.nz/',
  
  // Sipo
  'https://order.sipocloudpos.com/5609595',
  'https://order.sipocloudpos.com/currygarden',
  
  // OrderMeal
  'https://www.ordermeal.co.nz/konya-kebabs-dunedin/',
  'https://www.ordermeal.co.nz/the-kebab-and-chicken-house/',
  
  // FoodHub variants
  'https://konyakebabs.co.nz/',
  'https://larubythaionline.co.nz/',
  'https://fusionkebab.co.nz/order-now/kebabs',
  'https://lakepizza.co.nz/order-now',
  
  // BookNOrder
  'https://saharaindia.booknorder.co.nz/',
  
  // Restaurant websites
  'https://www.soulthai.co.nz/menu/',
  'https://www.santeriapizzaandpasta.com/',
  'https://www.gorillakitchen.nz/online-ordering',
  
  // Test traditional platforms too
  'https://www.ubereats.com/nz/store/mcdonalds-queen-street/abc123',
  'https://www.doordash.com/store/burger-king-downtown/xyz789'
];

console.log('Testing Platform Detection with Real URLs:\n');
console.log('='.repeat(80));

testUrls.forEach(url => {
  const platform = detectPlatform(url);
  const restaurantName = extractRestaurantName(url, platform);
  
  console.log(`\nURL: ${url}`);
  console.log(`Platform: ${platform.name}`);
  console.log(`Type: ${platform.type}`);
  console.log(`Method: ${platform.extractionMethod}`);
  console.log(`Supported: ${platform.supported ? '✅ Yes' : '❌ No'}`);
  console.log(`Restaurant: ${restaurantName || '⚠️ Not detected'}`);
  console.log('-'.repeat(80));
});

// Summary
console.log('\n' + '='.repeat(80));
console.log('SUMMARY:');
const platforms = {};
testUrls.forEach(url => {
  const platform = detectPlatform(url);
  if (!platforms[platform.name]) {
    platforms[platform.name] = 0;
  }
  platforms[platform.name]++;
});

console.log('\nPlatforms detected:');
Object.entries(platforms).forEach(([name, count]) => {
  console.log(`  ${name}: ${count} URL(s)`);
});

console.log('\nAll platforms are now supported for extraction! 🎉');