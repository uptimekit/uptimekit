import {
    faCircleCheck,
    faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function getStatusUpdateSeverityIcon(
    severity: string,
    status: string,
    className = "h-4 w-4",
) {
    const colorClass =
        status === "resolved"
            ? "text-green-500"
            : severity === "critical"
              ? "text-red-500"
              : severity === "major"
                ? "text-orange-500"
                : severity === "minor"
                  ? "text-yellow-500"
                  : "text-green-500";

    return (
        <FontAwesomeIcon
            icon={
                status === "resolved" ||
                !["critical", "major", "minor"].includes(severity)
                    ? faCircleCheck
                    : faTriangleExclamation
            }
            className={`${className} ${colorClass}`}
        />
    );
}

export function getStatusUpdateColor(status: string) {
    switch (status) {
        case "investigating":
            return "bg-red-500 ring-red-100 dark:ring-red-900/30";
        case "identified":
            return "bg-orange-500 ring-orange-100 dark:ring-orange-900/30";
        case "monitoring":
            return "bg-blue-500 ring-blue-100 dark:ring-blue-900/30";
        case "resolved":
            return "bg-green-500 ring-green-100 dark:ring-green-900/30";
        default:
            return "bg-gray-500 ring-gray-100 dark:ring-gray-900/30";
    }
}
