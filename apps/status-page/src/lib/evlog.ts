import { parseError } from "evlog";
import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation";

const service = "@uptimekit/status-page";

const evlogConfig = {
	service,
	env: { service },
};

export const { withEvlog, useLogger, log, createError } =
	createEvlog(evlogConfig);
export { parseError };

export const { register, onRequestError } = createInstrumentation(evlogConfig);
