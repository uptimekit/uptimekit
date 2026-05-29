import { auth } from "@uptimekit/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { withEvlog } from "@/lib/evlog";

const handler = toNextJsHandler(auth.handler);
export const { GET, POST } = handler;
export const GET = withEvlog(GET);
export const POST = withEvlog(POST);
