// 均匀空间网格分桶 —— 每帧重建，供塔/弹道/技能做圆形范围查询
export class SpatialGrid {
  constructor(cellSize = 2.5) {
    this.cellSize = cellSize;
    this.inv = 1 / cellSize;
    this.buckets = new Map();
  }

  clear() { this.buckets.clear(); }

  _key(cx, cz) { return cx * 4096 + cz; }

  insert(item) {
    const cx = Math.floor(item.pos.x * this.inv);
    const cz = Math.floor(item.pos.z * this.inv);
    const k = this._key(cx, cz);
    let arr = this.buckets.get(k);
    if (!arr) { arr = []; this.buckets.set(k, arr); }
    arr.push(item);
  }

  // 返回圆范围内的候选（未做精确距离过滤，调用方自行判距离）
  queryCircle(x, z, r, out) {
    out.length = 0;
    const minx = Math.floor((x - r) * this.inv), maxx = Math.floor((x + r) * this.inv);
    const minz = Math.floor((z - r) * this.inv), maxz = Math.floor((z + r) * this.inv);
    for (let cx = minx; cx <= maxx; cx++) {
      for (let cz = minz; cz <= maxz; cz++) {
        const arr = this.buckets.get(this._key(cx, cz));
        if (arr) for (const it of arr) out.push(it);
      }
    }
    return out;
  }
}
