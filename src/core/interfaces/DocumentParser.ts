export interface IDocumentParser {
  extractText(fileBuffer: ArrayBuffer): Promise<string>;
}

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentParseError";
  }
}

export class PDFParser implements IDocumentParser {
  protected static readonly MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

  protected validate(fileBuffer: ArrayBuffer): void {
    const head = new Uint8Array(fileBuffer, 0, Math.min(5, fileBuffer.byteLength));
    if (head.length < 5 || !PDFParser.MAGIC.every((b, i) => head[i] === b)) {
      throw new DocumentParseError("File is not a valid PDF document.");
    }
  }

  /** Stub: subclasses plug in pdfjs / OCR engines. */
  protected async extractRaw(_fileBuffer: ArrayBuffer): Promise<string> {
    return "";
  }

  async extractText(fileBuffer: ArrayBuffer): Promise<string> {
    this.validate(fileBuffer);
    const raw = await this.extractRaw(fileBuffer);
    return raw.replace(/\s+/g, " ").trim();
  }
}
