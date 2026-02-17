import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/options";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandBar } from "@/components/layout/command-bar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex min-h-screen flex-1 flex-col">
        <CommandBar />
        <section className="p-4 md:p-8">{children}</section>
      </main>
    </div>
  );
}
