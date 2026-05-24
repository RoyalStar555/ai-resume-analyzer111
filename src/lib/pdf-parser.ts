// Browser-only PDF text extraction using pdfjs-dist.
import * as pdfjs from "pdfjs-dist";
// Worker as a URL — Vite will bundle it.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string;
}

export class EmptyPdfTextError extends Error {
  constructor() {
    super(
      "This PDF contains no readable text. It may be a scanned/image-based PDF — please upload a text-based PDF.",
    );
    this.name = "EmptyPdfTextError";
  }
}

export async function extractTextFromPdf(file: File): Promise<string> {
  let pdf;
  try {
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    pdf = await loadingTask.promise;
  } catch (err) {
    console.error("PDF load failed:", err);
    throw new Error("Could not open this PDF. The file may be corrupted or password-protected.");
  }

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ") + "\n";
    } catch (err) {
      console.warn(`PDF page ${i} extraction failed:`, err);
    }
  }

  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length < 30) {
    throw new EmptyPdfTextError();
  }
  return text.trim();
}
