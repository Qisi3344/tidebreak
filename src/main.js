import { Game } from './core/Game.js';

const app = document.getElementById('app');
const game = new Game(app);
window.__game = game; // 调试方便
