import { openDB } from "idb";

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  blob: Blob;
  mimeType: string;
  addedAt: number;
}

const DB_NAME = "musi-vault";
const STORE_NAME = "tracks";

const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "id" });
    }
  },
});

export async function getAllTracks(): Promise<MusicTrack[]> {
  const db = await dbPromise;
  return db.getAll(STORE_NAME);
}

export async function saveTrack(track: MusicTrack): Promise<void> {
  const db = await dbPromise;
  await db.put(STORE_NAME, track);
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
}

export async function updateTrackDuration(
  id: string,
  duration: number,
): Promise<void> {
  const db = await dbPromise;
  const track = await db.get(STORE_NAME, id);

  if (track) {
    track.duration = duration;
    await db.put(STORE_NAME, track);
  }
}
