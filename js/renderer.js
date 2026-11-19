import { landscape } from "./demo-generator.js";
import { seek } from "./detector.js";
export class CanvasRenderer {
  constructor(canvas, store, audio) {
    this.audio = audio;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.store = store;
    this.captionStyle = "classic-yellow";
    this.captionY = 78;
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
    this.drawCaption(s.caption, t - s.startTime, p);
  }

  drawCaption(text, elapsed, progress) {
    const c = this.ctx, style = this.captionStyle;
    const cinema = style === "cinema-caption", marker = style === "highlighter-bar";
    const bar = 1920 * 0.12;
    if (cinema) {
      c.fillStyle = "#000";
      c.fillRect(0, 0, 1080, bar);
      c.fillRect(0, 1920 - bar, 1080, bar);
    }
    if (!text) return;
    c.save();
    c.textBaseline = "middle";
    c.lineJoin = "round";
    const rows = [[]];
    let width = 0, total = 0, group = 0;
    for (const part of text.match(/\[[^\]]*\]|[^\[]+|\[/g) || []) {
      const hot = part.startsWith("[") && part.endsWith("]");
      group++;
      const size = cinema ? 42 : hot && style === "classic-yellow" ? 69 : 60;
      const font = (cinema ? "500 " : "900 ") + size + "px sans-serif";
      c.font = font;
      for (const ch of hot ? part.slice(1,-1) : part) {
        const advance = c.measureText(ch).width + (cinema ? 2 : 0);
        if (ch === "\n" || width + advance > 910) { rows.push([]); width = 0; }
        if (ch !== "\n") {
          rows.at(-1).push({ch, hot, font, advance, group, index:total++});
          width += advance;
        }
      }
    }
    const leading = cinema ? 58 : 86;
    const scale = Math.min(1, (cinema ? bar-24 : 1820)/(rows.length*leading));
    const height = rows.length * leading * scale;
    const position = this.captionY / 100;
    const top = cinema ? 1920-bar+12+(bar-24-height)*position :
      Math.max(24, Math.min(1896-height, 1920*position-height/2));
    c.translate(540, top);
    c.scale(scale, scale);
    const reveal = Math.min(total, 1 + progress * total / 0.82);
    rows.forEach((row, line) => {
      const y = (line+0.5)*leading;
      let x = -row.reduce((n,g) => n + g.advance, 0)/2;
      if (marker) {
        let left = x;
        for (let i=0; i<row.length;) {
          const first = row[i]; let span = 0;
          while (i<row.length && row[i].group===first.group) span += row[i++].advance;
          if (first.hot) {
            c.save(); c.translate(left-4,y); c.rotate(-2*Math.PI/180);
            c.fillStyle = "#84CC16"; c.beginPath();
            c.roundRect(0,-38,(span+8)*Math.min(1,elapsed/0.32),74,8); c.fill(); c.restore();
          }
          left += span;
        }
      }
      for (const g of row) {
        if (style === "typewriter-pop" && g.index >= reveal) break;
        c.save(); c.translate(x+g.advance/2,y);
        if (style === "typewriter-pop") {
          const age = reveal-g.index;
          const pop = 1+0.23*Math.exp(-3*age)*Math.sin(5*age);
          c.scale(pop,pop);
        }
        c.textAlign = "center"; c.font = g.font;
        if (!cinema) {
          c.strokeStyle = "#101015"; c.lineWidth = marker && g.hot ? 3 : 9;
          c.shadowColor = "#000"; c.shadowOffsetY = 5;
          c.strokeText(g.ch,0,0); c.shadowOffsetY = 0;
        }
        c.fillStyle = g.hot ? (marker && elapsed>=0.32 ? "#101015" : "#FACC15") : "#fff";
        c.fillText(g.ch,0,0); c.restore(); x += g.advance;
      }
    });
    c.restore();
  }
}
