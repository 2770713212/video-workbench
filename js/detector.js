export function once(el, name) {
  return new Promise((ok, fail) => {
    const clean = () => {
        el.removeEventListener(name, success);
        el.removeEventListener("error", error);
      },
      success = () => {
        clean();
        ok();
      },
      error = () => {
        clean();
        fail(Error("浏览器无法解码该素材"));
      };
    el.addEventListener(name, success, { once: true });
    el.addEventListener("error", error, { once: true });
  });
}
export async function seek(v, t) {
  if (Math.abs(v.currentTime - t) < 0.0001 && v.readyState >= 2) return;
  const ready = once(v, "seeked");
  v.currentTime = t;
  await ready;
}
export async function video(url) {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  const ready = once(v, "loadeddata");
  v.src = url;
  await ready;
  if (!Number.isFinite(v.duration)) {
    await seek(v, 1e8);
    await seek(v, 0);
  }
  return v;
}
export class SceneDetector {
  async scan(v, sensitivity, progress, step = 0.1) {
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 90;
    const ctx = c.getContext("2d", { willReadFrequently: true }),
      shots = [];
    let prev, hist;
    for (let n = 0; n * step < v.duration - 0.015; n++) {
      const t = n * step;
      await seek(v, t);
      ctx.drawImage(v, 0, 0, 160, 90);
      const p = ctx.getImageData(0, 0, 160, 90).data,
        h = new Uint32Array(48);
      let mad = 0;
      for (let i = 0; i < p.length; i += 4)
        for (let j = 0; j < 3; j++) {
          h[j * 16 + (p[i + j] >> 4)]++;
          if (prev) mad += Math.abs(p[i + j] - prev[i + j]);
        }
      const diff = hist
        ? h.reduce((s, a, i) => s + Math.abs(a - hist[i]), 0) / (160 * 90 * 6)
        : 0;
      if (
        !prev ||
        (0.65 * diff + (0.35 * mad) / (160 * 90 * 3 * 255) >
          0.045 + 0.36 * (1 - sensitivity) &&
          t - shots.at(-1).startTime >= 0.25)
      ) {
        shots.push({
          startTime: t,
          thumbnailDataUrl: c.toDataURL("image/jpeg", 0.8),
        });
      }
      prev = p;
      hist = h;
      progress(t / v.duration);
    }
    return shots.map((s, i) => ({
      ...s,
      endTime: shots[i + 1]?.startTime ?? v.duration,
      duration: (shots[i + 1]?.startTime ?? v.duration) - s.startTime,
    }));
  }
}
