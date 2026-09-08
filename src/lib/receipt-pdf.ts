/**
 * Payment receipt PDF export.
 *
 * Renders a live receipt element to a high-DPI canvas with html2canvas-pro
 * (Tailwind v4 oklch-safe) and places it on a single A4 portrait page.
 * Both libraries are imported on demand so they stay out of the main bundle.
 */

const A4_MM = { w: 210, h: 297 };
let inflight: Promise<void> | null = null;

export async function downloadReceiptPdf(target: HTMLElement, filename: string): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas-pro"),
    ]);

    if (document.fonts?.ready) {
      try { await document.fonts.ready; } catch { /* ignore */ }
    }
    const imgs = Array.from(target.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.addEventListener("load", () => res(), { once: true });
              img.addEventListener("error", () => res(), { once: true });
            }),
      ),
    );

    const canvas = await html2canvas(target, {
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

    // Fit inside a 12mm margin, top-aligned (a receipt is not a full page).
    const margin = 12;
    const maxW = A4_MM.w - margin * 2;
    const maxH = A4_MM.h - margin * 2;
    const ratio = canvas.width / canvas.height;
    let drawW = maxW;
    let drawH = drawW / ratio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * ratio;
    }
    const x = (A4_MM.w - drawW) / 2;

    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, margin, drawW, drawH, undefined, "FAST");
    pdf.save(filename);
  })();
  try {
    await inflight;
  } finally {
    inflight = null;
  }
}
