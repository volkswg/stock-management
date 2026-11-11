import "server-only";
import type { IGoogleDriveService } from "@/infrastructure/files/google-drive/types";
import { requireMutation, storageMode } from "@/infrastructure/persistence/postgres/database";

// Compensate only files whose IDs this request received. This boundary runs
// inside the staging business transaction; an unsuccessful response rolls back
// that transaction. It does not catch COMMIT acknowledgement loss afterward.
export async function withStagingUploadCleanup<T>(drive: IGoogleDriveService, operation: (tracked: IGoogleDriveService) => Promise<T>): Promise<T> {
  if (storageMode() !== "supabase") return operation(drive);
  requireMutation();
  const uploaded = new Set<string>(), attemptedDeletion = new Set<string>();
  const tracked: IGoogleDriveService = {
    async uploadImage(input) {
      const file = await drive.uploadImage(input);
      if (typeof file.id !== "string" || !file.id.trim()) throw new Error("Staging upload identity requires reconciliation.");
      uploaded.add(file.id);
      return file;
    },
    async deleteFile(id) {
      attemptedDeletion.add(id);
      await drive.deleteFile(id);
    },
    makeFileReadableByLink: id => drive.makeFileReadableByLink(id),
    checkConnection: () => drive.checkConnection(),
  };
  const compensate = async () => {
    for (const id of uploaded) if (!attemptedDeletion.has(id)) {
      try { await tracked.deleteFile(id); }
      catch { console.error("Staging upload cleanup requires reconciliation."); }
    }
  };
  try {
    const result = await operation(tracked);
    if (result instanceof Response && result.status >= 400) await compensate();
    return result;
  } catch (error) {
    await compensate();
    throw error;
  }
}
