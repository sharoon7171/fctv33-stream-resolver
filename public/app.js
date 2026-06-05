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
    status("Paste a fctv33hd.rest match page URL first");
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
  status("Open fctv33hd.rest → Live or a sport → match page → paste URL");
}
