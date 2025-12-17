import { EventEmitter } from "node:events";

type AppEvents = {
	"incident.created": {
		incidentId: string;
		organizationId: string;
		title: string;
		description?: string | null;
		severity: "minor" | "major" | "critical";
	};
	"incident.acknowledged": {
		incidentId: string;
		organizationId: string;
		title: string;
		description?: string | null;
		severity: "minor" | "major" | "critical";
		userId?: string | null;
	};
	"incident.resolved": {
		incidentId: string;
		organizationId: string;
		title: string;
		description?: string | null;
		severity: "minor" | "major" | "critical";
	};
	"incident.comment_added": {
		incidentId: string;
		organizationId: string;
		title: string;
		message: string;
		severity: "minor" | "major" | "critical";
		userId?: string | null;
	};
};

class TypedEventEmitter extends EventEmitter {
	emit<K extends keyof AppEvents>(event: K, payload: AppEvents[K]): boolean {
		return super.emit(event, payload);
	}

	on<K extends keyof AppEvents>(
		event: K,
		listener: (payload: AppEvents[K]) => void,
	): this {
		return super.on(event, listener);
	}

	off<K extends keyof AppEvents>(
		event: K,
		listener: (payload: AppEvents[K]) => void,
	): this {
		return super.off(event, listener);
	}
}

export const eventBus = new TypedEventEmitter();
