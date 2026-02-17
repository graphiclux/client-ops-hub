import { Queue, Worker, type Processor } from "bullmq";
import { env } from "@/lib/env";
import { logError, logInfo } from "@/lib/telemetry";

const redisUrl = new URL(env.REDIS_URL);

export const queueConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  db: redisUrl.pathname ? Number(redisUrl.pathname.replace("/", "")) || 0 : 0
};

const defaultJobOptions = {
  attempts: 5,
  removeOnComplete: 100,
  removeOnFail: 200,
  backoff: {
    type: "exponential" as const,
    delay: 2000
  }
};

let auditQueueSingleton: Queue | null = null;
let integrationQueueSingleton: Queue | null = null;

export function getAuditQueue() {
  if (!auditQueueSingleton) {
    auditQueueSingleton = new Queue("audit", {
      connection: queueConnection,
      defaultJobOptions
    });
  }
  return auditQueueSingleton;
}

export function getIntegrationQueue() {
  if (!integrationQueueSingleton) {
    integrationQueueSingleton = new Queue("integration", {
      connection: queueConnection,
      defaultJobOptions
    });
  }
  return integrationQueueSingleton;
}

export async function enqueueAuditEvent(name: string, payload: Record<string, unknown>) {
  const job = await getAuditQueue().add(name, payload);
  logInfo("jobs.audit.enqueued", { jobId: job.id, name });
  return job;
}

export async function enqueueIntegrationJob(name: string, payload: Record<string, unknown>) {
  const job = await getIntegrationQueue().add(name, payload);
  logInfo("jobs.integration.enqueued", { jobId: job.id, name });
  return job;
}

export function createAuditWorker() {
  return new Worker(
    "audit",
    async (job) => {
      logInfo("jobs.audit.processed", { jobId: job.id, name: job.name });
    },
    {
      connection: queueConnection,
      concurrency: 5
    }
  );
}

export function createIntegrationWorker(processor: Processor) {
  return new Worker("integration", processor, {
    connection: queueConnection,
    concurrency: 5
  });
}

export function bindWorkerTelemetry(worker: Worker, channel: "audit" | "integration") {
  worker.on("completed", (job) => {
    logInfo(`jobs.${channel}.completed`, { jobId: job?.id, name: job?.name });
  });

  worker.on("failed", (job, error) => {
    logError(`jobs.${channel}.failed`, error, { jobId: job?.id, name: job?.name });
  });
}
