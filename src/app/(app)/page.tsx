import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: books } = await supabase
    .from("books")
    .select("id, title, author, cover_url, format")
    .order("added_at", { ascending: false });

  if (!books?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <h2 className="font-heading text-2xl">Your shelf is empty</h2>
        <p className="max-w-sm text-muted-foreground">
          Book uploads and the reader arrive in Phase 2. For now this screen
          confirms your account, database, and Drive connection are wired up
          end to end.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {books.map((book) => (
        <Card key={book.id} className="overflow-hidden py-0">
          <CardContent className="p-3">
            <div className="aspect-2/3 rounded-md bg-muted" />
            <p className="mt-2 truncate text-sm font-medium">{book.title}</p>
            {book.author && (
              <p className="truncate text-xs text-muted-foreground">
                {book.author}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
