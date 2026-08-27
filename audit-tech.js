'use strict';
const rawObj = require('/workspace/tools/convert-data.js');
const fs = require('fs');
const techSrc = fs.readFileSync('/workspace/js/data/data-tech.js','utf8');
const techMatch = techSrc.match(/const [A-Z_]*TECH[A-Z_]*\s*=\s*\{([\s\S]*?)\n\};/g);
// Just count tech keys from data-tech-tree or data-tech
let techNames = new Set();
const re = /'([a-z0-9-]+)':\s*\{/g;
let mm;
while((mm=re.exec(techSrc))) {
  // heuristic: only pick known tech-like names
  if(/tech/.test(mm[1]) || ['electronics','logistics','automation','steel-processing','advanced-electronics','oil-processing','plastics','optics','military','rocket','nuclear','modules','electric-energy','advanced-material','advanced-oil-processing','flamethrower','turrets','gate','walls','land-mine','laser','military-science','physical-projectile-damage','weapon','mechanical','refined','engine','electric-engine','battery','explosives','sulfur','sulfuric-acid','circuit','computational','stack-inserter','logistic-science','chemical-science','production-science','utility-science','space-science','mining-productivity','research-productivity','fluid','cliff','rail','train','fast-transport','express-transport','construction','robotics','roboport','personal-roboport','night-vision','character','toolbelt','energy-shield','battery-equipment','solar-panel-equipment','exoskeleton','discharge','personal-laser','fusion-reactor-equipment','spidertron','artillery','uranium','kovarex','concrete','landfill','tanks','power-armor','armor','combat','defense','speed-module','productivity-module','efficiency-module','quality','recycling','elevated','turbo','space','electromagnetic','metallurgy','agricultural','cryogenic','promethium','fusion','heating','lightning','bio','holmium','tungsten','aquilo','gleba','vulcanus','fulgora','foundation','ice-platform','stack','loader'].some(x=>mm[1].includes(x))){
    techNames.add(mm[1]);
  }
}
console.log('project tech (approx):', techNames.size);
const officialTech = rawObj.technology || {};
console.log('official tech:', Object.keys(officialTech).length);
