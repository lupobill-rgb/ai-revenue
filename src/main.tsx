import { createRoot } from "react-dom/client";
import "./index.css";

function renderStartupError(err: unknown) {
  // eslint-disable-next-line no-console
  console.error("[startup] failed to load app", err);

  const message =
    err instanceof Error
      ? `${err.name}: ${err.message}\n\n${err.stack ?? ""}`
      : typeof err === "string"
        ? err
        : JSON.stringify(err, null, 2);

  const el = document.getElementById("root");
  if (el) {
    el.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#02040a;color:#fff;font-family:ui-sans-serif,system-ui,-apple-system;">
        <div style="max-width:900px;width:100%;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:20px;background:rgba(255,255,255,0.04);">
          <div style="font-size:18px;font-weight:700;margin-bottom:8px;">App failed to start</div>
          <div style="opacity:0.8;margin-bottom:12px;">Open DevTools Console for full details. The error is also printed below:</div>
          <pre style="white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.35;opacity:0.95;margin:0;">${message
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")}</pre>
        </div>
      </div>
    `;
  }
}

(async () => {
  try {
    const { default: App } = await import("./App.tsx");
    createRoot(document.getElementById("root")!).render(<App />);
  } catch (err) {
    renderStartupError(err);
  }
})();
