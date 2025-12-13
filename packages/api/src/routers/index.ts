import type { RouterClient } from "@orpc/server";
import { protectedProcedure, publicProcedure } from "../index";
import { workersRouter } from "./workers";
import { monitorsRouter } from "./monitors";
import { workerIngestRouter } from "./worker-ingest";
import { incidentsRouter } from "./incidents";

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
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
