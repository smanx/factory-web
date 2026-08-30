// Headless logic check: universal held-item moves + backpack move (no shift)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const uiSrc = fs.readFileSync(path.join(ROOT, 'js/ui/ui.js'), 'utf8');
const panelSrc = fs.readFileSync(path.join(ROOT, 'js/ui/ui-panel.js'), 'utf8');

function grab(src, name) {
  const idx = src.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('not found: ' + name);
  let i = src.indexOf('{', idx), depth = 0, end = -1;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } } }
  return src.slice(idx, end);
}

const prelude = [
  'var W=800,H=600,TILE=32,uiDirty=false;',
  'var ITEMS={iron:{name:"iron",stack:50},copper:{name:"copper",stack:50},coal:{name:"coal",stack:50}};',
  'var BUILD_DEFS={},FLUIDS=[];',
  'function stackSize(id){return (ITEMS[id]&&ITEMS[id].stack)||50;}',
  'function isInvOwnedItem(id){return !!ITEMS[id];}',
  'function invSlotCount(){return 80;}',
  'function playSfx(){}function refreshHotbar(){}function toast(){}',
  'function selItem(){return G.quickSel;}function isBlueprintItem(){return false;}',
  'var G={inv:new Map(),invSlots:[],sel:-1,quickSel:null,_clickMoveFrom:null,held:null,panelMode:null,panelEnt:null};',
  'function invStackCap(id){return stackSize(id);}',
  'function invUsedSlots(){var man=invManualCnt(),used=0;G.inv.forEach(function(cnt,id){if(cnt<=0)return;var m=man.get(id)||0;used+=Math.ceil(m/invStackCap(id))+Math.ceil((cnt-m)/invStackCap(id));});return used;}',
  'function invRoomFor(id,n,used,total){var cap=invStackCap(id),cur=G.inv.get(id)||0,man=invManualCnt(),m=man.get(id)||0,auto=Math.max(0,cur-m);var as=auto>0?Math.ceil(auto/cap):0;var free=Math.max(0,total-used);return (as*cap-auto)+free*cap;}',
  'function invAdd(id,n){n=n||1;var cur=G.inv.get(id)||0,total=invSlotCount();var maxAdd=invRoomFor(id,n,invUsedSlots(),total);var add=Math.max(0,Math.min(n,maxAdd));if(add<=0)return 0;G.inv.set(id,cur+add);return add;}',
  'function invCount(id){return G.inv.get(id)||0;}',
  'function invTake(id,n){n=n||1;var c=invCount(id);if(c<n)return false;var left=c-n;if(left<=0)G.inv.delete(id);else G.inv.set(id,left);if(Array.isArray(G.invSlots)){var sum=0;for(var q=0;q<G.invSlots.length;q++){var z=G.invSlots[q];if(z&&z.id===id)sum+=z.count;}var ex=sum-left;for(var i=0;i<G.invSlots.length&&ex>0;i++){var t=G.invSlots[i];if(t&&t.id===id){var cut=Math.min(t.count,ex);t.count-=cut;ex-=cut;if(t.count<=0)G.invSlots[i]=null;}}}return true;}',
].join('\n');

const fns = ['invExpandStacks','invManualCnt','invSlotLayout','invSlotIdAt','invStackSlots','invSlotSig']
  .map(n => grab(uiSrc, n)).join('\n');
const pfn = ['invFreezeStacks','moveInvItemToSlot','swapInvSlots','heldInvPickup','heldInvDropToSlot','heldValid','heldSrcRemove','pickupHeld','heldReturn','heldTake','depositToChestSlot','depositToInvSlot','depositToMachineInput','depositToMachineOutput','placeHeld']
  .map(n => grab(panelSrc, n)).join('\n');

const body = fs.readFileSync(path.join(__dirname, '_held-move-asserts.js'), 'utf8');

const sandbox = { console, JSON, process };
vm.createContext(sandbox);
vm.runInContext(prelude + '\n' + fns + '\n' + pfn + '\n' + body, sandbox);
