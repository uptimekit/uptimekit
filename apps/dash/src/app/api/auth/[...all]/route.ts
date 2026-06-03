import { auth } from "@uptimekit/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { withEvlog } from "@/lib/evlog";

const handlers = toNextJsHandler(auth.handler);

export const GET = withEvlog(handlers.GET);
export const POST = withEvlog(handlers.POST);
