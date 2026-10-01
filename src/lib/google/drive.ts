import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

const APP_FOLDER_NAME = "Shelf Library";

async function getAuthorizedDrive(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_google_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error(
      "No Google Drive connection for this account. Sign out and back in to grant Drive access."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: data.refresh_token });

  return google.drive({ version: "v3", auth: oauth2Client });
}

async function getOrCreateAppFolderId(
  drive: Awaited<ReturnType<typeof getAuthorizedDrive>>
) {
  const existing = await drive.files.list({
    q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  const existingId = existing.data.files?.[0]?.id;
  if (existingId) return existingId;

  const created = await drive.files.create({
    requestBody: {
      name: APP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  return created.data.id!;
}

export async function uploadBookFile(
  userId: string,
  file: { name: string; mimeType: string; buffer: Buffer }
) {
  const drive = await getAuthorizedDrive(userId);
  const folderId = await getOrCreateAppFolderId(drive);
  const { Readable } = await import("node:stream");

  const response = await drive.files.create({
    requestBody: { name: file.name, parents: [folderId] },
    media: { mimeType: file.mimeType, body: Readable.from(file.buffer) },
    fields: "id, size",
  });

  return {
    driveFileId: response.data.id!,
    sizeBytes: Number(response.data.size ?? 0),
  };
}

export async function getBookFileStream(userId: string, driveFileId: string) {
  const drive = await getAuthorizedDrive(userId);
  const response = await drive.files.get(
    { fileId: driveFileId, alt: "media" },
    { responseType: "stream" }
  );
  return response.data;
}

export async function deleteBookFile(userId: string, driveFileId: string) {
  const drive = await getAuthorizedDrive(userId);
  await drive.files.delete({ fileId: driveFileId });
}
