import type { RouterClient } from "@orpc/server";
import { configurationRouter } from "./configuration";
import { incidentsRouter } from "./incidents";
import { integrationsRouter } from "./integrations";
import { maintenanceRouter } from "./maintenance";
import { monitorsRouter } from "./monitors";
import { organizationsRouter } from "./organizations";
import { statusPagesRouter } from "./status-pages";
import { statusUpdatesRouter } from "./status-updates";
import { usersRouter } from "./users";
import { workersRouter } from "./workers";
import "../pkg/integrations/service"; // Initialize integration service

export const appRouter = {
	workers: workersRouter,
	monitors: monitorsRouter,
	incidents: incidentsRouter,
	statusPages: statusPagesRouter,
	statusUpdates: statusUpdatesRouter,
	maintenance: maintenanceRouter,
	integrations: integrationsRouter,
	configuration: configurationRouter,
	users: usersRouter,
	organizations: organizationsRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;


