import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@uptimekit/api/context";
import { createLogger } from "@uptimekit/api/lib/logger";
import { appRouter } from "@uptimekit/api/routers/index";
import { withEvlog as withOrpcEvlog } from "evlog/orpc";
import type { NextRequest } from "next/server";

const logger = createLogger("RPC");
const evlogOrpcOptions = {
	routes: {
		"/api/rpc/**": { service: "@uptimekit/api" },
	},
};

const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			logger.error("RPC error:", error);
		}),
	],
});
const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			logger.error("OpenAPI error:", error);
		}),
	],
});
type OrpcHandleOptions = Parameters<typeof rpcHandler.handle>[1];

const orpcHandler = withOrpcEvlog(
	{
		async handle(request: Request, options?: OrpcHandleOptions) {
			const rpcResult = await rpcHandler.handle(request, options);
			if (rpcResult.response) return rpcResult;

			return apiHandler.handle(
				request,
				options as Parameters<typeof apiHandler.handle>[1],
			);
		},
	},
	evlogOrpcOptions,
);

async function handleRequest(req: NextRequest) {
	const result = await orpcHandler.handle(req, {
		prefix: "/api/rpc",
		context: await createContext(req),
	});
	if (result.response) return result.response;

	return new Response("Not found", { status: 404 });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
