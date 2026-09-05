// Browser-only fallback. This module is dynamically imported only after text extraction fails.
export async function extractTextWithOcr(
  file: File,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (typeof window === "undefined") throw new Error("OCR is only available in the browser.");
  const [{ createWorker }, pdfjs] = await Promise.all([import("tesseract.js"), import("pdfjs-dist")]);
  const worker = await createWorker("eng");
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pageCount = Math.min(pdf.numPages, 5);
    let text = "";
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      if (signal?.aborted) throw new DOMException("Canceled", "AbortError");
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      text += `${result.data.text}\n`;
      onProgress?.(Math.round((pageNumber / pageCount) * 100));
    }
    return text.trim();
  } finally {
    await worker.terminate();
  }
}