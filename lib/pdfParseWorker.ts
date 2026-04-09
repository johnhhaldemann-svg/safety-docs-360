type PdfParseCtorLike = {
  setWorker?: (workerSrc?: string) => string;
};

function getRuntimeWorkerSrc() {
  if (typeof process === "undefined" || typeof process.cwd !== "function") {
    return "";
  }

  const cwd = process.cwd().replace(/\\/g, "/").replace(/\/$/, "");
  return `file://${cwd}/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs`;
}

export function configurePdfParseWorker(PdfParseCtor: PdfParseCtorLike | null | undefined) {
  const workerSrc = getRuntimeWorkerSrc();
  if (!workerSrc || typeof PdfParseCtor?.setWorker !== "function") {
    return;
  }

  PdfParseCtor.setWorker(workerSrc);
}
