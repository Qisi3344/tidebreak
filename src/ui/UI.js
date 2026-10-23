import * as THREE from 'three';
import { TOWERS, HERO, WAVES_TOTAL, TOWER_SELL_RATE } from '../core/config.js';

const CSS = `
.tbd-* { box-sizing: border-box; }
#tbd-ui { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: 'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif; }
.tbd-panel { background: rgba(6,14,26,0.86); border: 1px solid rgba(53,224,255,0.35); border-radius: 10px; box-shadow: 0 0 18px rgba(53,224,255,0.12), inset 0 0 30px rgba(20,60,90,0.25); backdrop-filter: blur(4px); }
.tbd-btn { pointer-events: auto; cursor: pointer; padding: 10px 26px; font-size: 16px; letter-spacing: 2px; color: #bfefff; background: rgba(20,50,80,0.6); border: 1px solid #35e0ff88; border-radius: 8px; transition: all .15s; text-shadow: 0 0 8px #35e0ff66; }
.tbd-btn:hover { background: rgba(53,224,255,0.22); box-shadow: 0 0 16px #35e0ff55; transform: translateY(-1px); }
.tbd-btn.primary { font-size: 20px; padding: 14px 46px; color: #061018; background: #35e0ff; border-color: #9ff5ff; font-weight: 700; text-shadow: none; }
.tbd-btn.primary:hover { background: #7fecff; }
.tbd-btn.danger { border-color: #ff508888; color: #ffc8d4; }
.tbd-btn.danger:hover { background: rgba(255,80,136,0.2); box-shadow: 0 0 16px #ff508855; }
.tbd-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

/* ---------- 主菜单 / 结算 ---------- */
.tbd-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: auto; background: radial-gradient(ellipse at center, rgba(4,10,20,0.25) 0%, rgba(2,5,12,0.78) 100%); }
.tbd-title { font-size: 72px; font-weight: 900; letter-spacing: 14px; color: #d8f6ff; text-shadow: 0 0 30px #35e0ffaa, 0 0 80px #1899dd66; margin: 0; }
.tbd-subtitle { font-size: 22px; color: #7fd8ee; letter-spacing: 8px; margin: 6px 0 0; }
.tbd-tagline { color: #5a90a8; margin-top: 26px; font-size: 15px; line-height: 1.9; text-align: center; }
.tbd-stats { display: grid; grid-template-columns: auto auto; gap: 8px 28px; margin: 26px 0; font-size: 17px; color: #9fd8ec; }
.tbd-stats b { color: #e8fbff; font-size: 20px; text-align: right; }
.tbd-row { display: flex; gap: 18px; margin-top: 18px; }

/* ---------- HUD 顶栏 ---------- */
#tbd-top { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 14px; align-items: center; padding: 8px 18px; }
.tbd-stat { display: flex; flex-direction: column; align-items: center; min-width: 74px; }
.tbd-stat .k { font-size: 11px; color: #6798ad; letter-spacing: 2px; }
.tbd-stat .v { font-size: 21px; font-weight: 700; color: #e8fbff; text-shadow: 0 0 10px #35e0ff55; }
#tbd-corebar-wrap { width: 210px; }
#tbd-corebar { height: 12px; border-radius: 6px; background: #0a1826; border: 1px solid #35e0ff44; overflow: hidden; margin-top: 4px; box-shadow: 0 0 8px #35e0ff22 inset; }
#tbd-corebar-fill { height: 100%; width: 100%; background: linear-gradient(90deg, #35e0ff, #7fffd4); box-shadow: 0 0 8px #7fffd4aa; transition: width .3s; }

/* ---------- 左下英雄面板 ---------- */
#tbd-hero { position: absolute; left: 14px; bottom: 14px; padding: 12px 16px; display: flex; align-items: center; gap: 14px; }
#tbd-lv { width: 46px; height: 46px; border-radius: 50%; border: 2px solid #35e0ff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #e8fbff; box-shadow: 0 0 14px #35e0ff66; }
#tbd-xpbar { width: 130px; height: 6px; background: #0a1826; border-radius: 3px; overflow: hidden; margin-top: 5px; }
#tbd-xpfill { height: 100%; width: 0%; background: linear-gradient(90deg, #ff5ad1, #ffb347); }
.tbd-skill { position: relative; width: 52px; height: 52px; border-radius: 9px; border: 1px solid #35e0ff66; background: rgba(16,36,54,0.8); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #bfefff; pointer-events: auto; cursor: pointer; }
.tbd-skill .key { font-size: 18px; font-weight: 800; }
.tbd-skill .nm { font-size: 9px; color: #6798ad; margin-top: 1px; }
.tbd-skill .cdmask { position: absolute; inset: 0; background: rgba(4,10,18,0.78); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #ffce7a; font-weight: 700; }
.tbd-skill.ready { box-shadow: 0 0 12px #35e0ff77; }

/* ---------- 建造 / 塔面板 ---------- */
#tbd-build { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; padding: 12px 14px; pointer-events: auto; }
.tbd-card { width: 128px; padding: 9px 10px; border: 1px solid #35e0ff3d; border-radius: 9px; background: rgba(10,24,38,0.9); cursor: pointer; transition: all .12s; }
.tbd-card:hover { border-color: #35e0ff; background: rgba(24,60,88,0.9); transform: translateY(-3px); }
.tbd-card.off { opacity: 0.38; cursor: not-allowed; }
.tbd-card .nm { font-size: 14px; font-weight: 700; color: #e8fbff; }
.tbd-card .ds { font-size: 10.5px; color: #7fa8bc; margin: 3px 0 5px; line-height: 1.35; min-height: 42px; }
.tbd-card .cost { font-size: 13px; color: #ffd166; font-weight: 700; }
.tbd-card .swatch { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; }

/* ---------- 横幅 / 倒计时 / toast ---------- */
#tbd-banner { position: absolute; top: 21%; left: 50%; transform: translateX(-50%); text-align: center; font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #ffe9c4; text-shadow: 0 0 24px #ffb347aa; opacity: 0; transition: opacity .4s; pointer-events: none; }
#tbd-banner small { display: block; font-size: 14px; letter-spacing: 4px; color: #7fd8ee; margin-top: 4px; }
#tbd-inter { position: absolute; top: 76px; left: 50%; transform: translateX(-50%); text-align: center; pointer-events: auto; }
#tbd-inter .cd { font-size: 26px; color: #9ff5ff; font-weight: 700; text-shadow: 0 0 14px #35e0ff66; }
#tbd-toast { position: absolute; bottom: 130px; left: 50%; transform: translateX(-50%); font-size: 15px; color: #ff9db4; text-shadow: 0 0 10px #ff508899; opacity: 0; transition: opacity .3s; pointer-events: none; }

/* ---------- Boss 血条 ---------- */
#tbd-bossbar { position: absolute; top: 72px; left: 50%; transform: translateX(-50%); width: 440px; text-align: center; display: none; }
#tbd-bossbar .nm { font-size: 13px; letter-spacing: 4px; color: #ff9db4; text-shadow: 0 0 10px #ff2d55aa; }
#tbd-bossbar .bar { height: 9px; margin-top: 3px; background: #180a12; border: 1px solid #ff2d5566; border-radius: 5px; overflow: hidden; }
#tbd-bossbar .fill { height: 100%; width: 100%; background: linear-gradient(90deg, #ff2d55, #ff8ba0); transition: width .2s; }

/* ---------- 飘字 ---------- */
.tbd-float { position: absolute; font-size: 14px; font-weight: 800; pointer-events: none; text-shadow: 0 0 8px currentColor; white-space: nowrap; }
/* ---------- 升级三选一 ---------- */
#tbd-levelup .tbd-row { align-items: stretch; }
.tbd-lucard { width: 190px; padding: 18px 16px; text-align: center; pointer-events: auto; cursor: pointer; transition: all .15s; }
.tbd-lucard:hover { border-color: #ffb347; box-shadow: 0 0 22px #ffb34755; transform: translateY(-4px); }
.tbd-lucard .nm { font-size: 18px; font-weight: 800; color: #ffe9c4; }
.tbd-lucard .ds { font-size: 13px; color: #8fb8cc; margin-top: 8px; line-height: 1.5; }
`;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export class UI {
  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = el('div'); this.root.id = 'tbd-ui';
    document.body.appendChild(this.root);
    this.floats = [];
    this._v = new THREE.Vector3();
    this._buildMenus();
    this._buildHUD();
    this._buildPanels();
  }

  // ================= 菜单层 =================
  _buildMenus() {
    // 主菜单
    this.menu = el('div', 'tbd-center');
    this.menu.innerHTML = `
      <h1 class="tbd-title">TIDEBREAK</h1>
      <div class="tbd-subtitle">破 潮 者</div>
      <div class="tbd-tagline">
        星潮裂隙开启，虚空生物正向潮核涌来。<br>
        你是最后一任守堤人——造塔布防，或亲自扣下扳机。撑过 ${WAVES_TOTAL} 波狂潮。<br>
        <span style="color:#4d7a90">WASD 移动 · 鼠标瞄准 · 左键射击 · Q 汐爆 · E 时滞力场 · 右键点空地建塔/点塔升级 · ESC 暂停 · N 提前召唤</span>
      </div>
      <div class="tbd-tagline" id="tbd-hiscore" style="margin-top:8px;font-size:13px"></div>`;
    const row = el('div', 'tbd-row');
    const start = el('button', 'tbd-btn primary', '开 始 守 潮');
    start.onclick = () => this.onStart && this.onStart();
    row.appendChild(start);
    this.menu.appendChild(row);
    this.root.appendChild(this.menu);

    // 暂停
    this.pauseMenu = el('div', 'tbd-center');
    this.pauseMenu.style.display = 'none';
    this.pauseMenu.innerHTML = `<h1 class="tbd-title" style="font-size:44px">暂 停</h1>`;
    const prow = el('div', 'tbd-row');
    this.btnResume = el('button', 'tbd-btn', '继续 (ESC)');
    this.btnRestart1 = el('button', 'tbd-btn danger', '重新开始');
    prow.append(this.btnResume, this.btnRestart1);
    this.pauseMenu.appendChild(prow);
    this.root.appendChild(this.pauseMenu);

    // 升级三选一
    this.levelup = el('div', 'tbd-center');
    this.levelup.style.display = 'none';
    this.levelup.appendChild(el('div', null, '<h1 class="tbd-title" style="font-size:38px;color:#ffe9c4;text-shadow:0 0 26px #ffb347aa">汐 升 级</h1><div class="tbd-subtitle" style="letter-spacing:3px;color:#c9a86a">选择一项强化</div>'));
    this.luRow = el('div', 'tbd-row');
    this.levelup.appendChild(this.luRow);
    this.root.appendChild(this.levelup);

    // 结算
    this.result = el('div', 'tbd-center');
    this.result.style.display = 'none';
    this.root.appendChild(this.result);
  }

  showMenu(v) {
    this.menu.style.display = v ? 'flex' : 'none';
    if (v) {
      const hs = parseInt((localStorage.getItem('tidebreak_hiscore') || '0'), 10);
      const elH = this.menu.querySelector('#tbd-hiscore');
      if (elH) elH.textContent = hs > 0 ? `历史最高纪录 · ${hs.toLocaleString()}` : '';
    }
  }
  showPause(v) { this.pauseMenu.style.display = v ? 'flex' : 'none'; }
  showResult(v) { this.result.style.display = v ? 'flex' : 'none'; }
  hideLevelup() { this.levelup.style.display = 'none'; }


  showLevelUp(choices, onPick) {
    this.luRow.innerHTML = '';
    for (const c of choices) {
      const card = el('div', 'tbd-lucard tbd-panel');
      card.innerHTML = `<div class="nm">${c.name}</div><div class="ds">${c.desc}</div>`;
      card.onclick = () => onPick(c.id);
      this.luRow.appendChild(card);
    }
    this.levelup.style.display = 'flex';
  }

  setResult(win, data) {
    this.result.style.display = 'flex';
    const isRecord = data.hiscore !== undefined && data.score >= data.hiscore;
    const mm = Math.floor((data.time || 0) / 60), ss = Math.floor((data.time || 0) % 60);
    const timeStr = `${mm}:${String(ss).padStart(2, '0')}`;
    this.result.innerHTML = `
      <h1 class="tbd-title" style="font-size:52px;${win ? '' : 'color:#ff9db4;text-shadow:0 0 30px #ff5088aa'}">${win ? '潮 汐 已 破' : '潮 核 陷 落'}</h1>
      <div class="tbd-subtitle">${win ? `你守住了全部 ${WAVES_TOTAL} 波狂潮${data.endless ? '，并续写无尽传奇' : ''}` : `防线在第 ${data.wave} 波崩塌`}</div>
      <div class="tbd-stats">
        <span>最终得分${isRecord ? ' <b style="color:#ffd166;font-size:13px">★ 新纪录</b>' : ''}</span><b>${data.score.toLocaleString()}</b>
        <span>历史最高</span><b>${(data.hiscore || 0).toLocaleString()}</b>
        <span>击杀数</span><b>${data.kills}</b>
        <span>抵达波次</span><b>${data.wave}${data.endless ? ' (无尽)' : '/' + WAVES_TOTAL}</b>
        <span>建造塔数</span><b>${data.built}</b>
        <span>守潮用时</span><b>${timeStr}</b>
        <span>潮核剩余</span><b>${data.coreHp} / ${data.coreMax}</b>
      </div>`;
    const row = el('div', 'tbd-row');
    if (win && !data.endless) {
      const endless = el('button', 'tbd-btn', '进入无尽模式');
      endless.onclick = () => this.onEndless && this.onEndless();
      row.appendChild(endless);
    }
    const restart = el('button', 'tbd-btn primary', '再来一局');
    restart.onclick = () => this.onRestart && this.onRestart();
    row.appendChild(restart);
    this.result.appendChild(row);
  }

  // ================= HUD =================
  _buildHUD() {
    this.hud = el('div');
    this.hud.style.cssText = 'position:absolute;inset:0';
    this.hud.style.display = 'none';

    const top = el('div', 'tbd-panel'); top.id = 'tbd-top';
    top.innerHTML = `
      <div class="tbd-stat"><span class="k">波次</span><span class="v" id="tbd-wave">-</span></div>
      <div class="tbd-stat"><span class="k">赏金</span><span class="v" id="tbd-gold" style="color:#ffd166">0</span></div>
      <div class="tbd-stat" id="tbd-corebar-wrap"><span class="k">潮核</span><div id="tbd-corebar"><div id="tbd-corebar-fill"></div></div></div>
      <div class="tbd-stat"><span class="k">得分</span><span class="v" id="tbd-score">0</span></div>
      <div class="tbd-stat"><span class="k">敌军</span><span class="v" id="tbd-enemies" style="color:#ff9db4">0</span></div>`;
    this.hud.appendChild(top);

    // 英雄面板
    const hero = el('div', 'tbd-panel'); hero.id = 'tbd-hero';
    hero.innerHTML = `
      <div style="text-align:center"><div id="tbd-lv">1</div><div id="tbd-xpbar"><div id="tbd-xpfill"></div></div></div>
      <div style="display:flex;gap:8px" id="tbd-skills"></div>`;
    this.hud.appendChild(hero);
    this.skillBox = hero.querySelector('#tbd-skills');
    this._skillEls = {};
    for (const s of [HERO.skillQ, HERO.skillE]) {
      const d = el('div', 'tbd-skill');
      d.innerHTML = `<span class="key">${s.key}</span><span class="nm">${s.name}</span><div class="cdmask" style="display:none"></div>`;
      this.skillBox.appendChild(d);
      this._skillEls[s.key] = d;
    }

    // 横幅 / 间歇 / toast / boss 血条
    this.banner = el('div'); this.banner.id = 'tbd-banner';
    this.hud.appendChild(this.banner);
    this.inter = el('div'); this.inter.id = 'tbd-inter';
    this.inter.innerHTML = `<div class="cd" id="tbd-inter-cd"></div>`;
    const early = el('button', 'tbd-btn', '提前召唤下一波 (N)');
    early.style.cssText = 'margin-top:6px;font-size:13px;padding:6px 16px';
    early.onclick = () => this.onCallEarly && this.onCallEarly();
    this.inter.appendChild(early);
    this.interCd = this.inter.querySelector('#tbd-inter-cd');
    this.hud.appendChild(this.inter);
    this.toast = el('div'); this.toast.id = 'tbd-toast';
    this.hud.appendChild(this.toast);

    this.bossbar = el('div'); this.bossbar.id = 'tbd-bossbar';
    this.bossbar.innerHTML = `<div class="nm">潮 汐 巨 兽</div><div class="bar"><div class="fill"></div></div>`;
    this.hud.appendChild(this.bossbar);
    this.bossFill = this.bossbar.querySelector('.fill');

    this.root.appendChild(this.hud);
    this.hudRefs = {
      wave: top.querySelector('#tbd-wave'), gold: top.querySelector('#tbd-gold'),
      score: top.querySelector('#tbd-score'), enemies: top.querySelector('#tbd-enemies'),
      coreFill: top.querySelector('#tbd-corebar-fill'),
      lv: hero.querySelector('#tbd-lv'), xp: hero.querySelector('#tbd-xpfill'),
    };
  }

  showHUD(v) { this.hud.style.display = v ? 'block' : 'none'; }

  setHUD({ wave, gold, score, enemies, coreRatio, heroLv, heroXp }) {
    const r = this.hudRefs;
    if (wave !== undefined) r.wave.textContent = wave > WAVES_TOTAL ? `∞${wave}` : `${wave}/${WAVES_TOTAL}`;
    if (gold !== undefined) r.gold.textContent = Math.floor(gold);
    if (score !== undefined) r.score.textContent = Math.floor(score).toLocaleString();
    if (enemies !== undefined) r.enemies.textContent = enemies;
    if (coreRatio !== undefined) r.coreFill.style.width = `${Math.max(0, coreRatio * 100)}%`;
    if (heroLv !== undefined) r.lv.textContent = heroLv;
    if (heroXp !== undefined) r.xp.style.width = `${Math.min(heroXp * 100, 100)}%`;
  }

  setBossHp(ratio) {
    if (ratio === null) { this.bossbar.style.display = 'none'; return; }
    this.bossbar.style.display = 'block';
    this.bossFill.style.width = `${Math.max(0, ratio * 100)}%`;
  }

  setSkillCd(key, ratio, text) {
    const d = this._skillEls[key];
    const mask = d.querySelector('.cdmask');
    if (ratio <= 0) { mask.style.display = 'none'; d.classList.add('ready'); }
    else { mask.style.display = 'flex'; mask.textContent = text; d.classList.remove('ready'); }
  }

  showBanner(text, sub = '', dur = 2.2) {
    this.banner.innerHTML = `${text}<small>${sub}</small>`;
    this.banner.style.opacity = 1;
    clearTimeout(this._bt);
    this._bt = setTimeout(() => { this.banner.style.opacity = 0; }, dur * 1000);
  }

  setIntermission(secLeft) {
    if (secLeft === null) { this.inter.style.display = 'none'; return; }
    this.inter.style.display = 'block';
    this.interCd.textContent = `下一波 ${Math.ceil(secLeft)}s`;
  }

  showToast(text) {
    this.toast.textContent = text;
    this.toast.style.opacity = 1;
    clearTimeout(this._tt);
    this._tt = setTimeout(() => { this.toast.style.opacity = 0; }, 1600);
  }

  // ================= 建造 / 塔面板 =================
  _buildPanels() {
    this.buildPanel = el('div', 'tbd-panel'); this.buildPanel.id = 'tbd-build';
    this.buildPanel.style.display = 'none';
    this.root.appendChild(this.buildPanel);

    this.towerPanel = el('div', 'tbd-panel'); this.towerPanel.id = 'tbd-build';
    this.towerPanel.style.display = 'none';
    this.root.appendChild(this.towerPanel);
  }

  showBuild(gold, onBuild, onCancel) {
    this.buildPanel.innerHTML = '';
    for (const def of Object.values(TOWERS)) {
      const cost = def.levels[0].cost;
      const afford = gold >= cost;
      const card = el('div', 'tbd-card' + (afford ? '' : ' off'));
      card.innerHTML = `<div class="nm"><span class="swatch" style="background:${hex(def.color)};box-shadow:0 0 8px ${hex(def.color)}"></span>${def.name}</div>
        <div class="ds">${def.desc}${def.dmgType === 'splash' ? '<br><b style="color:#ff9db4">不能对空</b>' : ''}</div>
        <div class="cost">◈ ${cost}</div>`;
      card.onclick = () => afford ? onBuild(def.id) : this.showToast('赏金不足');
      this.buildPanel.appendChild(card);
    }
    this.buildPanel.style.display = 'flex';
    this.buildPanel.onmouseleave = () => onCancel && onCancel();
  }
  hideBuild() { this.buildPanel.style.display = 'none'; }

  showTowerMenu(tower, gold, onUpgrade, onSell) {
    this.towerPanel.innerHTML = '';
    const s = tower.stats;
    const head = el('div', 'tbd-card');
    head.style.cursor = 'default';
    const dmgS = tower.def.dmgType === 'beam' ? `${s.dmg}/秒` : `${s.dmg}${s.rate ? ` × ${s.rate}/s` : ''}`;
    head.innerHTML = `<div class="nm"><span class="swatch" style="background:${hex(tower.def.color)};box-shadow:0 0 8px ${hex(tower.def.color)}"></span>${tower.def.name} · Lv${tower.level + 1}</div>
      <div class="ds">伤害 ${dmgS} · 射程 ${s.range}${tower.def.dmgType === 'slow' ? ` · 减速 ${Math.round(s.slow * 100)}%` : ''}</div>`;
    this.towerPanel.appendChild(head);

    if (!tower.maxLevel) {
      const up = el('div', 'tbd-card' + (gold >= tower.upgradeCost ? '' : ' off'));
      up.innerHTML = `<div class="nm" style="color:#9ff5ff">▲ 升级</div><div class="ds">升到 Lv${tower.level + 2}</div><div class="cost">◈ ${tower.upgradeCost}</div>`;
      up.onclick = () => gold >= tower.upgradeCost ? onUpgrade() : this.showToast('赏金不足');
      this.towerPanel.appendChild(up);
    } else {
      const max = el('div', 'tbd-card');
      max.innerHTML = `<div class="nm" style="color:#ffd166">MAX</div><div class="ds">已是最高等级</div>`;
      this.towerPanel.appendChild(max);
    }
    const sell = el('div', 'tbd-card');
    sell.innerHTML = `<div class="nm" style="color:#ff9db4">✕ 出售</div><div class="ds">回收 ${Math.round(TOWER_SELL_RATE * 100)}%</div><div class="cost">◈ +${tower.sellValue}</div>`;
    sell.onclick = () => onSell();
    this.towerPanel.appendChild(sell);

    this.towerPanel.style.display = 'flex';
    this.towerPanel.onmouseleave = () => this.hideTowerMenu();
  }
  hideTowerMenu() { this.towerPanel.style.display = 'none'; }

  // ================= 3D 飘字 =================
  floatText(worldPos, text, color = '#ffd166', size = 14) {
    const e = el('div', 'tbd-float', text);
    e.style.color = color;
    e.style.fontSize = `${size}px`;
    this.root.appendChild(e);
    this.floats.push({ e, pos: worldPos.clone(), t: 0, dur: 1.1 });
  }

  updateFloats(dt, camera, canvasW, canvasH) {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      if (f.t >= f.dur) { f.e.remove(); this.floats.splice(i, 1); continue; }
      this._v.copy(f.pos);
      this._v.y += f.t * 1.6;
      this._v.project(camera);
      if (this._v.z > 1) { f.e.style.opacity = 0; continue; }
      f.e.style.left = `${((this._v.x + 1) / 2) * canvasW}px`;
      f.e.style.top = `${((-this._v.y + 1) / 2) * canvasH}px`;
      f.e.style.opacity = 1 - f.t / f.dur;
      f.e.style.transform = 'translate(-50%,-50%)';
    }
  }
  clearFloats() { for (const f of this.floats) f.e.remove(); this.floats.length = 0; }
}
