import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initialsFor(user: { user_metadata?: Record<string, unknown>; email?: string }) {
  const name =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh flex-col">
      <ServiceWorkerRegister />
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link href="/" className="font-heading text-xl font-medium">
          Shelf
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Library
          </Link>
          <Link
            href="/stats"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Stats
          </Link>
          <ThemeToggle />
          <Avatar className="size-8">
            <AvatarImage
              src={user.user_metadata?.avatar_url as string | undefined}
              alt=""
            />
            <AvatarFallback>{initialsFor(user)}</AvatarFallback>
          </Avatar>
          <SignOutButton />
        </nav>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
