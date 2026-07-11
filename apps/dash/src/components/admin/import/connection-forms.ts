import type { ComponentType } from "react";
import {
    emptyKumaConnection,
    type KumaConnectionValues,
} from "./uptime-kuma-connection";
import { UptimeKumaConnectionForm } from "./uptime-kuma-connection-form";

export interface ConnectionFormProps<TValues> {
    values: TValues;
    onChange: (next: TValues) => void;
}

interface ImportSourceForm<TValues> {
    emptyValues: TValues;
    isComplete: (values: TValues) => boolean;
    toConnection: (values: TValues) => Record<string, unknown>;
    Form: ComponentType<ConnectionFormProps<TValues>>;
}

export const importSourceForms: Record<string, ImportSourceForm<any>> = {
    "uptime-kuma": {
        emptyValues: emptyKumaConnection,
        isComplete: (values: KumaConnectionValues) =>
            Boolean(values.url && values.username && values.password),
        toConnection: (values: KumaConnectionValues) => ({
            ...values,
            token: values.token || undefined,
        }),
        Form: UptimeKumaConnectionForm,
    },
};
