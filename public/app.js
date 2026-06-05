const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100%}
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f1117;color:#e8eaef}
button,input,textarea{font:inherit}
button{cursor:pointer}
.shell{max-width:920px;margin:0 auto;padding:0 0 24px}
.header{padding:16px;border-bottom:1px solid #242833;background:#151821}
.header h1{font-size:16px;font-weight:600}
.controls{display:grid;grid-template-columns:1fr auto;gap:10px;padding:16px;border-bottom:1px solid #242833;background:#151821;align-items:end}
.results{display:grid;gap:12px;padding:16px}
.player-wrap{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden;border:1px solid #2f3545}
.player-wrap video{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
.field{display:flex;flex-direction:column;gap:6px}
.field-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.field span{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#8b93a7}
.field input,.field textarea{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #2f3545;background:#0f1117;color:#e8eaef;font-size:12px}
.field textarea{min-height:72px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.field textarea[readonly]{color:#c5cad6}
.btn{padding:8px 12px;border-radius:8px;border:1px solid #2f3545;background:#1c2130;color:#e8eaef;font-size:12px}
.btn-primary{padding:10px 16px;background:#ffbd0f;border-color:#ffbd0f;color:#151821;font-weight:600}
.btn:disabled{opacity:.45;cursor:not-allowed}
.footer{padding:0 16px;font-size:12px;color:#8b93a7}
`;

let ui;
let hls;

function $(id) {
  return document.getElementById(id);
}

function status(text) {
  ui.status.textContent = text;
}

function stop() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  ui.player.removeAttribute("src");
  ui.player.load();
}

function play(url) {
  stop();
  const Hls = window.Hls;
  if (!Hls?.isSupported()) {
    status("HLS not supported in this browser");
    return;
  }
  hls = new Hls({
    enableWorker: true,
    liveDurationInfinity: true,
    liveSyncDurationCount: 3,
    liveMaxLatencyDurationCount: 6,
    fragLoadingTimeOut: 60000,
    manifestLoadingTimeOut: 30000,
  });
  hls.loadSource(url);
  hls.attachMedia(ui.player);
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    ui.player.play().catch(() => undefined);
  });
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      hls.startLoad();
      return;
    }
    status(`Playback error: ${data.details ?? data.type ?? "unknown"}`);
  });
}

async function resolve() {
  const pageUrl = ui.pageUrl.value.trim();
  if (!pageUrl) {
    status("Paste a match page URL first");
    return;
  }
  if (ui.resolveBtn.disabled) return;
  ui.resolveBtn.disabled = true;
  status("Resolving…");
  ui.playableUrl.value = "";
  stop();
  ui.results.hidden = true;
  try {
    const res = await fetch(`/api/resolve-link?url=${encodeURIComponent(pageUrl)}`);
    const result = await res.json();
    if (!res.ok) throw new Error(result.error ?? `Request failed (${res.status})`);
    ui.playableUrl.value = result.playableUrl ?? "";
    ui.results.hidden = false;
    if (result.playableUrl) play(result.playableUrl);
    status(result.name ? `Playing ${result.name}` : "Playing");
  } catch (error) {
    status(error instanceof Error ? error.message : "Resolve failed");
  } finally {
    ui.resolveBtn.disabled = false;
  }
}

document.head.appendChild(Object.assign(document.createElement("style"), { textContent: css }));
ui = {
  results: $("results"),
  pageUrl: $("pageUrl"),
  resolveBtn: $("resolveBtn"),
  playableUrl: $("playableUrl"),
  player: $("player"),
  status: $("status"),
};
ui.resolveBtn.addEventListener("click", () => resolve());
ui.pageUrl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") resolve();
});
document.querySelectorAll("[data-copy]").forEach((node) => {
  node.addEventListener("click", () => {
    const field = $(node.dataset.copy);
    if (!field?.value) return;
    navigator.clipboard.writeText(field.value).then(() => status("Copied"));
  });
});
const queryUrl = new URLSearchParams(location.search).get("url")?.trim();
if (queryUrl) {
  ui.pageUrl.value = queryUrl;
  resolve();
} else {
  status("Paste a match page URL, then Resolve");
}
