// runs inside vm sandbox; uses globals defined by the loader
var pass = 0, fail = 0;
function eq(a, b, msg) { var A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) pass++; else { fail++; console.log('FAIL', msg, 'got', A, 'want', B); } }
function mkChest() { return { type:'chest', limits:{}, slots:[null,null,null], slotCap:function(){return 3;}, countOf:function(it){var n=0;for(var i=0;i<this.slots.length;i++){var s=this.slots[i];if(s&&s.item===it)n+=s.count;}return n;}, giveItem:function(it){for(var i=0;i<this.slots.length;i++){var s=this.slots[i];if(s&&s.item===it&&s.count<stackSize(it)){s.count++;return true;}}for(var j=0;j<this.slots.length;j++)if(!this.slots[j]){this.slots[j]={item:it,count:1};return true;}return false;} }; }

// Part B: backpack move keeps others in place
G.inv = new Map([['iron',10],['copper',10],['coal',10]]); G.invSlots = ['iron','copper','coal'];
moveInvItemToSlot(0, 3);
eq(G.invSlots.slice(0,3), [null,{id:'copper',count:10},{id:'coal',count:10}], 'B1 no-shift forward');
moveInvItemToSlot(3, 0);
eq(G.invSlots.slice(0,3), [{id:'iron',count:10},{id:'copper',count:10},{id:'coal',count:10}], 'B2 move back');
swapInvSlots(0,1);
eq(G.invSlots.slice(0,3), [{id:'copper',count:10},{id:'iron',count:10},{id:'coal',count:10}], 'B3 swap keeps third');

// Part A: chest -> backpack
G.inv = new Map(); G.invSlots = []; G.held = null;
var c = mkChest(); c.slots[1] = { item:'iron', count:30 };
pickupHeld('iron', 30, { kind:'chest', ent:c, slot:1 });
eq(c.slots[1], null, 'A1 pickup removes from slot');
eq(G.held.count, 30, 'A1 held count');
placeHeld({ kind:'inv' });
eq(invCount('iron'), 30, 'A2 to backpack');
eq(G.held, null, 'A2 held cleared');

// Part A: chest -> chest empty slot
G.inv = new Map(); G.invSlots = []; G.held = null;
c = mkChest(); c.slots[0] = { item:'coal', count:5 };
pickupHeld('coal', 5, { kind:'chest', ent:c, slot:0 });
placeHeld({ kind:'chest', ent:c, slot:2 });
eq(c.slots[0], null, 'A3 source empty');
eq(c.slots[2] && c.slots[2].count, 5, 'A3 target got stack');
eq(G.held, null, 'A3 cleared');

// Part A: chest swap different items + cancel returns
G.inv = new Map(); G.invSlots = []; G.held = null;
c = mkChest(); c.slots[0] = { item:'coal', count:5 }; c.slots[1] = { item:'iron', count:7 };
pickupHeld('coal', 5, { kind:'chest', ent:c, slot:0 });
placeHeld({ kind:'chest', ent:c, slot:1 });
eq(c.slots[1] && c.slots[1].item, 'coal', 'A4 target now coal');
eq(G.held && G.held.id, 'iron', 'A4 held now iron');
eq(G.held && G.held.src.slot, 0, 'A4 new held src = slot0');
heldReturn();
eq(c.slots[0] && c.slots[0].item, 'iron', 'A5 cancel returns iron to slot0');
eq(G.held, null, 'A5 cleared');

// Part A: machine output -> backpack
G.inv = new Map(); G.invSlots = []; G.held = null;
var m = { outp:{ copper:12 }, inp:{}, giveItem:function(it){ this.inp[it]=(this.inp[it]||0)+1; return true; } };
pickupHeld('copper', 12, { kind:'mout', ent:m, sid:'copper' });
eq(m.outp.copper, undefined, 'A6 product removed');
placeHeld({ kind:'inv' });
eq(invCount('copper'), 12, 'A6 to backpack');

// Part A: machine input -> another machine input
G.inv = new Map(); G.invSlots = []; G.held = null;
var m1 = { outp:{}, inp:{ coal:8 }, giveItem:function(it){ this.inp[it]=(this.inp[it]||0)+1; return true; } };
var m2 = { outp:{}, inp:{}, giveItem:function(it){ this.inp[it]=(this.inp[it]||0)+1; return true; } };
pickupHeld('coal', 8, { kind:'min', ent:m1, sid:'coal' });
eq(m1.inp.coal, undefined, 'A7 input removed');
placeHeld({ kind:'min', ent:m2 });
eq(m2.inp.coal, 8, 'A7 into other machine input');
eq(G.held, null, 'A7 cleared');

// Part A: deposit to backpack (multi-group capacity: all fits)
G.inv = new Map([['iron',45]]); G.invSlots = []; G.held = null;
c = mkChest(); c.slots[0] = { item:'iron', count:30 };
pickupHeld('iron', 30, { kind:'chest', ent:c, slot:0 });
placeHeld({ kind:'inv' });
eq(invCount('iron'), 75, 'A8 all deposited to backpack');
eq(G.held, null, 'A8 held cleared');

// Part C: backpack hand<->slot swap (source stays empty, displaced item to hand)
G.inv = new Map([['iron',10],['copper',10],['coal',10]]); G.invSlots = ['iron','copper','coal']; G.held = null; G.quickSel = null;
heldInvPickup(0);
eq(G.invSlots.slice(0,3), [null,{id:'copper',count:10},{id:'coal',count:10}], 'C1 pickup empties source');
eq(G.held && G.held.id, 'iron', 'C1 hand holds iron');
heldInvDropToSlot(1);   // swap hand(iron) with slot1(copper)
eq(G.invSlots.slice(0,3), [null,{id:'iron',count:10},{id:'coal',count:10}], 'C2 source empty, target=iron, others fixed');
eq(G.held && G.held.id, 'copper', 'C2 hand now holds displaced copper');
eq(G.held && G.held.src.slot, 1, 'C2 displaced home = target slot');
heldInvDropToSlot(2);   // swap hand(copper) with slot2(coal)
eq(G.invSlots.slice(0,3), [null,{id:'iron',count:10},{id:'copper',count:10}], 'C3 chain swap keeps positions');
eq(G.held && G.held.id, 'coal', 'C3 hand now coal');
heldReturn();           // cancel -> coal back to backpack
eq(invCount('coal'), 10, 'C4 cancel returns to backpack');
eq(G.held, null, 'C4 cleared');

// Part C: backpack move to empty slot (no swap)
G.inv = new Map([['iron',10],['copper',10]]); G.invSlots = ['iron','copper']; G.held = null;
heldInvPickup(0);
heldInvDropToSlot(5);   // empty far slot
eq(G.invSlots[0], null, 'C5 source empty');
eq(G.invSlots[5], {id:'iron',count:10}, 'C5 placed at target');
eq(G.held, null, 'C5 deposited, hand empty');

// Part D: multi-group same item (stack 50) — lifting one group keeps the others
G.inv = new Map([['iron',120]]); G.invSlots = ['iron']; G.held = null; G.quickSel = null;   // 3 groups: 50,50,20
heldInvPickup(0);
eq(G.held && G.held.count, 50, 'D1 lift only first group (50)');
eq(invCount('iron'), 70, 'D1 backpack keeps remaining 70');
heldReturn();
eq(invCount('iron'), 120, 'D2 cancel restores full 120');
eq(G.held, null, 'D2 cleared');
heldInvPickup(2);   // the 20-group
eq(G.held && G.held.count, 20, 'D3 lift only the 20 group');
eq(invCount('iron'), 100, 'D3 backpack keeps 100');
heldReturn();

// Part D4: lift one group then drop onto empty slot -> the moved group is independent,
// other groups of the same item stay in place (regression: all same items must NOT pile up)
G.inv = new Map([['iron',120]]); G.invSlots = ['iron']; G.held = null; G.quickSel = null;
heldInvPickup(0);                 // lift 50, inv 70, remaining groups stay at slots 1/2
eq(G.invSlots.slice(0,3), [null,{id:'iron',count:50},{id:'iron',count:20}], 'D4a other groups untouched');
heldInvDropToSlot(3);             // drop onto empty slot 3
eq(invCount('iron'), 120, 'D4 total restored');
eq(G.invSlots[3], {id:'iron',count:50}, 'D4b moved group sits alone at target');
eq(G.invSlots.filter(function(x){return x&&x.id==='iron';}).length, 3, 'D4c three independent iron stacks');
eq(G.held, null, 'D4 cleared');

// Part D5: drop onto a same-item stack merges only that clicked stack, others unaffected
G.inv = new Map([['iron',120]]); G.invSlots = ['iron']; G.held = null; G.quickSel = null;
heldInvPickup(2);                 // lift the 20-group
heldInvDropToSlot(0);             // merge into the first 50-group only
eq(G.invSlots[0], {id:'iron',count:70}, 'D5 clicked stack merged to 70');
eq(G.invSlots[1], {id:'iron',count:50}, 'D5 other stack stays 50');
eq(invCount('iron'), 120, 'D5 total kept');
eq(G.held, null, 'D5 cleared');

// Part E: picking an AUTO item must NOT shift the items after it (leave empty placeholder)
G.inv = new Map([['iron',10],['copper',10],['coal',10]]); G.invSlots = ['iron']; G.held = null; G.quickSel = null;
// visual: 0=iron(manual) 1=copper(auto) 2=coal(auto)
heldInvPickup(1);                 // pick copper (auto, slot1)
eq(invCount('copper'), 0, 'E1 copper lifted');
eq(G.invSlots[0], {id:'iron',count:10}, 'E2 iron stays at 0');
eq(G.invSlots[1], null, 'E3 slot1 left as empty placeholder');
eq(G.invSlots[2], {id:'coal',count:10}, 'E4 coal stays at 2 (no forward shift)');
eq(invStackSlots().length, 80, 'E4b invStackSlots pads to total');
eq(invStackSlots()[1], {id:null,count:0}, 'E4c null slot normalized to empty stack');
eq(typeof invSlotSig(), 'string', 'E4d invSlotSig survives null manual slots');
heldReturn();                     // cancel -> copper back, no reflow of others
eq(invCount('copper'), 10, 'E5 copper restored');

// Part F: click same slot again = put back in place AND clear cursor selection
G.inv = new Map([['iron',10],['copper',10]]); G.invSlots = ['iron','copper']; G.held = null; G.quickSel = null; G.sel = -1;
heldInvPickup(0);
eq(G.quickSel, 'iron', 'F1 pickup keeps ghost selection');
heldInvDropToSlot(0);             // click the same source slot = return in place
eq(G.invSlots[0], {id:'iron',count:10}, 'F2 returned to original slot');
eq(G.held, null, 'F2 held cleared');
eq(G.quickSel, null, 'F2 cursor selection cleared (no lingering held item)');

// Part G: chest -> clicked EMPTY backpack slot must land exactly on that slot (not first free)
G.inv = new Map(); G.invSlots = []; G.held = null; G.quickSel = null;
c = mkChest(); c.slots[0] = { item:'iron', count:30 };
pickupHeld('iron', 30, { kind:'chest', ent:c, slot:0 });
placeHeld({ kind:'inv', slot:5 });
eq(G.invSlots[5], {id:'iron',count:30}, 'G1 landed on clicked slot 5');
eq(G.invSlots[0], null, 'G1 earlier slots stay empty');
eq(invCount('iron'), 30, 'G1 total added');
eq(G.held, null, 'G1 cleared');

// Part G2: chest -> occupied backpack slot with different item = whole-stack swap
G.inv = new Map([['iron',10]]); G.invSlots = [{id:'iron',count:10}]; G.held = null; G.quickSel = null;
c = mkChest(); c.slots[0] = { item:'coal', count:5 };
pickupHeld('coal', 5, { kind:'chest', ent:c, slot:0 });
placeHeld({ kind:'inv', slot:0 });
eq(G.invSlots[0], {id:'coal',count:5}, 'G2 clicked slot now holds held item');
eq(G.held && G.held.id, 'iron', 'G2 hand now holds displaced iron stack');
eq(invCount('iron'), 0, 'G2 iron left backpack into hand');
eq(invCount('coal'), 5, 'G2 coal in backpack');
heldReturn();
eq(invCount('iron'), 10, 'G3 cancel returns iron to backpack');
eq(G.invSlots[0], {id:'coal',count:5}, 'G3 coal stays at clicked slot');
eq(G.held, null, 'G3 cleared');

console.log((fail ? 'FAILED ' + fail : 'ALL PASS') + ' (' + pass + ' assertions)');
if (fail) process.exit(1);
