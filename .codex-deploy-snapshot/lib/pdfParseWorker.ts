type PdfJsWorkerGlobal = typeof globalThis & {
  pdfjsWorker?: {
    WorkerMessageHandler?: unknown;
  };
};

let workerModulePromise: Promise<void> | null = null;

/**
 * Preload pdf.js' worker message handler into the main thread so pdf-parse
 * can use its fake-worker path without looking up a worker file on disk.
 */
export async function ensurePdfParseWorkerHandler() {
  const g = globalThis as PdfJsWorkerGlobal;
  if (g.pdfjsWorker?.WorkerMessageHandler) {
    return;
  }

  if (!workerModulePromise) {
    workerModulePromise = import("pdfjs-dist/legacy/build/pdf.worker.mjs")
      .then((workerModule) => {
        g.pdfjsWorker = {
          WorkerMessageHandler: workerModule.WorkerMessageHandler,
        };
      })
      .catch((error) => {
        workerModulePromise = null;
        throw error;
      });
  }

  await workerModulePromise;
}
