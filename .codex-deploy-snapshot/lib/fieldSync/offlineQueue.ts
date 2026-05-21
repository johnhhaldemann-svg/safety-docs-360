/**
 * IndexedDB queue for toolbox field-sync operations (browser only).
 * Used by the jobsite toolbox page as an offline pilot.
 */

const DB_NAME = "safety360-field-sync";
const DB_VERSION = 1;
const STORE = "toolbox_ops";

export type QueuedToolboxOp = {
  localId: string;
  queuedAt: string;
  operation: Record<string, unknown>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
  });
}

export async function enqueueToolboxOperation(operation: Record<string, unknown>): Promise<string> {
  const localId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const row: QueuedToolboxOp = {
    localId,
    queuedAt: new Date().toISOString(),
    operation,
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve(localId);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("enqueue failed"));
    };
    tx.objectStore(STORE).put(row);
  });
}

export async function listQueuedToolboxOperations(): Promise<QueuedToolboxOp[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as QueuedToolboxOp[]) ?? []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error("list failed"));
    };
  });
}

export async function removeQueuedToolboxOperation(localId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("remove failed"));
    };
    tx.objectStore(STORE).delete(localId);
  });
}
