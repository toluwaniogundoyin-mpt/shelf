import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { uploadBookFile } from "@/lib/google/drive";
import { fetchBookMetadata } from "@/lib/book-metadata";

type Format = "pdf" | "epub";

const MIME_TO_FORMAT: Record<string, Format> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
};

function detectFormat(file: File): Format | null {
  if (MIME_TO_FORMAT[file.type]) return MIME_TO_FORMAT[file.type];
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".epub")) return "epub";
  return null;
}

async function resolveCategoryId(
  supabase: SupabaseClient,
  userId: string,
  name: string
) {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("categories")
    .insert({ user_id: userId, name })
    .select("id")
    .single();

  if (error) throw error;
  return created.id as string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const title = formData.get("title");
  const author = formData.get("author");
  const categoryName = formData.get("category");
  const clientCoverRaw = formData.get("clientCover");
  const clientCover =
    typeof clientCoverRaw === "string" &&
    clientCoverRaw.startsWith("data:image/") &&
    clientCoverRaw.length < 2_000_000
      ? clientCoverRaw
      : null;

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "A book file is required." }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }

  const format = detectFormat(file);
  if (!format) {
    return NextResponse.json(
      { error: "Only PDF and EPUB files are supported." },
      { status: 400 }
    );
  }

  let categoryId: string | null = null;
  try {
    if (typeof categoryName === "string" && categoryName.trim()) {
      categoryId = await resolveCategoryId(supabase, user.id, categoryName.trim());
    }

    const trimmedTitle = title.trim();
    const trimmedAuthor = typeof author === "string" && author.trim() ? author.trim() : null;

    const [{ driveFileId, sizeBytes }, metadata] = await Promise.all([
      (async () => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return uploadBookFile(user.id, {
          name: file.name,
          mimeType:
            file.type || (format === "pdf" ? "application/pdf" : "application/epub+zip"),
          buffer,
        });
      })(),
      fetchBookMetadata(trimmedTitle, trimmedAuthor),
    ]);

    const { data: book, error } = await supabase
      .from("books")
      .insert({
        user_id: user.id,
        title: trimmedTitle,
        author: trimmedAuthor ?? metadata?.author ?? null,
        category_id: categoryId,
        format,
        drive_file_id: driveFileId,
        file_size_bytes: sizeBytes,
        cover_url: metadata?.coverUrl ?? clientCover,
        description: metadata?.description ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ book }, { status: 201 });
  } catch (error) {
    console.error("Book upload failed", error);
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
