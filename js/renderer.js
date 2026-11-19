import { landscape } from "./demo-generator.js";
import { seek } from "./detector.js";
export class CanvasRenderer {
  constructor(canvas, store, audio) {
    this.audio = audio;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.store = store;
    this.assets = new Map();
    this.time = 0;
    this.playing = false;
    this.generation = 0;
  }
  get duration() {
    return this.store.shots.at(-1)?.endTime || 0;
  }
  index(t) {
    const i = this.store.shots.findIndex((s) => t < s.endTime);
    return i < 0 ? this.store.shots.length - 1 : i;
  }
  pause() {
    this.audio.stop();
    this.generation++;
    this.playing = false;
    cancelAnimationFrame(this.frame);
    this.active?.pause();
    this.active = null;
  }
  media(s) {
    return s.source === "asset"
      ? this.assets.get(s.asset)
      : s.source === "original"
        ? this.original
        : null;
  }
  local(s, t, m) {
    return s.source === "original"
      ? t
      : (t - s.startTime + (s.offset || 0)) % m.duration;
  }
  async goto(t) {
    this.pause();
    const token = this.generation;
    this.time = Math.min(this.duration, Math.max(0, t));
    const s = this.store.shots[this.index(this.time)],
      m = this.media(s);
    if (m instanceof HTMLVideoElement)
      await seek(m, Math.min(m.duration - 0.001, this.local(s, this.time, m)));
    if (token === this.generation) this.draw(this.time);
  }
  async play(from, onTick, onStart) {
    const seeking = this.goto(from);
    const token = this.generation;
    await seeking;
    if (token !== this.generation) return;
    await this.audio.prepare(from);
    if (token !== this.generation) return;
    onStart?.();
    this.audio.start(from, this.store.shots);
    this.playing = true;
    return new Promise((resolve, reject) => {
      this.finish = resolve;
      const tick = () => {
        if (token !== this.generation) return resolve();
        try {
          const t = Math.min(
              this.duration,
              from + this.audio.ctx.currentTime - this.audio.anchor,
            ),
            s = this.store.shots[this.index(t)],
            m = this.media(s);
          if (m !== this.active || s !== this.last) {
            this.active?.pause();
            this.active = m instanceof HTMLVideoElement ? m : null;
            if (this.active) {
              this.active.loop = s.source === "asset";
              const local = this.local(s, t, m);
              if (Math.abs(m.currentTime - local) > 0.07) m.currentTime = local;
              m.play().catch(() => {});
            }
            this.last = s;
          }
          this.draw(t);
          onTick(t);
          if (t >= this.duration) {
            this.pause();
            resolve();
          } else this.frame = requestAnimationFrame(tick);
        } catch (e) {
          this.pause();
          reject(e);
        }
      };
      tick();
    });
  }
  draw(t) {
    this.time = t;
    const i = this.index(t),
      s = this.store.shots[i],
      m = this.media(s),
      c = this.ctx,
      w = 1080,
      h = 1920,
      p = (t - s.startTime) / s.duration;
    let z =
      s.motion === "缓慢推近"
        ? 1 + 0.15 * p
        : s.motion === "缓慢拉远"
          ? 1.15 - 0.15 * p
          : 1;
    c.save();
    c.translate(w / 2, h / 2);
    if (s.motion === "卡点微震动") {
      z = 1.035;
      c.translate(Math.sin(t * 80) * 8, Math.cos(t * 76) * 9);
    }
    c.scale(z, z);
    c.translate(-w / 2, -h / 2);
    if (m) {
      let mw = m.videoWidth || m.naturalWidth,
        mh = m.videoHeight || m.naturalHeight,
        k = Math.max(w / mw, h / mh);
      if (mw)
        c.drawImage(m, (w - mw * k) / 2, (h - mh * k) / 2, mw * k, mh * k);
    } else if (s.source === "dynamic" && s.theme !== "赛博网格") {
      c.fillStyle = "#131621";
      c.fillRect(0, 0, w, h);
      if (s.theme === "极光渐变") {
        let g = c.createRadialGradient(
          360 + Math.sin(t) * 240,
          800,
          20,
          650,
          960,
          1200,
        );
        g.addColorStop(0, "#4cceb3");
        g.addColorStop(0.5, "#443878");
        g.addColorStop(1, "#121427");
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      } else {
        c.fillStyle = "#494754";
        for (let n = 1; n < 3500; n++)
          c.fillRect((n * 787 + t * 75) % w, (n * n * 61 + t * 90) % h, 3, 3);
      }
    } else {
      landscape(c, w, h, s.art ?? i, t);
      if (s.source === "original") {
        c.fillStyle = "#fff";
        c.textAlign = "center";
        c.font = "bold 29px monospace";
        c.letterSpacing = "5px";
        c.fillText("S Y N T H W A V E   S E R I E S", 540, 265);
        c.letterSpacing = "0px";
        c.font = "italic 900 118px Arial";
        c.fillText(
          ["NEON", "TIDAL", "LUNAR", "SOLAR", "NOVA"][(s.art ?? i) % 5],
          540,
          470,
        );
        c.font = "italic 900 110px Arial";
        c.fillText("HORIZON", 540, 565);
      }
    }
    c.restore();
    if (s.caption) {
      const lines = [[]];
      let x = 0;
      c.font = "bold 58px sans-serif";
      for (const part of s.caption.match(/\[[^\]]*\]|[^\[]+|\[/g) || []) {
        const hot = part.startsWith("[") && part.endsWith("]");
        for (const ch of hot ? part.slice(1, -1) : part) {
          let width = c.measureText(ch).width;
          if (x + width > 860 || ch === "\n") {
            lines.push([]);
            x = 0;
          }
          if (ch !== "\n") {
            lines.at(-1).push({ ch, width, hot });
            x += width;
          }
        }
      }
      const visible = lines.slice(0, 17);
      let y = 1610 - visible.length * 78;
      c.fillStyle = "#0c0916ba";
      c.beginPath();
      c.roundRect(80, y - 20, 920, visible.length * 78 + 30, 25);
      c.fill();
      for (const row of visible) {
        let left = (1080 - row.reduce((a, b) => a + b.width, 0)) / 2;
        y += 58;
        for (const a of row) {
          c.fillStyle = a.hot ? "#ffd363" : "white";
          c.fillText(a.ch, left, y);
          left += a.width;
        }
        y += 20;
      }
    }
  }
}
