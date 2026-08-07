import {
    faCircleCheck,
    faCircleExclamation,
    faCircleQuestion,
    faCircleXmark,
    faTriangleExclamation,
    faWrench,
} from "@fortawesome/free-solid-svg-icons";

const theInsideColorOpacity = "/12";

export const statusConfig = {
    operational: {
        label: "Operational",
        color: "text-status-operational",
        bgColor: "bg-status-operational",
        theColor: "status-operational",
        get theInsideColor() {
            // OOP is pretty cool, kotlin is fun :)
            return this.bgColor + theInsideColorOpacity;
        },
        icon: faCircleCheck,
    },
    degraded: {
        label: "Degraded Performance",
        color: "text-status-degraded",
        bgColor: "bg-status-degraded",
        theColor: "status-degraded",
        get theInsideColor() {
            return this.bgColor + theInsideColorOpacity;
        },
        icon: faTriangleExclamation,
    },
    partial_outage: {
        label: "Partial Outage",
        color: "text-status-partial-outage",
        bgColor: "bg-status-partial-outage",
        theColor: "status-partial-outage",
        get theInsideColor() {
            return this.bgColor + theInsideColorOpacity;
        },
        icon: faCircleExclamation,
    },
    major_outage: {
        label: "Outage",
        color: "text-status-major-outage",
        bgColor: "bg-status-major-outage",
        theColor: "status-major-outage",
        get theInsideColor() {
            return this.bgColor + theInsideColorOpacity;
        },
        icon: faCircleXmark,
    },
    maintenance: {
        label: "Under Maintenance",
        color: "text-status-maintenance",
        bgColor: "bg-status-maintenance",
        theColor: "status-maintenance",
        get theInsideColor() {
            return this.bgColor + theInsideColorOpacity;
        },
        icon: faWrench,
    },
    maintenance_scheduled: {
        label: "Scheduled Maintenance",
        color: "text-status-partial-outage",
        bgColor: "bg-status-partial-outage",
        theColor: "status-partial-outage",
        get theInsideColor() {
            return this.bgColor + theInsideColorOpacity;
        },
        icon: faWrench,
    },
    maintenance_completed: {
        label: "Maintenance Completed",
        color: "text-status-operational",
        bgColor: "bg-status-operational",
        theColor: "status-operational",
        get theInsideColor() {
            return this.bgColor + theInsideColorOpacity;
        },
        icon: faCircleCheck,
    },
    unknown: {
        label: "Unknown",
        color: "text-status-unknown",
        bgColor: "bg-status-unknown",
        theColor: "status-unknown",
        get theInsideColor() {
            return this.bgColor + theInsideColorOpacity;
        },
        icon: faCircleQuestion,
    },
};
