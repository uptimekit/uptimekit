import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@uptimekit/api/context";
import { createLogger } from "@uptimekit/api/lib/logger";
import { appRouter } from "@uptimekit/api/routers/index";
import type { NextRequest } from "next/server";

const logger = createLogger("RPC");

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

async function handleRequest(req: NextRequest) {
	const rpcResult = await rpcHandler.handle(req, {
		prefix: "/api/rpc",
		context: await createContext(req),
	});
	if (rpcResult.response) return rpcResult.response;

	const apiResult = await apiHandler.handle(req, {
		prefix: "/api/rpc/api-reference",
		context: await createContext(req),
	});
	if (apiResult.response) return apiResult.response;

	return new Response("Not found", { status: 404 });
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
