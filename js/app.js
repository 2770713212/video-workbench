import { DemoGenerator, landscape } from "./demo-generator.js";
import { SceneDetector, video } from "./detector.js";
import { TimelineStore, tags } from "./store.js";
import { CanvasRenderer } from "./renderer.js";
import { VideoExporter } from "./exporter.js";
const $ = (id) => document.getElementById(id),
  store = new TimelineStore(),
  renderer = new CanvasRenderer($("screen"), store),
  detector = new SceneDetector();
let selected = 0,
  busy = false,
  originalUrl,
  exportUrl;
const fmt = (t) =>
    String(Math.floor(t / 60)).padStart(2, "0") +
    ":" +
    (t % 60).toFixed(1).padStart(4, "0"),
  num = (i) => String(i + 1).padStart(2, "0");
function opts(id, values) {
  values.forEach((v) => $(id).add(new Option(v, v)));
}
opts("tag", tags);
opts("motion", ["静止", "缓慢推近", "缓慢拉远", "卡点微震动"]);
opts("theme", ["赛博网格", "极光渐变", "暗黑噪点"]);
const names = ["霓虹地平线", "潮汐之夜", "月下回声", "落日余晖", "星海尽头"];
store.reset(
  names.map((name, i) => {
    const c = document.createElement("canvas");
    c.width = 210;
    c.height = 110;
    landscape(c.getContext("2d"), 210, 110, i);
    return {
      art: i,
      startTime: i * 2,
      endTime: i * 2 + 2,
      duration: 2,
      thumbnailDataUrl: c.toDataURL(),
      caption: i ? "" : "驶入[霓虹]地平线",
    };
  }),
);
function stop() {
  renderer.pause();
  renderer.finish?.();
  $("play").textContent = "▶";
  $("play").ariaLabel = "播放";
}
function status(s) {
  $("status").textContent = s;
}
function view(t) {
  $("clock").textContent = fmt(t);
  $("scrub").value = t;
}
function activate(i) {
  selected = i;
  const s = store.shots[i];
  ["cards", "blocks"].forEach((id) =>
    [...$(id).children].forEach((el, n) =>
      el.classList.toggle("active", i === n),
    ),
  );
  $("shotTitle").textContent =
    "SHOT " + num(i) + "　/　" + s.duration.toFixed(1) + " s";
  for (const key of ["caption", "tag", "motion", "theme"])
    $(key).value = s[key];
  limit();
  $("theme").hidden = s.source !== "dynamic";
  $("replace").hidden = s.source !== "asset";
  document
    .querySelectorAll("[data-src]")
    .forEach((b) => b.classList.toggle("active", b.dataset.src === s.source));
  $("merge").disabled = i === store.shots.length - 1;
}
function limit() {
  $("limit").textContent =
    Array.from($("caption").value.replace(/\[([^\]]*)\]/g, "$1")).length +
    " 字 / 建议 ≤ " +
    Math.floor(store.shots[selected].duration * 4.5) +
    " 字";
}
async function jump(t) {
  stop();
  activate(renderer.index(t));
  view(t);
  await renderer.goto(t);
}
function render() {
  const shots = store.shots;
  $("count").textContent = shots.length + " 个分镜";
  $("scrub").max = renderer.duration;
  $("total").textContent = fmt(renderer.duration);
  $("blocks").replaceChildren();
  $("cards").replaceChildren();
  $("ruler").replaceChildren();
  for (let i = 0; i <= 5; i++) {
    const el = document.createElement("span");
    el.textContent = ((renderer.duration * i) / 5).toFixed(1) + "s";
    $("ruler").append(el);
  }
  shots.forEach((s, i) => {
    const b = document.createElement("button");
    b.textContent = num(i);
    b.style.flex = s.duration + " 1 0";
    b.className = s.duration < 1.5 ? "fast" : s.duration > 3 ? "slow" : "";
    const card = document.createElement("button"),
      img = new Image(),
      span = document.createElement("span");
    img.src = s.thumbnailDataUrl;
    img.alt = "";
    span.textContent = num(i) + "　" + s.duration.toFixed(1) + "s";
    const caption = document.createElement("small");
    caption.className = "cardCaption";
    caption.textContent = s.caption;
    card.append(img, span, caption);
    card.onclick = b.onclick = () => jump(s.startTime);
    $("blocks").append(b);
    $("cards").append(card);
  });
  $("undo").disabled = !store.past.length;
  $("redo").disabled = !store.future.length;
  activate(Math.min(selected, shots.length - 1));
}
function setProgress(t) {
  $("progress").value = t;
  status(operation + " " + Math.round(t * 100) + "%");
}
let operation = "";
async function job(title, fn) {
  if (busy) return;
  stop();
  busy = true;
  operation = title;
  document.querySelector("main").inert = true;
  $("progress").hidden = false;
  setProgress(0);
  try {
    await fn();
    status("● " + title + "完成");
  } catch (e) {
    status(e.message);
  } finally {
    document.querySelector("main").inert = false;
    $("progress").hidden = true;
    busy = false;
  }
}
async function scan(v) {
  return detector.scan(v, Number($("sense").value), setProgress);
}
async function load(blob, name) {
  const url = URL.createObjectURL(blob);
  try {
    const v = await video(url);
    operation = "分析切镜";
    const shots = await scan(v);
    store.reset(shots);
    renderer.original = v;
    URL.revokeObjectURL(originalUrl);
    originalUrl = url;
    selected = 0;
    $("filename").textContent = name;
    render();
    await jump(0);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}
$("demo").onclick = () =>
  job("生成测试样片", async () =>
    load(
      await new DemoGenerator().generate(setProgress),
      "霓虹地平线 · 内置测试样片",
    ),
  );
$("scan").onclick = () =>
  job("重新扫描", async () => {
    if (!renderer.original)
      return load(
        await new DemoGenerator().generate(setProgress),
        "霓虹地平线 · 内置测试样片",
      );
    const shots = await scan(renderer.original);
    store.reset(shots);
    selected = 0;
    render();
    await jump(0);
  });
$("sense").oninput = (e) =>
  ($("sensVal").textContent = Number(e.target.value).toFixed(2));
$("load").onclick = () => $("movie").click();
$("movie").onchange = (e) => {
  let f = e.target.files[0];
  if (f) job("导入视频", () => load(f, f.name));
  e.target.value = "";
};
window.ondragover = (e) => e.preventDefault();
window.ondrop = (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f) job("导入视频", () => load(f, f.name));
};
$("play").onclick = async () => {
  if (renderer.playing) return stop();
  $("play").textContent = "Ⅱ";
  $("play").ariaLabel = "暂停";
  await renderer.play(
    renderer.time >= renderer.duration - 0.01 ? 0 : renderer.time,
    (t) => {
      view(t);
      if (renderer.index(t) !== selected) activate(renderer.index(t));
    },
  );
  if (!renderer.playing) $("play").textContent = "▶";
};
$("scrub").oninput = (e) => jump(+e.target.value);
function edit(data) {
  stop();
  store.edit(selected, data);
  render();
  renderer.goto(renderer.time);
}
for (const key of ["tag", "motion", "theme"])
  $(key).onchange = (e) => edit({ [key]: e.target.value });
$("caption").onfocus = () => stop();
$("caption").oninput = (e) => {
  store.edit(selected, { caption: e.target.value });
  $("cards").children[selected].querySelector(".cardCaption").textContent = e.target.value;
  limit();
  renderer.draw(renderer.time);
  $("undo").disabled = false;
  $("redo").disabled = true;
};
$("split").onclick = () => {
  stop();
  if (store.split(selected, renderer.time)) {
    render();
    jump(renderer.time);
  } else status("请将播放头移至镜头内部再拆分");
};
$("merge").onclick = () => {
  stop();
  store.merge(selected);
  render();
  jump(renderer.time);
};
for (const name of ["undo", "redo"])
  $(name).onclick = () => {
    stop();
    store[name]();
    render();
    jump(renderer.time);
  };
document
  .querySelectorAll("[data-src]")
  .forEach(
    (b) =>
      (b.onclick = () =>
        b.dataset.src === "asset"
          ? $("asset").click()
          : edit({ source: b.dataset.src })),
  );
$("replace").onclick = () => $("asset").click();
async function asset(url) {
  if (renderer.assets.has(url)) return;
  let m;
  if (url?.startsWith("data:video/")) m = await video(url);
  else if (url?.startsWith("data:image/")) {
    m = new Image();
    m.src = url;
    await m.decode();
  } else throw Error("无效素材");
  renderer.assets.set(url, m);
}
$("asset").onchange = (e) => {
  const f = e.target.files[0];
  if (f)
    job("加载素材", async () => {
      const data = await new Promise((ok, fail) => {
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.onerror = () => fail(r.error);
        r.readAsDataURL(f);
      });
      await asset(data);
      edit({ source: "asset", asset: data });
    });
  e.target.value = "";
};
function download(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}
$("jsonOut").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([store.export()], { type: "application/json" }),
  );
  download(url, "cutlab-timeline.json");
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("jsonIn").onclick = () => $("json").click();
$("json").onchange = (e) => {
  const f = e.target.files[0];
  if (f)
    job("导入时间轴", async () => {
      const raw = await f.text(),
        tmp = new TimelineStore();
      tmp.import(raw, renderer.duration);
      for (const s of tmp.shots) if (s.source === "asset") await asset(s.asset);
      store.import(raw, renderer.duration);
      render();
      await jump(0);
    });
  e.target.value = "";
};
$("export").onclick = () =>
  job("导出视频", async () => {
    const blob = await new VideoExporter().record(renderer, setProgress);
    URL.revokeObjectURL(exportUrl);
    exportUrl = URL.createObjectURL(blob);
    const a = $("download");
    a.href = exportUrl;
    a.download =
      "cutlab-export." + (blob.type.includes("mp4") ? "mp4" : "webm");
    a.hidden = false;
    a.click();
    await jump(0);
  });
render();
jump(0);
for (const panel of document.querySelectorAll(".panel")) {
  const toggle = document.createElement("button");
  toggle.className = "fold";
  toggle.textContent = "⌃";
  toggle.setAttribute(
    "aria-label",
    "折叠或展开" + panel.querySelector("h2").childNodes[1].textContent.trim(),
  );
  toggle.setAttribute("aria-expanded", "true");
  toggle.onclick = () => {
    const folded = panel.classList.toggle("folded");
    toggle.textContent = folded ? "⌄" : "⌃";
    toggle.setAttribute("aria-expanded", String(!folded));
  };
  panel.querySelector("h2").append(toggle);
}

let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 3000);
}
for (const button of document.querySelectorAll("[data-close]")) {
  button.onclick = () => button.closest("dialog").close();
}
$("aiCopy").onclick = () => {
  stop();
  $("copyError").textContent = "";
  $("manualPrompt").hidden = true;
  $("topicDialog").showModal();
};
$("topicForm").onsubmit = async (event) => {
  event.preventDefault();
  let prompt;
  try {
    prompt = store.exportAIPrompt($("aiTopic").value);
    await navigator.clipboard.writeText(prompt);
    $("topicDialog").close();
    toast("AI 改写提示词已复制");
  } catch (error) {
    if (!prompt) { $("copyError").textContent = error.message; return; }
    const field = $("manualPrompt");
    field.hidden = false;
    field.value = prompt;
    field.select();
    if (document.execCommand("copy")) {
      $("topicDialog").close();
      toast("AI 改写提示词已复制");
    } else {
      $("copyError").textContent = "浏览器未允许自动复制，请手动复制选中的提示词。";
    }
  }
};
$("aiImport").onclick = () => {
  stop();
  $("scriptError").textContent = "";
  $("scriptDialog").showModal();
};
$("aiScript").oninput = () => { $("scriptError").textContent = ""; };
$("scriptForm").onsubmit = async (event) => {
  event.preventDefault();
  let count;
  try { count = store.importAIScript($("aiScript").value); }
  catch (error) { $("scriptError").textContent = error.message; return; }
  $("scriptDialog").close();
  render();
  await jump(renderer.time);
  toast("已导入 " + count + " 个分镜，可一键撤销");
};
