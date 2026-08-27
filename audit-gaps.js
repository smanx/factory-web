'use strict';
const rawObj = require('/workspace/tools/convert-data.js');
const fs = require('fs');

// Load project recipes from data-recipes.js
const recSrc = fs.readFileSync('/workspace/js/data/data-recipes.js','utf8');
const m = recSrc.match(/const RECIPES = \{([\s\S]*?)\n\};/);
const block = m[1];
const projRecipes = [];
const km = /^\s*'([^']+)'\s*:/gm;
let mm;
while((mm=km.exec(block))) projRecipes.push(mm[1]);

// Official recipes
const officialRecipes = rawObj.recipe || {};
const offKeys = Object.keys(officialRecipes);

// Which official recipes are NOT in project
const missing = offKeys.filter(k => !projRecipes.includes(k));
console.log('official recipes:', offKeys.length);
console.log('project recipes:', projRecipes.length);
console.log('official recipes NOT in project:', missing.length);
console.log(missing.join(', '));
