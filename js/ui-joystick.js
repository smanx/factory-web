'use strict';

// ===== 虚拟摇杆（手机/触屏移动） =====
// 摇杆状态存于 G.joystick；仅在开启"虚拟摇杆"设置且设备为触屏时显示。
// 拖拽摇杆把位移量归一化为 [-1,1] 的 dx/dy，供 updatePlayer 叠加到移动方向。
function updateJoystickVisibility() {
  const el = document.getElementById('joystick');
  if (!el) return;
  const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const show = !!(G.settings.virtualJoystick && touchCapable);
  if (show) {
    el.classList.add('active');
    el.classList.remove('hidden');
  } else {
    el.classList.remove('active');
    el.classList.add('hidden');
  }
}

function initJoystick() {
  const el = document.getElementById('joystick');
  if (!el) return;
  const knob = document.getElementById('joystick-knob');
  const MAX = 40;   // 摇杆最大拖动半径（px）

  // 摇杆本体位置固定不动（由 CSS 定位），拖动时只移动内部旋钮
  function resetKnob() {
    if (knob) knob.style.transform = 'translate(0px,0px)';
  }
  function resetJoystick() {
    G.joystick.active = false;
    G.joystick.id = null;
    G.joystick.dx = 0;
    G.joystick.dy = 0;
    resetKnob();
  }

  el.addEventListener('touchstart', ev => {
    if (!G.settings.virtualJoystick) return;
    ev.preventDefault();
    const t = ev.changedTouches[0];
    if (!t) return;
    G.joystick.active = true;
    G.joystick.id = t.identifier;
    G.joystick.baseX = t.clientX;
    G.joystick.baseY = t.clientY;
    G.joystick.dx = 0;
    G.joystick.dy = 0;
    // 摇杆本体位置保持不变，仅记录手指起点作为旋钮位移基准
    resetKnob();
  }, { passive: false });

  el.addEventListener('touchmove', ev => {
    if (!G.settings.virtualJoystick || !G.joystick.active) return;
    ev.preventDefault();
    for (const t of ev.changedTouches) {
      if (t.identifier !== G.joystick.id) continue;
      let dx = t.clientX - G.joystick.baseX;
      let dy = t.clientY - G.joystick.baseY;
      const len = Math.hypot(dx, dy);
      if (len > MAX) {
        // 只把旋钮限制在最大半径内，摇杆本体位置保持不变
        dx = dx / len * MAX;
        dy = dy / len * MAX;
      }
      // 归一化到 [-1,1]，带死区避免轻微抖动
      G.joystick.dx = Math.abs(dx) < 4 ? 0 : dx / MAX;
      G.joystick.dy = Math.abs(dy) < 4 ? 0 : dy / MAX;
      if (knob) knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
  }, { passive: false });

  el.addEventListener('touchend', ev => {
    if (!G.settings.virtualJoystick) return;
    ev.preventDefault();
    for (const t of ev.changedTouches) {
      if (t.identifier === G.joystick.id) resetJoystick();
    }
  });
  el.addEventListener('touchcancel', ev => {
    if (!G.settings.virtualJoystick) return;
    ev.preventDefault();
    for (const t of ev.changedTouches) {
      if (t.identifier === G.joystick.id) resetJoystick();
    }
  });

  updateJoystickVisibility();
}
