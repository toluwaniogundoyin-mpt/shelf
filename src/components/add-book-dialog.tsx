"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { extractClientCover } from "@/lib/extract-cover";

export function AddBookDialog({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isReadingCover, setIsReadingCover] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!title) {
      setTitle(file.name.replace(/\.(pdf|epub)$/i, ""));
    }

    setCoverPreview(null);
    const format = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "epub";
    setIsReadingCover(true);
    const cover = await extractClientCover(file, format);
    setIsReadingCover(false);
    setCoverPreview(cover);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      if (coverPreview) formData.set("clientCover", coverPreview);

      const response = await fetch("/api/books", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed.");
      }

      setOpen(false);
      setTitle("");
      setCoverPreview(null);
      formRef.current?.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus /> Add book
      </DialogTrigger>
      <DialogContent>
        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a book</DialogTitle>
            <DialogDescription>
              Uploads to your Drive&apos;s &ldquo;Shelf Library&rdquo; folder.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4">
            <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
              {isReadingCover ? (
                <span className="text-[10px] text-muted-foreground">Reading…</span>
              ) : coverPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data: URL preview
                <img src={coverPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] text-muted-foreground">No cover</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="file">File (PDF or EPUB)</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".pdf,.epub,application/pdf,application/epub+zip"
                required
                onChange={onFileChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Author</Label>
            <Input id="author" name="author" placeholder="Optional" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              list="category-options"
              placeholder="e.g. Business"
            />
            <datalist id="category-options">
              {categories.map((category) => (
                <option key={category.id} value={category.name} />
              ))}
            </datalist>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Uploading…" : "Add to shelf"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
