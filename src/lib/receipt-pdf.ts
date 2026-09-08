/**
 * Receipt PDF export.
 *
 * Renders the on-screen receipt element to a high-DPI canvas and places it on a
 * single A4 portrait page with a small margin. jsPDF + html2canvas-pro are
 * imported on demand so they stay out of the initial bundle.
 */

const A4 = { w: 210, h: 297 };
const MARGIN_MM = 12;
let inflight: Promise<void> | null = null;

export async function downloadReceiptPdf(
  target: HTMLElement,
  filename: string,
): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas-pro"),
    ]);

    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
    }

    const canvas = await html2canvas(target, {
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const maxW = A4.w - MARGIN_MM * 2;
    const maxH = A4.h - MARGIN_MM * 2;
    const ratio = canvas.width / canvas.height;
    let drawW = maxW;
    let drawH = maxW / ratio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = maxH * ratio;
    }
    const x = (A4.w - drawW) / 2;
    const y = MARGIN_MM;

    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, y, drawW, drawH, undefined, "FAST");
    pdf.save(filename);
  })();
  try {
    await inflight;
  } finally {
    inflight = null;
  }
}
