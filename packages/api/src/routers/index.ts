import type { RouterClient } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../index";
import { incidentsRouter } from "./incidents";
import { integrationsRouter } from "./integrations";
import { maintenanceRouter } from "./maintenance";
import { monitorsRouter } from "./monitors";
import { statusPagesRouter } from "./status-pages";
import { statusUpdatesRouter } from "./status-updates";
import { workerIngestRouter } from "./worker-ingest";
import { workersRouter } from "./workers";
import "../pkg/integrations/service"; // Initialize integration service

export const appRouter = {
	healthCheck: publicProcedure.handler(() => {
		return "OK";
	}),
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session?.user,
		};
	}),
	workers: workersRouter,
	workerIngest: workerIngestRouter,
	monitors: monitorsRouter,
	incidents: incidentsRouter,
	statusPages: statusPagesRouter,
	statusUpdates: statusUpdatesRouter,
	maintenance: maintenanceRouter,
	integrations: integrationsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
