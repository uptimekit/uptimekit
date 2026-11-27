import type { ThemeIncidentDetailProps } from "../types";
import { OpenIncident, UppiesShell } from "./components";
import "./style.css";

export default function UppiesIncidentDetail({
    data,
}: ThemeIncidentDetailProps) {
    return (
        <UppiesShell config={data.config} section="incidents">
            <OpenIncident incident={data.incident} as="h1" />
        </UppiesShell>
    );
}
