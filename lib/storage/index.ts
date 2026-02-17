export type StorageDriver = "local" | "s3";

export interface StorageAdapter {
  driver: StorageDriver;
  // placeholder interface for phase-2 S3 implementation
}

export const storageAdapter: StorageAdapter = {
  driver: "local"
};
