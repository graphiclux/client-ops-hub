import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

export type SavedFile = {
  path: string;
  size: number;
};

export async function saveAttachment(file: File): Promise<SavedFile> {
  const datePrefix = new Date().toISOString().slice(0, 10);
  const dir = path.join(env.FILE_STORAGE_PATH, datePrefix);
  await mkdir(dir, { recursive: true });

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const filename = `${randomUUID()}.${extension}`;
  const filePath = path.join(dir, filename);
  const bytes = await file.arrayBuffer();

  await writeFile(filePath, Buffer.from(bytes));
  return { path: filePath, size: bytes.byteLength };
}

export async function readAttachment(storagePath: string) {
  return readFile(storagePath);
}
