'use strict';
const rawObj = require('/workspace/tools/convert-data.js');
const fs = require('fs');
// Load project ITEMS keys
const itemsSrc = fs.readFileSync('/workspace/js/data/data-items.js','utf8');
const m = itemsSrc.match(/const ITEMS = \{([\s\S]*?)\n\};/);
const itemKeys = new Set();
const km = /^\s*'([^']+)'\s*:/gm;
let mm;
while((mm=km.exec(m[1]))) itemKeys.add(mm[1]);

// Space Age items: check which official space-age items are NOT in project
// Determine which items are from space-age data (by checking where they're defined)
const saItems = [];
for (const proto of ['item','fluid','ammo','module','equipment','armor','gun','capsule','module']) {
  const list = rawObj[proto]||{};
  for (const name of Object.keys(list)) {
    // Heuristic: space-age items that are craftable/useful and not already present
    if (!itemKeys.has(name)) {
      saItems.push(name);
    }
  }
}
console.log('official prototypes NOT in project (candidates):');
console.log(saItems.join(', '));
