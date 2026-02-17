import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { apiError } from "@/lib/http";
import { getIntegrationQueue } from "@/lib/jobs/queue";

type JobState = "waiting" | "active" | "completed" | "failed" | "delayed" | "paused" | "unknown";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const { id } = await params;
  const job = await getIntegrationQueue().getJob(id);

  if (!job) return apiError("Job not found", 404);

  const dataUserId = (job.data as { userId?: string } | undefined)?.userId;
  const isPrivileged = session.user.role === "ADMIN" || session.user.role === "MANAGER";

  if (!isPrivileged && dataUserId && dataUserId !== session.user.id) {
    return apiError("Forbidden", 403);
  }

  const state = (await job.getState()) as JobState;

  return NextResponse.json({
    id: job.id,
    name: job.name,
    state,
    progress: job.progress,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    createdAt: job.timestamp,
    finishedAt: job.finishedOn ?? null
  });
}
