import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/options";
import { buildClientAccessWhere } from "@/lib/auth/client-access";

export const dynamic = "force-dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const resolvedSearchParams = await searchParams;
  const q = resolvedSearchParams.q?.trim();
  const results = q
    ? await prisma.client.findMany({
        where: {
          OR: [{ name: { contains: q, mode: "insensitive" } }, { primaryDomain: { contains: q, mode: "insensitive" } }],
          ...(buildClientAccessWhere(session.user) || {})
        },
        take: 20
      })
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Search</h2>
      <Card>
        <CardHeader>
          <CardTitle>Global Search</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="mb-4">
            <input name="q" defaultValue={q} placeholder="Search by client name or domain" className="w-full rounded-2xl border border-border px-3 py-2" />
          </form>
          <div className="space-y-2 text-sm">
            {results.map((result) => (
              <a key={result.id} href={`/clients/${result.id}`} className="block rounded-xl border border-border p-3 hover:bg-muted">
                <p className="font-medium">{result.name}</p>
                <p className="text-muted-foreground">{result.primaryDomain}</p>
              </a>
            ))}
            {q && results.length === 0 && <p className="text-muted-foreground">No results found.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
