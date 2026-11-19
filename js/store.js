export const tags = [
  "黄金3秒钩子",
  "痛点制造",
  "视觉反转",
  "核心干货",
  "结尾引导",
];
export class TimelineStore {
  constructor() {
    this.shots = [];
    this.past = [];
    this.future = [];
  }
  reset(shots) {
    this.shots = shots.map((s, i) => ({
      tag: tags[i % 5],
      caption: "",
      motion: "静止",
      source: "original",
      theme: "赛博网格",
      ...s,
    }));
    this.past = [];
    this.future = [];
  }
  save() {
    this.past.push(structuredClone(this.shots));
    if (this.past.length > 100) this.past.shift();
    this.future = [];
  }
  edit(i, data) {
    this.save();
    Object.assign(this.shots[i], data);
  }
  split(i, t) {
    const s = this.shots[i];
    if (t - s.startTime < 0.05 || s.endTime - t < 0.05) return false;
    this.save();
    this.shots.splice(
      i,
      1,
      { ...s, endTime: t, duration: t - s.startTime },
      {
        ...s,
        offset: (s.offset || 0) + t - s.startTime,
        startTime: t,
        duration: s.endTime - t,
      },
    );
    return true;
  }
  merge(i) {
    const a = this.shots[i],
      b = this.shots[i + 1];
    if (!b) return;
    this.save();
    this.shots.splice(i, 2, {
      ...a,
      endTime: b.endTime,
      duration: b.endTime - a.startTime,
    });
  }
  undo() {
    if (this.past.length) {
      this.future.push(this.shots);
      this.shots = this.past.pop();
    }
  }
  redo() {
    if (this.future.length) {
      this.past.push(this.shots);
      this.shots = this.future.pop();
    }
  }
  export() {
    return JSON.stringify({ version: 1, shots: this.shots }, null, 2);
  }
  import(str, duration) {
    const { shots, version } = JSON.parse(str);
    if (
      version !== 1 ||
      !Array.isArray(shots) ||
      !shots.length ||
      shots.some(
        (s, i) =>
          !Number.isFinite(s.startTime) ||
          !Number.isFinite(s.endTime) ||
          Math.abs(s.startTime - (shots[i - 1]?.endTime || 0)) > 0.001 ||
          s.endTime <= s.startTime ||
          typeof s.caption !== "string" ||
          !["original", "asset", "dynamic"].includes(s.source),
      ) ||
      Math.abs(shots.at(-1).endTime - duration) > 0.15
    )
      throw Error("时间轴格式或素材时长不匹配");
    this.save();
    this.shots = shots.map((s) => ({
      ...s,
      duration: s.endTime - s.startTime,
    }));
  }
}
