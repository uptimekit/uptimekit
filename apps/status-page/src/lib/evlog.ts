import { parseError } from "evlog";
import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation";

const evlogOptions = {
	env: {
		service: "@uptimekit/status-page",
	},
};

export const { withEvlog, useLogger, log, createError, createEvlogError } =
	createEvlog(evlogOptions);

export { parseError };

export const { register, onRequestError } = createInstrumentation(evlogOptions);
