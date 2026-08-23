'use strict';

function entKey(x, y) { return x + ',' + y; }
function entAt(x, y) { return G.grid.get(entKey(x, y)); }
function dirFromVec(dx, dy) {
  return dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3;
}

function addEnt(e) {
  G.ents.push(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++)
      G.grid.set(entKey(e.x + dx, e.y + dy), e);
}

function removeEnt(e) {
  const i = G.ents.indexOf(e);
  if (i >= 0) G.ents.splice(i, 1);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) {
      const k = entKey(e.x + dx, e.y + dy);
      if (G.grid.get(k) === e) G.grid.delete(k);
    }
}

function entContents(e) {
  const list = [[e.type, 1]];
  if (e instanceof Belt) for (const o of e.items) list.push([o.item, 1]);
  if (e instanceof Inserter && e.holding) list.push([e.holding, 1]);
  if (e instanceof Underground)
    for (const it of [...e.items, ...e.outItems]) list.push([it, 1]);
  if (e instanceof Drill) {
    if (e.fuelCoal > 0) list.push(['coal', e.fuelCoal]);
    if (e.bufN > 0 && e.bufItem) list.push([e.bufItem, e.bufN]);
  }
  if (e instanceof Boiler) {
    if (e.fuelCoal > 0) list.push(['coal', e.fuelCoal]);
  }
  if (e instanceof Furnace) {
    if (e.fuelCoal > 0) list.push(['coal', e.fuelCoal]);
    for (const k in e.inp) list.push([k, e.inp[k]]);
    for (const k in e.outp) list.push([k, e.outp[k]]);
  }
  if (e instanceof Assembler)
    for (const k in e.inp) list.push([k, e.inp[k]]);
  if (e instanceof Assembler || e instanceof Lab || e instanceof Refinery)
    for (const k in e.outp) list.push([k, e.outp[k]]);
  if (e instanceof Lab)
    for (const k in e.packs) if (e.packs[k] > 0) list.push([k, e.packs[k]]);
  if (e instanceof Refinery)
    for (const k in e.inp) list.push([k, e.inp[k]]);
  if (e instanceof Pipe)
    for (const k in e.fluid) if (e.fluid[k] > 0) list.push([k, e.fluid[k]]);
  if (e instanceof Chest) for (const s of e.slots) if (s) list.push([s.item, s.count]);
  return list;
}

class Entity {
  constructor(type, x, y) {
    this.type = type;
    this.def = BUILD_DEFS[type];
    this.w = this.def.w;
    this.h = this.def.h;
    this.x = x; this.y = y;
    this.dir = 0;
  }
  get solid() { return this.def.solid; }
  applyDir() { this.w = this.def.w; this.h = this.def.h; }
  update(dt) {}
  peekItem() { return null; }
  giveItem(item) { return false; }
  takeItem() { return null; }
  countOf(item) { return 0; }
  takeItemOf(item) { return null; }
  serialize() {
    return { type: this.type, x: this.x, y: this.y, dir: this.dir };
  }
  static restore(s) {
    const e = new this(s.type, s.x, s.y);
    e.dir = s.dir | 0;
    return e;
  }
}

class Belt extends Entity {
  constructor(type, x, y) {
    super(type || 'transport-belt', x, y);
    this.items = [];
  }
  speedMult() { return this.type === 'fast-transport-belt' ? FAST_BELT_MULT : 1; }
  update(dt) {
    const sp = beltSpeed() * this.speedMult() * dt;
    this.items.sort((a, b) => b.pos - a.pos);
    if (this.items.length && this.items[0].pos + sp >= 1) this.transferFront();
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      let lim = 1;
      if (i > 0) lim = Math.max(0, this.items[i - 1].pos - BELT_SPACING);
      it.pos = Math.min(it.pos + sp, lim);
      if (it.pos < 0) it.pos = 0;
    }
  }
  transferFront() {
    const f = this.items[0];
    const nx = this.x + DX[this.dir], ny = this.y + DY[this.dir];
    const nb = entAt(nx, ny);
    if (!nb) return false;
    if (nb instanceof Belt) {
      if (!(nb instanceof Splitter)) {
        if (nb.dir === ((this.dir + 2) % 4)) return false;
        let back = Infinity;
        for (const o of nb.items) back = Math.min(back, o.pos);
        if (back < BELT_SPACING) return false;
      }
      if (!nb.acceptItem(f.item, this.dir, this.x, this.y)) return false;
      this.items.shift();
      return true;
    }
    if ((nb instanceof Underground || nb instanceof Splitter) && nb.giveItem(f.item)) {
      this.items.shift();
      return true;
    }
    return false;
  }
  acceptItem(item, fromDir) {
    const candidates = [];
    if (fromDir !== undefined && fromDir !== null) {
      const rel = ((fromDir - this.dir) % 4 + 4) % 4;
      if (rel === 1 || rel === 3) candidates.push(0.45);
    }
    candidates.push(0);
    for (const p of candidates) {
      let ok = true;
      for (const o of this.items)
        if (Math.abs(o.pos - p) < BELT_SPACING) { ok = false; break; }
      if (ok) { this.items.push({ item, pos: p }); return true; }
    }
    return false;
  }
  grabZone(item) {
    let best = null;
    for (const o of this.items)
      if (o.pos >= 0.2 && (!item || o.item === item) && (!best || o.pos > best.pos)) best = o;
    return best;
  }
  countOf(item) {
    let n = 0;
    for (const o of this.items) if (o.pos >= 0.2 && o.item === item) n++;
    return n;
  }
  peekItem() {
    const z = this.grabZone();
    return z ? z.item : null;
  }
  takeOutput() {
    const z = this.grabZone();
    if (!z) return null;
    this.items.splice(this.items.indexOf(z), 1);
    return z.item;
  }
  serialize() {
    const s = super.serialize();
    s.items = this.items.map(o => [o.item, +o.pos.toFixed(3)]);
    return s;
  }
  static restore(s) {
    const b = super.restore(s);
    b.items = (s.items || []).map(a => ({ item: a[0], pos: a[1] }));
    return b;
  }
}

class Drill extends Entity {
  constructor(type, x, y) {
    super(type || 'burner-drill', x, y);
    this.fuelCoal = 0;
    this.burnLeft = 0;
    this.bufItem = null;
    this.buf = 0;
    this.prog = 0;
    this.working = false;
    this.status = '';
    this.spin = 0;
  }
  oreTile() {
    for (let dy = 0; dy < this.h; dy++)
      for (let dx = 0; dx < this.w; dx++) {
        const tx = this.x + dx, ty = this.y + dy;
        const ti = getOreType(tx, ty);
        if (ti >= 0 && ti < ORES.length && getOreAmt(tx, ty) > 0) return [tx, ty];
      }
    return null;
  }
  mineItem(o) { return ORES[getOreType(o[0], o[1])]; }
  frontTargets() {
    const res = [];
    if (this.dir === 0) for (let dy = 0; dy < this.h; dy++) res.push([this.x + this.w, this.y + dy]);
    else if (this.dir === 2) for (let dy = 0; dy < this.h; dy++) res.push([this.x - 1, this.y + dy]);
    else if (this.dir === 1) for (let dx = 0; dx < this.w; dx++) res.push([this.x + dx, this.y + this.h]);
    else for (let dx = 0; dx < this.w; dx++) res.push([this.x + dx, this.y - 1]);
    return res;
  }
  update(dt) {
    this.working = false;
    if (this.bufN === undefined) { this.bufN = 0; }
    if (this.bufItem === 'coal' && this.buf > 0 && this.fuelCoal < SELF_FUEL_MAX) {
      this.buf--;
      this.fuelCoal++;
      if (this.buf <= 0) this.bufItem = null;
    }
    if (this.buf > 0) this.tryOutput();
    const o = this.oreTile();
    if (!o) { this.status = '无矿'; this.spin = 0; return; }
    if (this.buf >= 20) { this.status = '缓存已满'; this.spin = 0; return; }
    if (this.burnLeft <= 0) {
      if (this.fuelCoal > 0) { this.fuelCoal--; this.burnLeft += COAL_ENERGY; }
      else { this.status = '缺燃料'; this.spin = 0; return; }
    }
    this.status = '';
    this.working = true;
    this.burnLeft -= dt;
    this.spin += dt * 6;
    this.prog += dt * drillMult();
    if (this.prog >= DRILL_TIME) {
      this.prog -= DRILL_TIME;
      if (!G.settings.infiniteOre) consumeOre(o[0], o[1]);
      const mined = this.mineItem(o);
      if (mined === 'coal' && this.fuelCoal < SELF_FUEL_MAX) {
        this.fuelCoal++;
      } else {
        this.bufItem = mined;
        this.buf++;
        this.tryOutput();
      }
    }
  }
  tryOutput() {
    let guard = 0;
    while (this.buf > 0 && this.bufItem && guard++ < 40) {
      let sent = false;
      for (const [fx, fy] of this.frontTargets()) {
        const t = entAt(fx, fy);
        if (!t) continue;
        if (t instanceof Belt && !(t instanceof Splitter)) {
          if (t.acceptItem(this.bufItem, this.dir)) { this.buf--; sent = true; break; }
        } else if (!(t instanceof Underground) && !(t instanceof Inserter) && !(t instanceof Splitter) && !(t instanceof Drill) && t.giveItem(this.bufItem)) {
          this.buf--; sent = true; break;
        }
      }
      if (!sent) break;
    }
  }
  giveItem(item) {
    if (item === 'coal' && this.fuelCoal < 10) { this.fuelCoal++; return true; }
    return false;
  }
  peekItem() {
    return (this.buf > 0 && this.bufItem) ? this.bufItem : null;
  }
  takeItem() {
    if (this.buf > 0 && this.bufItem) {
      this.buf--;
      const it = this.bufItem;
      return it;
    }
    return null;
  }
  countOf(item) { return (this.bufItem === item && this.buf > 0) ? this.buf : 0; }
  takeItemOf(item) {
    if (this.bufItem === item && this.buf > 0) { this.buf--; return item; }
    return null;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.burnLeft = this.burnLeft;
    s.bufItem = this.bufItem; s.buf = this.buf; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const d = super.restore(s);
    d.fuelCoal = s.fuelCoal || 0; d.burnLeft = s.burnLeft || 0;
    d.bufItem = s.bufItem || null; d.buf = s.buf || 0; d.prog = s.prog || 0;
    return d;
  }
}

class Furnace extends Entity {
  constructor(type, x, y) {
    super(type || 'stone-furnace', x, y);
    this.fuelCoal = 0;
    this.burnLeft = 0;
    this.inp = {};
    this.outp = {};
    this.cur = null;
    this.prog = 0;
    this.lit = false;
  }
  pickRecipe() {
    for (const r of SMELTS)
      if ((this.inp[r.inp] || 0) >= (r.inCount || 1) && (this.outp[r.id] || 0) < 25) return r;
    return null;
  }
  update(dt) {
    const r = this.pickRecipe();
    this.cur = r;
    if (!r) { this.prog = 0; this.lit = false; return; }
    if (this.burnLeft <= 0) {
      if (this.fuelCoal > 0) { this.fuelCoal--; this.burnLeft += COAL_ENERGY; }
      else { this.lit = false; return; }
    }
    this.lit = true;
    this.burnLeft -= dt;
    this.prog += dt / r.time;
    if (this.prog >= 1) {
      this.prog -= 1;
      this.inp[r.inp] = (this.inp[r.inp] || 0) - (r.inCount || 1);
      if (this.inp[r.inp] <= 0) delete this.inp[r.inp];
      this.outp[r.id] = (this.outp[r.id] || 0) + 1;
    }
  }
  giveItem(item) {
    if (item === 'coal' && this.fuelCoal < 20) { this.fuelCoal++; return true; }
    for (const r of SMELTS)
      if (r.inp === item && (this.inp[item] || 0) < 25) { this.inp[item] = (this.inp[item] || 0) + 1; return true; }
    return false;
  }
  peekItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.outp) {
      if (this.outp[k] > 0) {
        this.outp[k]--;
        if (this.outp[k] <= 0) delete this.outp[k];
        return k;
      }
    }
    return null;
  }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) {
    if ((this.outp[item] || 0) > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; }
    return null;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.burnLeft = this.burnLeft;
    s.inp = this.inp; s.outp = this.outp; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const f = super.restore(s);
    f.fuelCoal = s.fuelCoal || 0; f.burnLeft = s.burnLeft || 0;
    f.inp = s.inp || {}; f.outp = s.outp || {}; f.prog = s.prog || 0;
    return f;
  }
}

class Assembler extends Entity {
  constructor(type, x, y) {
    super(type || 'assembling-machine', x, y);
    this.recipe = null;
    this.inp = {};
    this.outp = {};
    this.crafting = false;
    this.prog = 0;
    this.spin = 0;
  }
  update(dt) {
    if (!this.recipe) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      this.prog += dt * asmMult();
      this.spin += dt * 4;
      if (this.prog >= rec.time) {
        for (const k in rec.out) this.outp[k] = (this.outp[k] || 0) + rec.out[k];
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    for (const k in rec.out) if ((this.outp[k] || 0) + rec.out[k] > 50) return;
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  setRecipe(id) {
    if (this.recipe === id) return;
    this.recipe = id;
    this.inp = {}; this.outp = {};
    this.crafting = false; this.prog = 0;
  }
  giveItem(item) {
    if (!this.recipe) return false;
    const rec = RECIPES[this.recipe];
    if (!rec.inp[item]) return false;
    if ((this.inp[item] || 0) >= 50) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    return true;
  }
  peekItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.outp) {
      if (this.outp[k] > 0) {
        this.outp[k]--;
        if (this.outp[k] <= 0) delete this.outp[k];
        return k;
      }
    }
    return null;
  }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) {
    if ((this.outp[item] || 0) > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; }
    return null;
  }
  serialize() {
    const s = super.serialize();
    s.recipe = this.recipe; s.inp = this.inp; s.outp = this.outp;
    s.crafting = this.crafting; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const a = super.restore(s);
    a.recipe = s.recipe || null; a.inp = s.inp || {}; a.outp = s.outp || {};
    a.crafting = !!s.crafting; a.prog = s.prog || 0;
    return a;
  }
}

class Chest extends Entity {
  constructor(type, x, y) {
    super('storage-chest', x, y);
    this.slots = [];
    this.limits = {};
  }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < 50) { s.count++; return true; }
    if (this.slots.length >= 12) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
  peekItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s) return s.item;
    }
    return null;
  }
  takeItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s) {
        const it = s.item;
        s.count--;
        if (s.count <= 0) this.slots.splice(i, 1);
        return it;
      }
    }
    return null;
  }
  countOf(item) {
    let n = 0;
    for (const st of this.slots) if (st && st.item === item) n += st.count;
    return n;
  }
  takeItemOf(item) {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const st = this.slots[i];
      if (st && st.item === item) {
        st.count--;
        if (st.count <= 0) this.slots.splice(i, 1);
        return item;
      }
    }
    return null;
  }
  serialize() {
    const s = super.serialize();
    s.slots = this.slots.map(v => v ? [v.item, v.count] : null);
    s.limits = this.limits;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.slots = (s.slots || []).map(v => v ? { item: v[0], count: v[1] } : null);
    c.limits = {};
    for (const k in (s.limits || {})) if (s.limits[k] > 0) c.limits[k] = s.limits[k];
    return c;
  }
}

class Lab extends Entity {
  constructor(type, x, y) {
    super('lab', x, y);
    this.packs = {};
    this.t = 0;
    this.active = false;
  }
  packCount(id) { return this.packs[id] || 0; }
  totalPacks() { let s = 0; for (const k in this.packs) s += this.packs[k]; return s; }
  nextNeed() {
    const tech = G.activeTech;
    if (!tech || G.techDone[tech]) return null;
    const list = techNeedList(tech);
    const done = G.techProg[tech] || 0;
    return done < list.length ? list[done] : null;
  }
  update(dt) {
    this.active = false;
    const tech = G.activeTech;
    if (!tech || G.techDone[tech]) { this.t = 0; return; }
    const list = techNeedList(tech);
    let done = G.techProg[tech] || 0;
    if (done >= list.length) {
      G.techDone[tech] = true;
      toast('研究完成：' + TECHS[tech].name);
      G.activeTech = null;
      if (typeof renderPanel === 'function') renderPanel(false);
      return;
    }
    const need = list[done];
    if (!need || this.packCount(need) <= 0) { this.t = 0; return; }
    this.active = true;
    this.t += dt;
    if (this.t >= LAB_TIME) {
      this.t -= LAB_TIME;
      this.packs[need]--;
      if (this.packs[need] <= 0) delete this.packs[need];
      done++;
      G.techProg[tech] = done;
      uiDirty = true;
      if (done >= list.length) {
        G.techDone[tech] = true;
        toast('研究完成：' + TECHS[tech].name);
        G.activeTech = null;
        if (typeof renderPanel === 'function') renderPanel(false);
      }
    }
  }
  giveItem(item) {
    if (isScience(item) && this.packCount(item) < 40) { this.packs[item] = this.packCount(item) + 1; return true; }
    return false;
  }
  peekItem() {
    for (const k of SCIENCE_PACKS) if (this.packCount(k) > 0) return k;
    return null;
  }
  takeItem() {
    for (const k of SCIENCE_PACKS) if (this.packCount(k) > 0) return this.takeItemOf(k);
    return null;
  }
  countOf(item) { return this.packCount(item); }
  takeItemOf(item) {
    if (this.packCount(item) > 0) {
      this.packs[item]--;
      if (this.packs[item] <= 0) delete this.packs[item];
      return item;
    }
    return null;
  }
  serialize() {
    const s = super.serialize();
    s.packs = this.packs; s.t = this.t;
    return s;
  }
  static restore(s) {
    const l = super.restore(s);
    l.packs = typeof s.packs === 'number' ? { 'science-pack': s.packs } : (s.packs || {});
    l.t = s.t || 0;
    return l;
  }
}

class Boiler extends Entity {
  constructor(type, x, y) {
    super('boiler', x, y);
    this.fuelCoal = 0;
    this.burnLeft = 0;
    this.lit = false;
  }
  update(dt) {
    if (this.burnLeft <= 0) {
      if (this.fuelCoal > 0) { this.fuelCoal--; this.burnLeft += COAL_ENERGY; }
      else { this.lit = false; return; }
    }
    this.lit = true;
    this.burnLeft -= dt;
  }
  giveItem(item) {
    if (item === 'coal' && this.fuelCoal < 20) { this.fuelCoal++; return true; }
    return false;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.burnLeft = this.burnLeft;
    return s;
  }
  static restore(s) {
    const b = super.restore(s);
    b.fuelCoal = s.fuelCoal || 0; b.burnLeft = s.burnLeft || 0;
    return b;
  }
}

class SteamEngine extends Entity {
  constructor(type, x, y) {
    super('steam-engine', x, y);
    this.spin = 0;
    this.on = false;
  }
  update(dt) {
    this.on = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const t = entAt(this.x + dx, this.y + dy);
      if (t instanceof Boiler && t.lit) { this.on = true; break; }
    }
    if (this.on) this.spin += dt * 8;
  }
}

class ElectricDrill extends Drill {
  constructor(type, x, y) { super(type || 'electric-drill', x, y); }
  machMult() { return elecMachMult(); }
  update(dt) {
    this.working = false;
    if (this.bufN === undefined) this.bufN = 0;
    if (this.buf > 0) this.tryOutput();
    const o = this.oreTile();
    if (!o) { this.status = '无矿'; this.spin = 0; return; }
    if (this.buf >= 20) { this.status = '缓存已满'; this.spin = 0; return; }
    if (G.power.sat <= 0) { this.status = '缺电'; this.spin = 0; return; }
    this.status = '';
    this.working = true;
    this.spin += dt * 6;
    this.prog += dt * drillMult() * this.machMult() * (G.power.sat < 1 ? G.power.sat : 1);
    if (this.prog >= DRILL_TIME) {
      this.prog -= DRILL_TIME;
      if (!G.settings.infiniteOre) consumeOre(o[0], o[1]);
      const mined = this.mineItem(o);
      this.bufItem = mined;
      this.buf++;
      this.tryOutput();
    }
  }
  giveItem(item) { return false; }
}

class ElectricFurnace extends Furnace {
  constructor(type, x, y) { super('electric-furnace', x, y); }
  update(dt) {
    const r = this.pickRecipe();
    this.cur = r;
    if (!r) { this.prog = 0; this.lit = false; return; }
    if (G.power.sat <= 0) { this.lit = false; return; }
    this.lit = true;
    this.prog += dt / r.time * 1.5 * elecMachMult() * (G.power.sat < 1 ? G.power.sat : 1);
    if (this.prog >= 1) {
      this.prog -= 1;
      this.inp[r.inp] = (this.inp[r.inp] || 0) - (r.inCount || 1);
      if (this.inp[r.inp] <= 0) delete this.inp[r.inp];
      this.outp[r.id] = (this.outp[r.id] || 0) + 1;
    }
  }
  giveItem(item) {
    if (item === 'coal') return false;
    for (const r of SMELTS)
      if (r.inp === item && (this.inp[item] || 0) < 25) { this.inp[item] = (this.inp[item] || 0) + 1; return true; }
    return false;
  }
}

class AssemblerMK2 extends Assembler {
  constructor(type, x, y) { super('assembling-machine-mk2', x, y); }
  update(dt) {
    if (!this.recipe) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      this.prog += dt * asmMult() * 1.5 * elecMachMult() * (G.power.sat < 1 ? G.power.sat : 1);
      this.spin += dt * 4;
      if (this.prog >= rec.time) {
        for (const k in rec.out) this.outp[k] = (this.outp[k] || 0) + rec.out[k];
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    for (const k in rec.out) if ((this.outp[k] || 0) + rec.out[k] > 50) return;
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
}

// 全局共享电力模型：每 0.25s 复算。产出=运行中蒸汽机之和，需求=正在作业的用电机器之和，
// sat = min(1, prod/demand)，各机器按 sat 比例降速；sat=0 全图"缺电"停摆。
function updatePower() {
  let prod = 0, demand = 0;
  for (const e of G.ents) {
    if (e instanceof SteamEngine) {
      if (e.on) prod += POWER_PER_ENGINE;
    } else if (e instanceof Pumpjack) {
      if (e.oreTile() && e.buf < 20) demand += POWER_USE['pumpjack'];
    } else if (e instanceof ElectricDrill) {
      if (e.oreTile() && e.buf < 20) demand += POWER_USE['electric-drill'];
    } else if (e instanceof Refinery) {
      if ((e.inp['crude-oil'] || 0) >= 2) demand += POWER_USE['refinery'];
    } else if (e instanceof ElectricFurnace) {
      if (e.cur) demand += POWER_USE['electric-furnace'];
    } else if (e.type === 'assembling-machine-mk2') {
      if (e.recipe) demand += POWER_USE['assembling-machine-mk2'];
    }
  }
  G.power.prod = prod;
  G.power.demand = demand;
  G.power.sat = demand <= 0 ? 1 : Math.min(1, prod / demand);
}

function angNorm(a) {
  return ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}
function approachAng(a, t, step) {
  const d = angNorm(t - a);
  if (Math.abs(d) < 1e-9) return t;
  const m = Math.min(Math.abs(d), step);
  return a + Math.sign(d) * m;
}
class Inserter extends Entity {
  constructor(type, x, y) {
    super(type || 'inserter', x, y);
    this.reach = 1;      // 触及距离（格），长臂子类改为 2
    this.holding = null;
    this.holdingCount = 0;
    this.stackMax = 1;   // 堆叠臂改为 3
    this.filter = null;  // 过滤臂：只抓该物品
    this.blocked = false;
    this.armAng = undefined;
  }
  // ===== 几何：严格单向，取格 = 箭头反方向，放格 = 箭头方向 =====
  pickOffset() {
    const d = (this.dir + 2) % 4;
    return { dx: DX[d] * this.reach, dy: DY[d] * this.reach };
  }
  dropOffset() {
    return { dx: DX[this.dir] * this.reach, dy: DY[this.dir] * this.reach };
  }
  pickAng() { const o = this.pickOffset(); return Math.atan2(o.dy, o.dx); }
  dropAng() { const o = this.dropOffset(); return Math.atan2(o.dy, o.dx); }
  entAtPick() {
    const o = this.pickOffset();
    const x = this.x + o.dx, y = this.y + o.dy;
    const e = entAt(x, y);
    return (e && !(e instanceof Inserter)) ? e : null;
  }
  entAtDrop() {
    const o = this.dropOffset();
    const x = this.x + o.dx, y = this.y + o.dy;
    const e = entAt(x, y);
    return (e && !(e instanceof Inserter)) ? e : null;
  }
  // ===== 取物 =====
  peekSource(s) {
    if (!s) return null;
    let it = null;
    if (s instanceof Belt) {
      const z = s.grabZone(this.filter || undefined);
      it = z ? z.item : null;
    } else if (this.filter && s.countOf) {
      // 过滤臂：直接探测源内是否存在过滤物（而非源的首个产出）
      it = s.countOf(this.filter) > 0 ? this.filter : null;
    } else if (s.peekItem) {
      it = s.peekItem();
    }
    if (it && this.filter && it !== this.filter) return null;
    return it;
  }
  countSourceOf(s, item) {
    if (!s) return 0;
    if (s.countOf) return s.countOf(item);
    return 1;
  }
  takeNFrom(s, item, n) {
    const got = [];
    for (let i = 0; i < n; i++) {
      let it = null;
      if (s instanceof Belt) {
        const z = s.grabZone(item);
        if (!z) break;
        s.items.splice(s.items.indexOf(z), 1);
        it = z.item;
      } else if (s.takeItemOf) {
        it = s.takeItemOf(item);
      } else break;
      if (it !== item) break;
      got.push(it);
    }
    return got;
  }
  takeSource(s) {
    if (s instanceof Belt) {
      const z = s.grabZone();
      if (!z) return null;
      s.items.splice(s.items.indexOf(z), 1);
      return z.item;
    }
    if (s.takeOutput) return s.takeOutput();
    if (s.takeItem) return s.takeItem();
    return null;
  }
  // ===== 放物 =====
  canDropAt(t, item) {
    if (!t) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      let back = Infinity;
      for (const o of t.items) back = Math.min(back, o.pos);
      return back >= BELT_SPACING * 0.9;
    }
    switch (t.type) {
      case 'stone-furnace':
        if (item === 'coal') return t.fuelCoal < 20;
        return SMELTS.some(r => r.inp === item) && (t.inp[item] || 0) < 25;
      case 'electric-furnace':
        if (item === 'coal') return false;
        return SMELTS.some(r => r.inp === item) && (t.inp[item] || 0) < 25;
      case 'assembling-machine':
      case 'assembling-machine-mk2': {
        if (!t.recipe) return false;
        const rec = RECIPES[t.recipe];
        return !!rec.inp[item] && (t.inp[item] || 0) < 50;
      }
      case 'burner-drill':
        return item === 'coal' && t.fuelCoal < 10;
      case 'electric-drill':
        return false;
      case 'boiler':
        return item === 'coal' && t.fuelCoal < 20;
      case 'lab':
        return isScience(item) && (t.packs[item] || 0) < 40;
      case 'underground':
        return t.items.length < UG_CAP;
      case 'pipe':
        return FLUIDS.indexOf(item) >= 0 && t.total() < PIPE_CAP;
      case 'refinery':
        return item === 'crude-oil' && (t.inp['crude-oil'] || 0) < 50;
      case 'storage-chest':
        return t.slots.length < 12 || t.slots.some(s => s && s.item === item && s.count < 50);
      default:
        return false;
    }
  }
  deliverAt(t) {
    if (!t || !this.holding) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      const o = this.dropOffset();
      return t.acceptItem(this.holding, dirFromVec(o.dx, o.dy));
    }
    return t.giveItem(this.holding);
  }
  // 干跑：现在是否有活干（供 UI/其他系统查询）
  hasWork() {
    const s = this.entAtPick();
    const it = this.peekSource(s);
    return !!(it && this.canDropAt(this.entAtDrop(), it));
  }
  update(dt) {
    if (this.armAng === undefined) this.armAng = this.pickAng();
    const step = Math.PI * 4.4 * dt;
    // 统一状态机：
    //  空手 -> 转向取物格 -> 到达后原子地“预览+校验+取走（可堆叠抓 N 个）”
    //  持物 -> 转向放物格 -> 到达后循环放入直到放空或目标拒收
    const holdingNow = this.holdingCount > 0;
    const target = holdingNow ? this.dropAng() : this.pickAng();
    const arrived = Math.abs(angNorm(target - this.armAng)) < 0.05;
    if (!arrived) {
      this.rotating = true;
      this.armAng = approachAng(this.armAng, target, step);
      if (Math.abs(angNorm(target - this.armAng)) < 0.05) this.armAng = target;
      else return;
    }
    this.rotating = false;
    this.armAng = target;
    if (!holdingNow) {
      // 到达取物位：一次性完成“看源、验目标、取走”，避免探测与执行之间的状态漂移
      const s = this.entAtPick();
      const it = this.peekSource(s);
      this.blocked = false;
      if (!it) return;                       // 源为空：停在取物位等待
      if (!this.canDropAt(this.entAtDrop(), it)) return; // 目标暂不收：等待
      const want = Math.max(1, Math.min(this.stackMax, this.countSourceOf(s, it)));
      const got = this.takeNFrom(s, it, want);
      if (!got.length) return;
      this.holding = it;
      this.holdingCount = got.length;
    } else {
      // 到达放物位：循环放入；失败保持持物、标记堵塞，下帧继续重试
      const t = this.entAtDrop();
      while (this.holdingCount > 0 && this.deliverAt(t)) this.holdingCount--;
      this.blocked = this.holdingCount > 0;
      if (this.holdingCount <= 0) this.holding = null;
    }
  }
  serialize() {
    const s = super.serialize();
    s.holding = this.holding;
    s.holdingCount = this.holdingCount || 1;
    if (this.filter) s.filter = this.filter;
    return s;
  }
  static restore(s) {
    const i = super.restore(s);
    i.holding = s.holding || null;
    i.holdingCount = s.holding ? (s.holdingCount || 1) : 0;
    i.filter = s.filter || null;
    return i;
  }
}

class Splitter extends Belt {
  constructor(type, x, y) {
    super(type || 'splitter', x, y);
    this.items = [];
    this.inPref = 0;
    this.outToggle = false;
    this.outPref = type === 'priority-splitter' ? 1 : -1; // -1=均衡轮发，0/1=优先某侧
    this.applyDir();
  }
  applyDir() {
    if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; }
    else { this.w = this.def.w; this.h = this.def.h; }
  }
  laneVec() { return [-DY[this.dir], DX[this.dir]]; }
  laneCenter(l) {
    const cx = (this.x + this.w / 2) * TILE, cy = (this.y + this.h / 2) * TILE;
    const p = this.laneVec();
    const off = (l - 0.5) * TILE;
    return [cx + p[0] * off, cy + p[1] * off];
  }
  update(dt) {
    const sp = beltSpeed() * dt;
    this.items.sort((a, b) => b.pos - a.pos);
    for (let i = 0; i < this.items.length; i++) {
      const o = this.items[i];
      const lim = i === 0 ? 0.999 : Math.max(0, this.items[i - 1].pos - BELT_SPACING);
      if (o.pos < lim) o.pos = Math.min(o.pos + sp, lim);
      if (o.pos >= 0.5 && o.outLane === undefined) {
        if (this.outPref >= 0) {
          o.outLane = this.outPref;
        } else {
          o.outLane = this.outToggle ? 1 : 0;
          this.outToggle = !this.outToggle;
        }
      }
      if (o.pos >= 0.999 && o.outLane !== undefined) {
        let ok = this.pushOut(o.item, o.outLane);
        if (!ok) {
          const alt = 1 - o.outLane;
          if (this.pushOut(o.item, alt)) { o.outLane = alt; ok = true; }
        }
        if (ok) { this.items.splice(i, 1); i--; }
        else o.pos = 0.999;
      }
    }
  }
  pushOut(item, lane) {
    const [ex, ey] = this.laneCenter(lane);
    const tx = Math.floor((ex + DX[this.dir] * TILE) / TILE);
    const ty = Math.floor((ey + DY[this.dir] * TILE) / TILE);
    const t = entAt(tx, ty);
    if (!t) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      if (t.dir === ((this.dir + 2) % 4)) return false;
      return t.acceptItem(item, this.dir);
    }
    if (!(t instanceof Underground)) return t.giveItem(item);
    return false;
  }
  acceptItem(item, fromDir, sx, sy) {
    let pref = this.inPref;
    const rel = ((fromDir - this.dir) % 4 + 4) % 4;
    if (sx !== undefined && sx !== null && rel === 0) {
      const pv = this.laneVec();
      const ccx = (this.x + this.w / 2) * TILE, ccy = (this.y + this.h / 2) * TILE;
      const scx = (sx + 0.5) * TILE, scy = (sy + 0.5) * TILE;
      const d = (scx - ccx) * pv[0] + (scy - ccy) * pv[1];
      pref = d > 0 ? 1 : 0;
    } else if (sx !== undefined && sx !== null && rel !== 0 && rel !== 2) {
      const fv = [DX[this.dir], DY[this.dir]];
      const ccx = (this.x + this.w / 2) * TILE, ccy = (this.y + this.h / 2) * TILE;
      const scx = (sx + 0.5) * TILE, scy = (sy + 0.5) * TILE;
      const d = (scx - ccx) * fv[0] + (scy - ccy) * fv[1];
      pref = d > 0 ? 1 : 0;
    }
    for (let n = 0; n < 2; n++) {
      const l = (pref + n) % 2;
      const blocked = this.items.some(o => o.lane === l && o.pos < BELT_SPACING);
      if (!blocked) {
        this.items.push({ item, pos: 0, lane: l });
        if (rel !== 0 && rel !== 2) this.inPref = 1 - this.inPref;
        return true;
      }
    }
    return false;
  }
  takeItem() {
    if (!this.items.length) return null;
    let best = this.items[0];
    for (const o of this.items) if (o.pos > best.pos) best = o;
    this.items.splice(this.items.indexOf(best), 1);
    return best.item;
  }
  giveItem(item) { return this.acceptItem(item); }
  serialize() {
    return {
      type: this.type, x: this.x, y: this.y, dir: this.dir,
      outPref: this.outPref,
      items: this.items.map(o => [o.item, +o.pos.toFixed(3), o.lane, o.outLane === undefined ? -1 : o.outLane])
    };
  }
  static restore(s) {
    const e = new this(s.type, s.x, s.y);
    e.dir = s.dir | 0;
    e.applyDir();
    e.outPref = typeof s.outPref === 'number' ? s.outPref : (e.constructor === PrioritySplitter ? 1 : -1);
    e.items = (s.items || []).map(a => ({ item: a[0], pos: a[1], lane: a[2] || 0, outLane: a[3] >= 0 ? a[3] : undefined }));
    return e;
  }
}

class Underground extends Entity {
  constructor(type, x, y) {
    super(type || 'underground', x, y);
    this.items = [];
    this.outItems = [];
    this.cd = 0;
  }
  maxDist() { return this.type === 'fast-underground-belt' ? FAST_UNDERGROUND_MAX : UNDERGROUND_MAX; }
  findMate() {
    for (let k = 1; k <= this.maxDist(); k++) {
      const nx = this.x + DX[this.dir] * k, ny = this.y + DY[this.dir] * k;
      const t = entAt(nx, ny);
      if (!t) continue;
      if (t instanceof Underground) return (t.dir === this.dir && t.type === this.type) ? t : null;
      if (t.solid) return null;
    }
    return null;
  }
  speedMult() { return this.type === 'fast-underground-belt' ? FAST_BELT_MULT : 1; }
  // 与同档传送带完全一致的吞吐：每 BELT_SPACING 格一个物品 → 间隔 = 间距/带速
  ugInterval() { return BELT_SPACING / Math.max(0.05, beltSpeed() * this.speedMult()); }
  update(dt) {
    const iv = this.ugInterval();
    this.cd -= dt;
    const mate = this.findMate();
    if (mate) {
      if (this.cd <= 0 && this.items.length > 0 && mate.outItems.length < UG_CAP) {
        mate.outItems.push(this.items.shift());
        this.cd = iv;
      }
    }
    this.ejectT = (this.ejectT || 0) - dt;
    if (this.outItems.length > 0 && this.ejectT <= 0) {
      const nx = this.x + DX[this.dir], ny = this.y + DY[this.dir];
      let sent = false;
      const t = entAt(nx, ny);
      if (t instanceof Belt) {
        if (!(t instanceof Splitter) && t.dir === ((this.dir + 2) % 4)) sent = false;
        else sent = t.acceptItem(this.outItems[0], this.dir);
      } else if (t && !(t instanceof Underground)) {
        sent = t.giveItem(this.outItems[0]);
      }
      if (sent) { this.outItems.shift(); this.ejectT = iv; }
      else this.ejectT = 0.15;
    }
  }
  findBackMate() {
    for (let k = 1; k <= this.maxDist(); k++) {
      const nx = this.x - DX[this.dir] * k, ny = this.y - DY[this.dir] * k;
      const t = entAt(nx, ny);
      if (!t) continue;
      if (t instanceof Underground) return (t.dir === this.dir && t.type === this.type) ? t : null;
      if (t.solid) return null;
    }
    return null;
  }
  acceptItem(item) {
    if (this.items.length >= UG_CAP) return false;
    this.items.push(item);
    return true;
  }
  peekItem() {
    return this.outItems.length ? this.outItems[0] : null;
  }
  takeOutput() {
    return this.outItems.length ? this.outItems.shift() : null;
  }
  takeItem() {
    if (this.outItems.length) return this.outItems.shift();
    if (this.items.length) return this.items.shift();
    return null;
  }
  giveItem(item) { return this.acceptItem(item); }
  serialize() {
    const s = super.serialize();
    s.items = this.items.slice();
    s.outItems = this.outItems.slice();
    return s;
  }
  static restore(s) {
    const u = super.restore(s);
    u.items = (s.items || []).slice();
    u.outItems = (s.outItems || []).slice();
    u.cd = 0;
    return u;
  }
}

class LongInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'long-inserter', x, y);
    this.reach = 2;   // 几何、行为与普通臂完全一致，只是触及第二格
  }
}

class PrioritySplitter extends Splitter {
  constructor(type, x, y) {
    super(type || 'priority-splitter', x, y);
    this.outPref = 1;
  }
}

class FastUnderground extends Underground {
  constructor(type, x, y) { super(type || 'fast-underground-belt', x, y); }
}

class FilterInserter extends Inserter {
  constructor(type, x, y) { super(type || 'filter-inserter', x, y); }
}

class StackInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'stack-inserter', x, y);
    this.stackMax = 3;   // 一次最多抓取 3 个同种物品
  }
}

// ===== 石油链：管道 / 抽油机 / 炼油厂 =====
const PIPE_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

class Pipe extends Entity {
  constructor(type, x, y) {
    super('pipe', x, y);
    this.fluid = {};
  }
  total() {
    let s = 0;
    for (const k in this.fluid) s += this.fluid[k];
    return s;
  }
  update(dt) {
    for (const k of Object.keys(this.fluid)) {
      if (!(this.fluid[k] > 0)) continue;
      for (const [dx, dy] of PIPE_DIRS) {
        if (!(this.fluid[k] > 0)) break;
        const t = entAt(this.x + dx, this.y + dy);
        if (!t || t === this) continue;
        if (t instanceof Pipe) {
          if (t.total() < PIPE_CAP && this.fluid[k] > (t.fluid[k] || 0)) {
            this.fluid[k]--;
            t.fluid[k] = (t.fluid[k] || 0) + 1;
          }
        } else if (t instanceof Refinery && t.giveItem(k)) {
          this.fluid[k]--;
        }
      }
    }
    for (const k of Object.keys(this.fluid)) if (!(this.fluid[k] > 0)) delete this.fluid[k];
  }
  giveItem(item) {
    if (FLUIDS.indexOf(item) < 0) return false;
    if (this.total() >= PIPE_CAP) return false;
    this.fluid[item] = (this.fluid[item] || 0) + 1;
    return true;
  }
  peekItem() {
    for (const k in this.fluid) if (this.fluid[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.fluid) if (this.fluid[k] > 0) return this.takeItemOf(k);
    return null;
  }
  takeOutput() { return this.takeItem(); }
  countOf(item) { return this.fluid[item] || 0; }
  takeItemOf(item) {
    if ((this.fluid[item] || 0) > 0) {
      this.fluid[item]--;
      if (this.fluid[item] <= 0) delete this.fluid[item];
      return item;
    }
    return null;
  }
  serialize() { const s = super.serialize(); s.fluid = this.fluid; return s; }
  static restore(s) { const p = super.restore(s); p.fluid = s.fluid || {}; return p; }
}

class Pumpjack extends ElectricDrill {
  constructor(type, x, y) { super(type || 'pumpjack', x, y); }
  machMult() { return oilMult(); }
  oreTile() {
    for (let dy = 0; dy < this.h; dy++)
      for (let dx = 0; dx < this.w; dx++) {
        const tx = this.x + dx, ty = this.y + dy;
        if (getOreType(tx, ty) === ORE_OIL && getOreAmt(tx, ty) > 0) return [tx, ty];
      }
    return null;
  }
  mineItem() { return 'crude-oil'; }
}

class Refinery extends Entity {
  constructor(type, x, y) {
    super('refinery', x, y);
    this.inp = {};   // { 'crude-oil': n }
    this.outp = {};  // { 'heavy-oil': n, 'light-oil': n, 'petroleum-gas': n }
    this.prog = 0;
    this.working = false;
  }
  outTotal() {
    let s = 0;
    for (const k in this.outp) s += this.outp[k];
    return s;
  }
  update(dt) {
    this.working = false;
    if ((this.inp['crude-oil'] || 0) < 2) { this.prog = 0; return; }
    if (this.outTotal() >= 48) return;
    if (G.power.sat <= 0) return;
    this.working = true;
    this.prog += dt * oilMult() * (G.power.sat < 1 ? G.power.sat : 1) / 4;
    if (this.prog >= 1) {
      this.prog -= 1;
      this.inp['crude-oil'] -= 2;
      if (this.inp['crude-oil'] <= 0) delete this.inp['crude-oil'];
      for (const k of ['heavy-oil', 'light-oil', 'petroleum-gas']) this.outp[k] = (this.outp[k] || 0) + 1;
    }
    this.tryOutput();
  }
  tryOutput() {
    for (const k of Object.keys(this.outp)) {
      if (!(this.outp[k] > 0)) continue;
      for (const [dx, dy] of PIPE_DIRS) {
        const t = entAt(this.x + dx, this.y + dy);
        if (!t || t === this) continue;
        if ((t instanceof Pipe || t instanceof Chest) && !(t instanceof Splitter) && t.giveItem(k)) {
          this.outp[k]--;
          if (this.outp[k] <= 0) delete this.outp[k];
          break;
        }
      }
    }
  }
  giveItem(item) {
    if (item === 'crude-oil' && (this.inp['crude-oil'] || 0) < 50) { this.inp['crude-oil'] = (this.inp['crude-oil'] || 0) + 1; return true; }
    return false;
  }
  peekItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return this.takeItemOf(k);
    return null;
  }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) {
    if ((this.outp[item] || 0) > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; }
    return null;
  }
  serialize() {
    const s = super.serialize();
    s.inp = this.inp; s.outp = this.outp; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.inp = s.inp || {}; r.outp = s.outp || {}; r.prog = s.prog || 0;
    return r;
  }
}

const ENT_CLASSES = {
  'transport-belt': Belt,
  'fast-transport-belt': Belt,
  'splitter': Splitter,
  'priority-splitter': PrioritySplitter,
  'underground': Underground,
  'fast-underground-belt': FastUnderground,
  'burner-drill': Drill,
  'stone-furnace': Furnace,
  'assembling-machine': Assembler,
  'assembling-machine-mk2': AssemblerMK2,
  'storage-chest': Chest,
  'lab': Lab,
  'boiler': Boiler,
  'steam-engine': SteamEngine,
  'electric-drill': ElectricDrill,
  'electric-furnace': ElectricFurnace,
  'pipe': Pipe,
  'pumpjack': Pumpjack,
  'refinery': Refinery,
  'inserter': Inserter,
  'long-inserter': LongInserter,
  'filter-inserter': FilterInserter,
  'stack-inserter': StackInserter
};
