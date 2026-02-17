import { bindWorkerTelemetry, createAuditWorker, createIntegrationWorker } from "@/lib/jobs/queue";
import { processIntegrationJob } from "@/lib/jobs/integration-processor";

const auditWorker = createAuditWorker();
const integrationWorker = createIntegrationWorker(processIntegrationJob);

bindWorkerTelemetry(auditWorker, "audit");
bindWorkerTelemetry(integrationWorker, "integration");
