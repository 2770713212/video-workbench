export const palettes = [
  ["#100e34", "#722a76", "#ff784d", "#ff557f", "#8c4dff"],
  ["#071c35", "#08596f", "#57ffdd", "#1ac8e2", "#208ba8"],
  ["#181035", "#452271", "#d2abff", "#bf64ff", "#885bec"],
  ["#291322", "#963249", "#ffba61", "#ff6849", "#e35963"],
  ["#0b1c29", "#23606a", "#baffcf", "#54e5b0", "#48afab"],
];
export function landscape(ctx, w, h, index = 0, t = 0) {
  const [top, mid, sun, low, grid] = palettes[index % 5],
    horizon = h * 0.61;
  ctx.save();
  let g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, top);
  g.addColorStop(0.8, mid);
  g.addColorStop(1, low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let n = 1; n < 150; n++) {
    const x = ((((Math.sin(n * 423.3) * 9876) % 1) + 1) % 1) * w,
      y = ((((Math.sin(n * 55.2) * 682) % 1) + 1) % 1) * horizon;
    ctx.fillStyle = "rgba(255,240,255," + (0.25 + (n % 5) * 0.13) + ")";
    ctx.fillRect(x, y, (w / 450) * (1 + (n % 2)), w / 450);
  }
  const r = Math.min(w * 0.28, h * 0.19),
    cx = w * 0.53,
    cy = horizon - r * 0.88;
  g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, sun);
  g.addColorStop(1, low);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, 2 * r, r * 1.05);
  for (let i = 0; i < 11; i++)
    ctx.fillRect(cx - r, cy + (i * r) / 11, 2 * r, (r / 11) * (1 - i * 0.072));
  ctx.restore();
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let i = 0; i <= 130; i++) {
      let x = i / 130,
        a = Math.abs(x - 0.51) * 1.55 + 0.1,
        y =
          horizon -
          h *
            a *
            (0.044 +
              (0.5 + 0.5 * Math.sin(i * 0.14 + k * 4)) * 0.13 +
              (0.5 + 0.5 * Math.sin(i * 0.43 + k)) * 0.048 +
              Math.abs(Math.sin(i * 17.5)) * 0.021) *
            (1 - k * 0.21);
      ctx.lineTo(x * w, y);
    }
    ctx.lineTo(w, horizon);
    ctx.closePath();
    ctx.fillStyle = ["#51315e", "#342441", "#181527"][k];
    ctx.fill();
  }
  g = ctx.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, "#321e48");
  g.addColorStop(0.65, top);
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = grid;
  ctx.globalAlpha = 0.68;
  ctx.lineWidth = w / 650;
  ctx.beginPath();
  for (let i = -20; i <= 20; i++) {
    ctx.moveTo(w * 0.5 + i * w * 0.004, horizon);
    ctx.lineTo(w * 0.5 + i * w * 0.27, h);
  }
  for (let j = 0; j < 14; j++) {
    let y = horizon + (h - horizon) * Math.pow(((j + t * 0.65) % 14) / 14, 2.7);
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();
}
export function mime() {
  return ["video/mp4;codecs=h264", "video/webm;codecs=vp9", "video/webm"].find(
    (m) => window.MediaRecorder?.isTypeSupported(m),
  );
}
export class DemoGenerator {
  async generate(progress) {
    const c = document.createElement("canvas");
    c.width = 360;
    c.height = 640;
    const ctx = c.getContext("2d"),
      stream = c.captureStream(30),
      rec = new MediaRecorder(stream, { mimeType: mime() }),
      chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise((ok, fail) => {
      rec.onstop = () => ok(new Blob(chunks, { type: rec.mimeType }));
      rec.onerror = (e) => fail(e.error);
    });
    const draw = (t) => {
      const i = Math.min(4, Math.floor(t / 2));
      landscape(ctx, 360, 640, i, t);
      ctx.fillStyle = palettes[i][1];
      ctx.fillRect(0, 0, 360, 60);
      ctx.fillStyle = "white";
      ctx.font = "15px monospace";
      ctx.fillText("SYNTHWAVE  /  TAKE 0" + (i + 1), 20, 35);
    };
    draw(0);
    rec.start();
    const start = performance.now();
    await new Promise((resolve) => {
      function frame() {
        let t = (performance.now() - start) / 1000;
        if (t >= 10) return resolve();
        draw(t);
        progress(t / 10);
        requestAnimationFrame(frame);
      }
      frame();
    });
    rec.stop();
    try {
      return await done;
    } finally {
      stream.getTracks().forEach((t) => t.stop());
    }
  }
}
