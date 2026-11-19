export class VideoExporter {
  async record(renderer, progress) {
    const audio = renderer.audio;
    await audio.ensureContext();
    const type = ["video/mp4;codecs=avc1.42E02A,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"]
      .find(m => window.MediaRecorder?.isTypeSupported(m));
    if (!type || !renderer.canvas.captureStream) throw Error("当前浏览器不支持音画混流录制");
    const destination = audio.ctx.createMediaStreamDestination();
    const stream = new MediaStream([
      ...renderer.canvas.captureStream(60).getVideoTracks(), ...destination.stream.getAudioTracks(),
    ]);
    audio.master.connect(destination);
    try {
      const recorder = new MediaRecorder(stream, {mimeType: type, videoBitsPerSecond: 8000000});
      const chunks = [];
      const result = new Promise((resolve, reject) => {
        recorder.ondataavailable = e => chunks.push(e.data);
        recorder.onerror = e => reject(e.error || Error("录制失败"));
        recorder.onstop = () => resolve(new Blob(chunks, {type: recorder.mimeType}));
      });
      const playback = renderer.play(0, t => progress(t / renderer.duration), () => recorder.start());
      await Promise.race([playback, result]);
      if (recorder.state !== "inactive") recorder.stop();
      return await result;
    } finally {
      renderer.pause();
      audio.master.disconnect(destination);
      stream.getTracks().forEach(track => track.stop());
    }
  }
}
