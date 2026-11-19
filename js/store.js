export const tags = [
  "黄金3秒钩子",
  "痛点制造",
  "视觉反转",
  "核心干货",
  "结尾引导",
];
const backgrounds = new Map([
  ["cyber-grid", "赛博网格"], ["aurora-gradient", "极光渐变"], ["dark-noise", "暗黑噪点"]
]);
const motions = new Map([
  ["static", "静止"], ["zoom-in", "缓慢推近"], ["zoom-out", "缓慢拉远"], ["beat-shake", "卡点微震动"]
]);
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
      effect: "none",
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
  matchFastCuts() {
    const fast = this.shots.filter(s => s.duration < 1.5);
    if (fast.length) {
      this.save();
      fast.forEach((s, i) => { s.effect = i % 2 ? "pop" : "whoosh"; });
    }
    return fast.length;
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
  exportAIPrompt(topic) {
    if (!topic?.trim()) throw Error("请填写新视频主题或核心卖点");
    const brief = this.shots.map((shot, i) => ({
      index: i + 1, duration: shot.duration.toFixed(1), tag: shot.tag,
      maxChars: Math.floor(shot.duration * 4.5)
    }));
    return [
      "请为一条竖屏短视频撰写连贯的分镜字幕。",
      "新视频主题/核心卖点：" + topic.trim(),
      "按以下分镜逐条创作。duration 的单位是秒，保留每个 index 和 tag，字幕须符合节奏定位，可见字符数不得超过 maxChars。",
      JSON.stringify(brief, null, 2),
      "每句话用 [方括号] 标出最核心的 1–2 个关键词，括号不计入字数。",
      "bgPreset 可选：" + [...backgrounds.keys()].join("、"),
      "cameraMotion 可选：" + [...motions.keys()].join("、"),
      "仅输出合法 JSON，省略代码围栏和解释。按以下结构填写全部分镜：",
      '{"scenes":[{"index":1,"tag":"黄金3秒钩子","subtitle":"试试[新方法]","bgPreset":"cyber-grid","cameraMotion":"zoom-in"}]}'
    ].join("\n");
  }
  importAIScript(rawText) {
    const fenced = rawText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
    const body = fenced?.[1] ?? rawText.match(/\{[\s\S]*\}/)?.[0];
    if (!body) throw Error("请粘贴含 scenes 数组的 JSON 对象");
    let script;
    try { script = JSON.parse(body); }
    catch { throw Error("JSON 格式有误，请检查双引号、逗号和括号"); }
    if (!Array.isArray(script.scenes) || !script.scenes.length)
      throw Error("scenes 必须是非空数组");
    const seen = new Set();
    const next = this.shots.slice();
    for (const [position, scene] of script.scenes.entries()) {
      const index = scene?.index;
      if (!Number.isInteger(index) || index < 1 || index > next.length)
        throw Error("第 " + (position + 1) + " 项需要有效的 index（1–" + next.length + "）");
      if (seen.has(index)) throw Error("分镜 index 重复：" + index);
      seen.add(index);
      const shot = {...next[index - 1]};
      if ("subtitle" in scene) {
        if (typeof scene.subtitle !== "string") throw Error("分镜 " + index + " 的 subtitle 必须是文本");
        shot.caption = scene.subtitle;
      }
      if ("tag" in scene) {
        if (!tags.includes(scene.tag)) throw Error("分镜 " + index + " 的 tag 无效");
        shot.tag = scene.tag;
      }
      if ("bgPreset" in scene) {
        if (!backgrounds.has(scene.bgPreset)) throw Error("分镜 " + index + " 的 bgPreset 无效");
        shot.theme = backgrounds.get(scene.bgPreset);
        shot.source = "dynamic";
      }
      if ("cameraMotion" in scene) {
        if (!motions.has(scene.cameraMotion)) throw Error("分镜 " + index + " 的 cameraMotion 无效");
        shot.motion = motions.get(scene.cameraMotion);
      }
      next[index - 1] = shot;
    }
    this.save();
    this.shots = next;
    return seen.size;
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
      effect: "none",
      ...s,
      duration: s.endTime - s.startTime,
    }));
  }
}

// Each Pages project on the same origin has its own record.
export class ProjectDB {
  constructor() {
    this.key = new URL(".", location.href).pathname;
    this.connection = new Promise((resolve, reject) => {
      const request = indexedDB.open("ViralRhythmWorkbench", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("projects");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async read() {
    const db = await this.connection;
    return new Promise((resolve, reject) => {
      const request = db.transaction("projects").objectStore("projects").get(this.key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async write(project) {
    const db = await this.connection;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("projects", "readwrite");
      transaction.objectStore("projects").put(project, this.key);
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
    });
  }
}
