import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { AddBookDialog } from "@/components/add-book-dialog";
import { BookCard } from "@/components/book-card";

const SHELVES = [
  { key: "reading", label: "Reading" },
  { key: "want_to_read", label: "Want to Read" },
  { key: "finished", label: "Finished" },
  { key: "favorites", label: "Favorites" },
] as const;

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

function pillClass(active: boolean) {
  return `rounded-full px-3 py-1 text-sm transition-colors ${
    active
      ? "bg-primary text-primary-foreground"
      : "bg-secondary text-secondary-foreground hover:bg-muted"
  }`;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; shelf?: string; q?: string }>;
}) {
  const { category: categoryFilter, shelf: shelfFilter, q: query } = await searchParams;
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  let booksQuery = supabase
    .from("books")
    .select(
      "id, title, author, cover_url, format, category_id, want_to_read, is_favorite, finished_at"
    )
    .order("added_at", { ascending: false });

  if (categoryFilter) {
    booksQuery = booksQuery.eq("category_id", categoryFilter);
  }
  if (query) {
    const safeQuery = query.replace(/[,()]/g, "");
    booksQuery = booksQuery.or(`title.ilike.%${safeQuery}%,author.ilike.%${safeQuery}%`);
  }

  if (shelfFilter === "want_to_read") {
    booksQuery = booksQuery.eq("want_to_read", true);
  } else if (shelfFilter === "favorites") {
    booksQuery = booksQuery.eq("is_favorite", true);
  } else if (shelfFilter === "finished") {
    booksQuery = booksQuery.not("finished_at", "is", null);
  } else if (shelfFilter === "reading") {
    const { data: progressRows } = await supabase.from("reading_progress").select("book_id");
    const ids = (progressRows ?? []).map((row) => row.book_id);
    booksQuery = booksQuery
      .is("finished_at", null)
      .in("id", ids.length ? ids : [EMPTY_UUID]);
  }

  const { data: books } = await booksQuery;

  const showContinueReading = !categoryFilter && !shelfFilter && !query;
  let continueReading: {
    percent: number;
    book: {
      id: string;
      title: string;
      author: string | null;
      cover_url: string | null;
      format: string;
      want_to_read: boolean;
      is_favorite: boolean;
    };
  }[] = [];

  if (showContinueReading) {
    type ProgressRow = {
      percent: number;
      updated_at: string;
      book: {
        id: string;
        title: string;
        author: string | null;
        cover_url: string | null;
        format: string;
        want_to_read: boolean;
        is_favorite: boolean;
        finished_at: string | null;
      } | null;
    };

    const { data: progressRows } = await supabase
      .from("reading_progress")
      .select(
        "percent, updated_at, book:books(id, title, author, cover_url, format, want_to_read, is_favorite, finished_at)"
      )
      .order("updated_at", { ascending: false })
      .limit(10);

    continueReading = ((progressRows ?? []) as unknown as ProgressRow[])
      .filter(
        (row): row is ProgressRow & { book: NonNullable<ProgressRow["book"]> } =>
          Boolean(row.book) && !row.book!.finished_at
      )
      .slice(0, 6);
  }

  return (
    <div className="space-y-10 px-6 py-8">
      {continueReading.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-xl">Continue reading</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {continueReading.map((row) => (
              <BookCard key={row.book.id} book={row.book} progressPercent={row.percent} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className={pillClass(!shelfFilter)}>
            All
          </Link>
          {SHELVES.map((shelf) => (
            <Link key={shelf.key} href={`/?shelf=${shelf.key}`} className={pillClass(shelfFilter === shelf.key)}>
              {shelf.label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={shelfFilter ? `/?shelf=${shelfFilter}` : "/"}
              className={pillClass(!categoryFilter)}
            >
              All categories
            </Link>
            {categories?.map((category) => (
              <Link
                key={category.id}
                href={
                  shelfFilter
                    ? `/?shelf=${shelfFilter}&category=${category.id}`
                    : `/?category=${category.id}`
                }
                className={pillClass(categoryFilter === category.id)}
              >
                {category.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <form action="/" method="get">
              {shelfFilter && <input type="hidden" name="shelf" value={shelfFilter} />}
              {categoryFilter && <input type="hidden" name="category" value={categoryFilter} />}
              <Input
                type="search"
                name="q"
                placeholder="Search title or author…"
                defaultValue={query ?? ""}
                className="w-56"
              />
            </form>
            <AddBookDialog categories={categories ?? []} />
          </div>
        </div>

        {!books?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <h2 className="font-heading text-2xl">Nothing here yet</h2>
            <p className="max-w-sm text-muted-foreground">
              {query
                ? `No books match "${query}".`
                : "Add a book or adjust your filters to see your library."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
