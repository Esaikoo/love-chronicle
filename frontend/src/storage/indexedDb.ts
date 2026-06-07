import { DBSchema, IDBPDatabase, openDB } from "idb";

export const BLOB_STORES = [
  "heartPhotos",
  "musicTracks",
  "musicCovers",
  "checkinImages",
  "calendarImages",
  "countdownCovers"
] as const;

export type BlobStoreName = (typeof BLOB_STORES)[number];

type BlobRecord = {
  id: string;
  blob: Blob;
  name?: string;
  type?: string;
  size?: number;
  createdAt: string;
};

type BlobMeta = Omit<BlobRecord, "blob">;

interface LoveChronicleDb extends DBSchema {
  heartPhotos: { key: string; value: BlobRecord };
  musicTracks: { key: string; value: BlobRecord };
  musicCovers: { key: string; value: BlobRecord };
  checkinImages: { key: string; value: BlobRecord };
  calendarImages: { key: string; value: BlobRecord };
  countdownCovers: { key: string; value: BlobRecord };
}

let dbPromise: Promise<IDBPDatabase<LoveChronicleDb>> | undefined;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<LoveChronicleDb>("love-chronicle-assets", 1, {
      upgrade(db) {
        BLOB_STORES.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: "id" });
          }
        });
      }
    });
  }
  return dbPromise;
}

export async function saveBlob(storeName: BlobStoreName, id: string, blob: Blob, name?: string) {
  const db = await getDb();
  await db.put(storeName, {
    id,
    blob,
    name,
    type: blob.type,
    size: blob.size,
    createdAt: new Date().toISOString()
  });
}

export async function getBlob(storeName: BlobStoreName, id: string) {
  const db = await getDb();
  const record = await db.get(storeName, id);
  return record?.blob;
}

export async function deleteBlob(storeName: BlobStoreName, id: string) {
  const db = await getDb();
  await db.delete(storeName, id);
}

export async function listBlobMeta(storeName: BlobStoreName): Promise<BlobMeta[]> {
  const db = await getDb();
  const records = await db.getAll(storeName);
  return records.map(({ blob: _blob, ...meta }) => meta);
}
