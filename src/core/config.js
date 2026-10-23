// ============================================================
// TIDEBREAK · 全局配置 — 塔表 / 敌表 / 波次表 / 平衡常数
// 所有数值的单一数据源，平衡调整只改这里。
// ============================================================

export const MAP = {
  size: 44,          // 世界宽深（X/Z）
  half: 22,
  cell: 2,           // 建造格子边长
  gridN: 22,         // 每边格数 = size / cell
  coreHp: 20,        // 潮核血量
};

// ---------- 主路径航点（世界坐标 XZ）----------
// S 形主路径：东裂隙 → 潮核
export const PATH_MAIN = [
  [22, -14], [10, -14], [10, -6], [-10, -6], [-10, 4], [6, 4], [6, 12], [0, 12], [0, 16],
];
// 西侧支线：第 10 波开启
export const PATH_WEST = [
  [-22, 12], [-12, 12], [-12, 16], [0, 16],
];

// ---------- 塔定义 ----------
// cost/upgradeCost: 造价与升级价; levels[0..2]: 每级属性（1级=初始）
export const TOWERS = {
  pulse: {
    id: 'pulse', name: '脉冲哨炮', color: 0x35e0ff, dmgType: 'single',
    desc: '速射单体，便宜可靠，前期主力',
    levels: [
      { cost: 60,  dmg: 6,  range: 7,  rate: 3.5 },  // rate = 发/秒
      { cost: 50,  dmg: 11, range: 7.5, rate: 4.2 },
      { cost: 90,  dmg: 19, range: 8,  rate: 5.0 },
    ],
  },
  frost: {
    id: 'frost', name: '霜语塔', color: 0x8ab6ff, dmgType: 'slow',
    desc: '范围霜爆，大幅减速敌群',
    levels: [
      { cost: 80,  dmg: 3, range: 6, rate: 0.8, slow: 0.45, slowDur: 1.6, aoe: 3.2 },
      { cost: 70,  dmg: 6, range: 6.5, rate: 0.9, slow: 0.55, slowDur: 2.0, aoe: 3.8 },
      { cost: 120, dmg: 10, range: 7, rate: 1.0, slow: 0.65, slowDur: 2.4, aoe: 4.4 },
    ],
  },
  starfire: {
    id: 'starfire', name: '星火臼炮', color: 0xffb347, dmgType: 'splash',
    desc: '迫击溅射，克群体集群',
    levels: [
      { cost: 110, dmg: 14, range: 8, rate: 0.7, aoe: 2.6 },
      { cost: 95,  dmg: 26, range: 8.5, rate: 0.75, aoe: 3.0 },
      { cost: 160, dmg: 46, range: 9, rate: 0.8, aoe: 3.5 },
    ],
  },
  prism: {
    id: 'prism', name: '棱镜激光', color: 0xff5ad1, dmgType: 'beam',
    desc: '持续光束，锁定单体高 DPS，克 Boss',
    levels: [
      { cost: 150, dmg: 22, range: 9 },   // dmg = 每秒
      { cost: 130, dmg: 42, range: 9.5 },
      { cost: 220, dmg: 80, range: 10 },
    ],
  },
  longbow: {
    id: 'longbow', name: '长弓狙击', color: 0xb0ff57, dmgType: 'snipe',
    desc: '超远程重击，优先高血量目标',
    levels: [
      { cost: 130, dmg: 40, range: 14, rate: 0.5 },
      { cost: 115, dmg: 85, range: 15, rate: 0.55 },
      { cost: 190, dmg: 170, range: 16, rate: 0.6 },
    ],
  },
};

export const TOWER_SELL_RATE = 0.7;

// ---------- 敌人定义 ----------
// hpMul/speedMul 相对基准；bounty 赏金; score 击杀分
export const ENEMIES = {
  drifter: {
    id: 'drifter', name: '疾行者', hp: 34, speed: 3.2, bounty: 8, score: 10,
    color: 0xff4fa0, size: 0.55, flying: false,
  },
  shelled: {
    id: 'shelled', name: '甲壳兽', hp: 150, speed: 1.5, bounty: 16, score: 25,
    color: 0xc46bff, size: 0.85, flying: false, armor: 3, // 每次受击减伤
  },
  floater: {
    id: 'floater', name: '悬浮者', hp: 55, speed: 2.6, bounty: 12, score: 18,
    color: 0x7dfff0, size: 0.6, flying: true,
  },
  splitter: {
    id: 'splitter', name: '裂殖体', hp: 70, speed: 2.0, bounty: 10, score: 20,
    color: 0xffd166, size: 0.7, flying: false, splitInto: 'drifter', splitCount: 3,
  },
  boss: {
    id: 'boss', name: '潮汐巨兽', hp: 1400, speed: 1.1, bounty: 180, score: 400,
    color: 0xff2d55, size: 1.7, flying: false, armor: 6, boss: true,
  },
};

// ---------- 波次表 ----------
// 每波: { entries: [{type, count, gap, delay}], reward, boss?, west? }
// gap=出怪间隔(s), delay=距波开始延迟(s)
export function buildWaves() {
  const W = [];
  const push = (entries, reward = 20 + W.length * 4) => W.push({ entries, reward });

  push([{ type: 'drifter', count: 6, gap: 1.1 }]);
  push([{ type: 'drifter', count: 10, gap: 0.9 }]);
  push([
    { type: 'drifter', count: 8, gap: 0.8 },
    { type: 'shelled', count: 2, gap: 2.4, delay: 4 },
  ]);
  push([{ type: 'drifter', count: 12, gap: 0.6 }, { type: 'shelled', count: 3, gap: 2.2, delay: 3 }]);
  push([{ type: 'boss', count: 1, gap: 1, delay: 2 }], 60);                       // W5 Boss
  push([
    { type: 'splitter', count: 6, gap: 1.4 },
    { type: 'drifter', count: 10, gap: 0.7, delay: 3 },
  ]);
  push([{ type: 'shelled', count: 8, gap: 1.6 }, { type: 'splitter', count: 6, gap: 1.2, delay: 5 }]);
  push([{ type: 'floater', count: 8, gap: 1.0 }, { type: 'drifter', count: 12, gap: 0.6, delay: 4 }]);
  push([
    { type: 'splitter', count: 10, gap: 1.0 },
    { type: 'shelled', count: 6, gap: 1.8, delay: 4 },
    { type: 'floater', count: 6, gap: 1.2, delay: 8 },
  ]);
  push([
    { type: 'boss', count: 1, gap: 1, delay: 1 },
    { type: 'drifter', count: 10, gap: 0.8, delay: 6 },
  ], 80);                                                                          // W10 Boss + 双裂隙开启
  push([
    { type: 'shelled', count: 10, gap: 1.4 },
    { type: 'floater', count: 10, gap: 0.9, delay: 5 },
  ], null, true);
  push([
    { type: 'splitter', count: 12, gap: 0.9 },
    { type: 'shelled', count: 8, gap: 1.5, delay: 6 },
  ]);
  push([
    { type: 'drifter', count: 24, gap: 0.4 },
    { type: 'floater', count: 12, gap: 0.8, delay: 5 },
  ]);
  push([
    { type: 'shelled', count: 12, gap: 1.3 },
    { type: 'splitter', count: 10, gap: 1.0, delay: 6 },
    { type: 'floater', count: 8, gap: 1.0, delay: 10 },
  ]);
  push([
    { type: 'boss', count: 2, gap: 8, delay: 1 },
    { type: 'drifter', count: 16, gap: 0.6, delay: 6 },
  ], 120);                                                                         // W15 Boss
  push([
    { type: 'floater', count: 18, gap: 0.6 },
    { type: 'shelled', count: 10, gap: 1.4, delay: 6 },
  ]);
  push([
    { type: 'splitter', count: 16, gap: 0.7 },
    { type: 'floater', count: 14, gap: 0.7, delay: 5 },
  ]);
  push([
    { type: 'shelled', count: 16, gap: 1.1 },
    { type: 'splitter', count: 12, gap: 0.9, delay: 6 },
  ]);
  push([
    { type: 'drifter', count: 36, gap: 0.3 },
    { type: 'shelled', count: 12, gap: 1.2, delay: 6 },
    { type: 'floater', count: 16, gap: 0.6, delay: 10 },
  ]);
  push([
    { type: 'boss', count: 3, gap: 7, delay: 1 },
    { type: 'splitter', count: 12, gap: 0.9, delay: 8 },
  ], 160);                                                                         // W20 Boss
  push([
    { type: 'shelled', count: 18, gap: 1.0 },
    { type: 'floater', count: 20, gap: 0.55, delay: 5 },
  ]);
  push([
    { type: 'splitter', count: 20, gap: 0.6 },
    { type: 'shelled', count: 14, gap: 1.1, delay: 6 },
  ]);
  push([
    { type: 'drifter', count: 40, gap: 0.25 },
    { type: 'floater', count: 20, gap: 0.5, delay: 6 },
    { type: 'shelled', count: 14, gap: 1.2, delay: 8 },
  ]);
  push([
    { type: 'boss', count: 4, gap: 6, delay: 1 },
    { type: 'splitter', count: 16, gap: 0.8, delay: 10 },
    { type: 'floater', count: 16, gap: 0.7, delay: 14 },
  ]);                                                                              // W24 高压
  push([
    { type: 'boss', count: 2, gap: 12, delay: 1 },
    { type: 'shelled', count: 20, gap: 1.0, delay: 5 },
    { type: 'drifter', count: 30, gap: 0.35, delay: 8 },
    { type: 'floater', count: 20, gap: 0.5, delay: 12 },
  ], 300);                                                                         // W25 最终

  return W;
}

// 全局难度乘子
export function hpScale(wave) { return 1 + 0.22 * (wave - 1) + 0.012 * (wave - 1) ** 2; }
export function speedScale(wave) { return Math.min(1 + 0.012 * (wave - 1), 1.35); }

// ---------- 英雄 ----------
export const HERO = {
  moveSpeed: 9,
  maxHp: 100,
  shootRate: 5.2,        // 发/秒
  shootDmg: 9,
  shootRange: 11,
  bulletSpeed: 26,
  xpToLevel: (lv) => 60 + lv * 45,
  skillQ: { name: '汐爆', dmg: 55, radius: 4.2, cd: 9, key: 'Q' },
  skillE: { name: '时滞力场', radius: 5.5, slow: 0.6, dur: 4, cd: 14, key: 'E' },
  upgrades: [
    { id: 'rate',  name: '疾速扳机', desc: '射速 +25%' },
    { id: 'dmg',   name: '聚能弹头', desc: '子弹伤害 +30%' },
    { id: 'speed', name: '浪间疾行', desc: '移动速度 +15%' },
    { id: 'cd',    name: '潮汐回响', desc: '技能冷却 -20%' },
    { id: 'multi', name: '分裂弹头', desc: '额外射出一发追踪弹（50% 伤害）' },
    { id: 'blast', name: '汐爆增幅', desc: '汐爆伤害 +40%，半径 +25%' },
  ],
};

// ---------- 经济 ----------
export const ECON = {
  startGold: 220,
  waveBonusBase: 18,     // 每波基础奖励
  earlyBonus: 14,        // 提前召唤下一波奖励
  coreHpScore: 25,       // 结算时每点剩血分数
};

export const WAVES_TOTAL = 25;
export const WEST_OPEN_WAVE = 10;
export const INTERMISSION = 20; // 波间歇秒数
