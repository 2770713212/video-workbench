import { mime } from "./demo-generator.js";
export class VideoExporter {
  async record(renderer, progress) {
    const type = mime();
    if (!type || !renderer.canvas.captureStream)
      throw Error("当前浏览器不支持画布录制");
    await renderer.goto(0);
    const stream = renderer.canvas.captureStream(60),
      chunks = [];
    try {
      const rec = new MediaRecorder(stream, {
          mimeType: type,
          videoBitsPerSecond: 8000000,
        }),
        result = new Promise((ok, fail) => {
          rec.ondataavailable = (e) => chunks.push(e.data);
          rec.onstop = () => ok(new Blob(chunks, { type: rec.mimeType }));
          rec.onerror = (e) => fail(e.error);
        });
      rec.start();
      await renderer.play(0, (t) => progress(t / renderer.duration));
      rec.stop();
      return await result;
    } finally {
      stream.getTracks().forEach((t) => t.stop());
    }
  }
}
