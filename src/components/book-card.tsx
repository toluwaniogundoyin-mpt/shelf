import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BookCardActions } from "@/components/book-card-actions";

export function BookCard({
  book,
  progressPercent,
}: {
  book: {
    id: string;
    title: string;
    author: string | null;
    cover_url: string | null;
    format: string;
    want_to_read: boolean;
    is_favorite: boolean;
  };
  progressPercent?: number;
}) {
  return (
    <Link href={`/read/${book.id}`}>
      <Card className="overflow-hidden py-0 transition-shadow hover:shadow-md">
        <CardContent className="p-3">
          <div className="relative aspect-2/3 overflow-hidden rounded-md bg-muted">
            {book.cover_url ? (
              <Image
                src={book.cover_url}
                alt=""
                fill
                sizes="(max-width: 768px) 45vw, 200px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <span className="font-heading text-3xl text-muted-foreground">
                  {book.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <Badge variant="secondary" className="absolute top-2 right-2 uppercase">
              {book.format}
            </Badge>
            <BookCardActions
              bookId={book.id}
              initialFavorite={book.is_favorite}
              initialWantToRead={book.want_to_read}
            />
          </div>
          <p className="mt-2 truncate text-sm font-medium">{book.title}</p>
          {book.author && (
            <p className="truncate text-xs text-muted-foreground">{book.author}</p>
          )}
          {typeof progressPercent === "number" && (
            <Progress value={progressPercent} className="mt-2 h-1.5" />
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
