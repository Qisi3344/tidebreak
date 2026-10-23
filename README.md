# TIDEBREAK · 破潮者

> **3D 塔防 × 英雄动作混合游戏** —— 星潮裂隙涌出虚空生物，你既要造塔布防，也要亲自操控机甲"汐卫"开火放技能，撑过 25 波狂潮，守住中央的潮核。胜利后可进入无尽模式继续冲分。

![tech](https://img.shields.io/badge/three.js-3D-blue) ![tech](https://img.shields.io/badge/Vite-build-green) ![assets](https://img.shields.io/badge/assets-100%25%20procedural-ff69b4)

全部素材（模型 / 地形 / 音效 / BGM / 粒子）均为代码程序化生成，零外部资源、零付费素材。

## 玩法

- **塔防层**：右键点击空地建造防御塔，右键点塔升级/出售。5 种塔各司其职——脉冲哨炮（速射）、霜语塔（范围减速）、星火臼炮（溅射，不能对空）、棱镜激光（持续光束，克 Boss）、长弓狙击（超远程，优先高血量）。
- **动作层**：WASD 操控英雄"汐卫"，鼠标瞄准、左键连射；**Q 汐爆**（范围爆炸）、**E 时滞力场**（区域减速）。击杀攒经验，英雄升级时三选一强化（射速 / 伤害 / 移速 / 冷却 / 分裂弹 / 爆破增幅）。
- **压力设计**：第 5/10/15/20/25 波为 Boss 波（狂潮加速 / 裂地召唤 / 相位护盾三技轮转）；**第 10 波起西裂隙开启**，敌军两路进攻。
- **经济**：击杀赏金 + 波次奖励 + 提前召唤利息（N 键），卖塔回收 70%。

## 操作

| 键位 | 动作 |
|---|---|
| WASD / 方向键 | 英雄移动 |
| 鼠标移动 | 瞄准 |
| 左键（按住） | 连射 |
| 右键点空地 / 点塔 | 建塔 / 升级·出售 |
| Q / E | 汐爆 / 时滞力场 |
| N | 提前召唤下一波（拿利息） |
| ESC / P | 暂停 |
| 滚轮 | 缩放视野 |

## 本地运行

```bash
npm install
npm run dev      # 开发模式，浏览器打开 http://localhost:5173
npm run build    # 生产构建，产物在 dist/
npm run preview  # 预览构建产物
```

无任何后端 / 账号 / 密钥依赖，纯前端单机游戏。

## 技术架构

```
src/
├── main.js            入口
├── core/
│   ├── Game.js        状态机 + 主循环 + 系统接线
│   └── config.js      塔表 / 敌表 / 25 波波次表 / 平衡常数（单一数据源）
├── scene/
│   ├── SceneManager.js renderer / 相机 / 灯光 / UnrealBloom 辉光
│   └── World.js       程序化地形 / 路径 / 建造网格 / 潮核 / 裂隙
├── entities/
│   ├── Tower.js       5 种塔 × 3 级（数据驱动）
│   ├── Enemy.js       5 种敌人 + Boss 技能（对象池）
│   ├── Hero.js        英雄移动 / 射击 / 技能 / 经验成长
│   └── Projectile.js  弹道池（追踪 / 直线 / 溅射）
├── systems/
│   ├── WaveManager.js 波次调度 / 难度曲线 / 双裂隙 / 无尽模式
│   ├── Economy.js     赏金 / 计分
│   ├── Collision.js   均匀空间网格范围查询
│   └── Effects.js     GPU 点粒子池 + 扩散环
├── ui/UI.js           全部 DOM 界面（菜单 / HUD / 建造 / 结算 / 飘字）
└── audio/Audio.js     WebAudio 程序化音效 + BGM
```

设计案详见 [GAME_DESIGN.md](./GAME_DESIGN.md)。

## 环境

桌面 Chrome / Edge（需 WebGL），1280×720 及以上分辨率体验最佳。
