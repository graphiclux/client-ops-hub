import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/options";
import { buildClientAccessWhere } from "@/lib/auth/client-access";

export const dynamic = "force-dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stages = ["INTAKE", "PROPOSAL", "ACTIVE", "WAITING", "DONE"] as const;

export default async function EngagementsPage() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  const clientScope = buildClientAccessWhere(session.user);

  const engagements = await prisma.engagement.findMany({
    where: clientScope
      ? {
          client: clientScope
        }
      : undefined,
    include: { client: { select: { name: true } } },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Engagements</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stages.map((stage) => (
          <Card key={stage}>
            <CardHeader>
              <CardTitle className="text-sm">{stage}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {engagements
                .filter((item) => item.stage === stage)
                .map((engagement) => (
                  <article key={engagement.id} className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">{engagement.client.name}</p>
                    <p className="font-medium">{engagement.title}</p>
                    {engagement.trelloCardUrl && (
                      <a href={engagement.trelloCardUrl} target="_blank" className="text-xs text-primary hover:underline">
                        Trello Card
                      </a>
                    )}
                  </article>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
