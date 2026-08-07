"use client";

import {
    faAnglesLeft,
    faAnglesRight,
    faChevronLeft,
    faChevronRight,
    faEllipsis,
    faGlobe,
    faUpDown,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQueries, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    parseAsArrayOf,
    parseAsInteger,
    parseAsString,
    parseAsStringEnum,
    useQueryStates,
} from "nuqs";
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { RechartsBoundary } from "@/components/monitors/recharts-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRegionInfo, isFontAwesomeRegionFlag } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

interface ResponseTimeChartProps {
    monitorId: string;
    workerIds: string[];
    monitorType?: string;
    isHttps?: boolean;
    workers?: Array<{
        id: string;
        name: string;
        location: string;
    }>;
}

const HTTP_MONITOR_TYPES = ["http", "http-json", "keyword"];
const TIMING_KEYS = [
    "dnsLookup",
    "tcpConnect",
    "tlsHandshake",
    "ttfb",
    "transfer",
] as const;
const QUANTILE_VALUES = ["p50", "p90", "p99"] as const;
const RANGE_VALUES = [
    "3h",
    "24h",
    "7d",
    "30d",
    "3mo",
    "6mo",
    "1y",
    "all",
] as const;
const LATENCY_RESOLUTION_VALUES = ["1", "5", "15", "30", "60", "all"] as const;
const LATENCY_VIEW_VALUES = ["percentiles", "average"] as const;
const REGION_VIEW_VALUES = ["table", "chart"] as const;
const ROWS_PER_PAGE_VALUES = ["10", "20", "50"] as const;
type TimingKey = (typeof TIMING_KEYS)[number];
type QuantileKey = (typeof QUANTILE_VALUES)[number];
type RangeKey = (typeof RANGE_VALUES)[number];
type LatencyResolutionKey = (typeof LATENCY_RESOLUTION_VALUES)[number];
type LatencyView = (typeof LATENCY_VIEW_VALUES)[number];
type RegionView = (typeof REGION_VIEW_VALUES)[number];
type RowsPerPageKey = (typeof ROWS_PER_PAGE_VALUES)[number];
type ChartStateUpdate = Partial<{
    latencyRange: RangeKey;
    latencyQuantile: QuantileKey;
    latencyResolutionMinutes: LatencyResolutionKey;
    latencyView: LatencyView;
    regionView: RegionView;
    rowsPerPage: RowsPerPageKey;
    page: number;
    sortBy: QuantileKey;
    selectedWorkerIds: string[];
}>;

function DashboardHeaderActions({ children }: { children: ReactNode }) {
    const container = useSyncExternalStore(
        () => () => undefined,
        () => document.getElementById("dashboard-header-actions"),
        () => null,
    );

    return container ? createPortal(children, container) : null;
}

const TIMING_COLORS: Record<TimingKey, string> = {
    dnsLookup: "#2563eb",
    tcpConnect: "#10b981",
    tlsHandshake: "#f59e0b",
    ttfb: "#a855f7",
    transfer: "#ff2f92",
};

const TIMING_LABELS: Record<TimingKey, string> = {
    dnsLookup: "DNS",
    tcpConnect: "Connect",
    tlsHandshake: "TLS",
    ttfb: "TTFB",
    transfer: "Transfer",
};

const QUANTILE_COLORS: Record<QuantileKey, string> = {
    p50: "#5b8fe6",
    p90: "#d98a43",
    p99: "#e76855",
};

const REGION_HUES = [8, 215, 28, 180, 270, 145, 330, 42] as const;

const REGION_QUANTILE_LIGHTNESS: Record<QuantileKey, number> = {
    p50: 70,
    p90: 58,
    p99: 46,
};

const QUANTILE_DASHES: Record<QuantileKey, string | undefined> = {
    p50: "6 4",
    p90: "3 3",
    p99: undefined,
};

const QUANTILE_OPTIONS = [
    { label: "P50", value: "p50" },
    { label: "P90", value: "p90" },
    { label: "P99", value: "p99" },
] as const;

const RANGE_OPTIONS = [
    { label: "Last 3 hours", value: "3h" },
    { label: "Last day", value: "24h" },
    { label: "Last week", value: "7d" },
    { label: "Last month", value: "30d" },
    { label: "Last 3 months", value: "3mo" },
    { label: "Last 6 months", value: "6mo" },
    { label: "Last year", value: "1y" },
    { label: "All time", value: "all" },
] as const;

const RESOLUTION_OPTIONS = [
    { label: "1 minute", value: "1" },
    { label: "5 minutes", value: "5" },
    { label: "15 minutes", value: "15" },
    { label: "30 minutes", value: "30" },
    { label: "1 hour", value: "60" },
    { label: "All checks", value: "all" },
] as const;

const ROWS_PER_PAGE_OPTIONS = [
    { label: "10", value: "10" },
    { label: "20", value: "20" },
    { label: "50", value: "50" },
] as const;

const generateRegionQuantileColor = (index: number, quantile: QuantileKey) => {
    const hue =
        REGION_HUES[index % REGION_HUES.length] ?? (index * 137.5) % 360;
    return `hsl(${hue}, 76%, ${REGION_QUANTILE_LIGHTNESS[quantile]}%)`;
};

const normalizeWorkerSelectionForUrl = (
    selectedWorkerIds: string[],
    workerIds: string[],
) => {
    const selectedWorkerIdSet = new Set(selectedWorkerIds);
    const normalizedWorkerIds = workerIds.filter((workerId) =>
        selectedWorkerIdSet.has(workerId),
    );

    return normalizedWorkerIds.length === workerIds.length
        ? []
        : normalizedWorkerIds;
};

const resolveSelectedWorkerIds = (
    selectedWorkerIds: string[],
    workerIds: string[],
) => {
    if (workerIds.length === 0) {
        return [];
    }

    const normalizedWorkerIds = normalizeWorkerSelectionForUrl(
        selectedWorkerIds,
        workerIds,
    );

    return normalizedWorkerIds.length > 0 ? normalizedWorkerIds : workerIds;
};

interface RawDataPoint {
    timestamp: string;
    location: string;
    status?: string;
    latency: number;
    dnsLookup?: number;
    tcpConnect?: number;
    tlsHandshake?: number;
    ttfb?: number;
    transfer?: number;
}

interface LatencyBucketPoint {
    timestamp: string;
    timestampMs: number;
    label: string;
    latency: number | null;
    dnsLookup: number | null;
    tcpConnect: number | null;
    tlsHandshake: number | null;
    ttfb: number | null;
    transfer: number | null;
    [key: string]: string | number | null;
}

interface RegionTrendPoint {
    label: string;
    value: number;
    p50: number | null;
    p90: number | null;
    p99: number | null;
}

interface ChartGapBand {
    startMs: number;
    endMs: number;
    severity: "down" | "degraded";
}

interface RegionChartPoint {
    timestamp: string;
    timestampMs: number;
    label: string;
    [workerId: string]: string | number | null;
}

interface RegionMetricRow {
    workerId: string;
    trend: RegionTrendPoint[];
    current: number | null;
    min: number | null;
    max: number | null;
    p50: number | null;
    p90: number | null;
    p99: number | null;
}

const ONE_MINUTE_MS = 60_000;
const STATUS_BAND_COLORS = {
    down: "#ef4444",
    degraded: "#f59e0b",
} as const;
const LATENCY_RESOLUTION_ORDER = ["1", "5", "15", "30", "60"] as const;
const LATENCY_METRIC_KEYS = [
    "latency",
    "dnsLookup",
    "tcpConnect",
    "tlsHandshake",
    "ttfb",
    "transfer",
] as const;
const LATENCY_CHART_VALUE_KEYS = [
    ...LATENCY_METRIC_KEYS,
    ...QUANTILE_VALUES.flatMap((quantile) =>
        LATENCY_METRIC_KEYS.map((metric) => `${quantile}_${metric}`),
    ),
] as const;
const MIN_LATENCY_RESOLUTION_BY_RANGE: Record<
    RangeKey,
    (typeof LATENCY_RESOLUTION_ORDER)[number]
> = {
    "3h": "1",
    "24h": "1",
    "7d": "5",
    "30d": "30",
    "3mo": "60",
    "6mo": "60",
    "1y": "60",
    all: "60",
};

const getLatencySeriesKey = (
    quantile: QuantileKey,
    metric: (typeof LATENCY_METRIC_KEYS)[number],
) => `${quantile}_${metric}`;

const getRegionSeriesKey = (workerId: string, quantile: QuantileKey) =>
    `${workerId}_${quantile}`;

const quantileToRatio = (quantile: QuantileKey) => {
    switch (quantile) {
        case "p90":
            return 0.9;
        case "p99":
            return 0.99;
        default:
            return 0.5;
    }
};

const getBucketStart = (timestamp: string, resolutionMinutes: number) => {
    const time = new Date(timestamp).getTime();
    const bucketSize = resolutionMinutes * ONE_MINUTE_MS;
    return new Date(Math.floor(time / bucketSize) * bucketSize).toISOString();
};

const compareLatencyResolution = (
    left: (typeof LATENCY_RESOLUTION_ORDER)[number],
    right: (typeof LATENCY_RESOLUTION_ORDER)[number],
) =>
    LATENCY_RESOLUTION_ORDER.indexOf(left) -
    LATENCY_RESOLUTION_ORDER.indexOf(right);

const normalizeLatencyResolution = (
    range: RangeKey,
    resolution: LatencyResolutionKey,
): LatencyResolutionKey => {
    if (resolution === "all") {
        return resolution;
    }

    const minimumResolution = MIN_LATENCY_RESOLUTION_BY_RANGE[range];
    return compareLatencyResolution(resolution, minimumResolution) < 0
        ? minimumResolution
        : resolution;
};

const getLatencyBucketSeconds = (resolution: LatencyResolutionKey) =>
    resolution === "all" ? undefined : Number(resolution) * 60;

const getRegionBucketSeconds = (range: RangeKey) => {
    switch (range) {
        case "3h":
            return 5 * 60;
        case "24h":
            return 15 * 60;
        case "7d":
            return 60 * 60;
        case "30d":
            return 6 * 60 * 60;
        case "3mo":
            return 12 * 60 * 60;
        default:
            return 24 * 60 * 60;
    }
};

const getRegionBucketMinutes = (range: RangeKey) =>
    getRegionBucketSeconds(range) / 60;

const formatChartTimestamp = (timestamp: string, range: RangeKey) => {
    const date = new Date(timestamp);
    if (range === "3h" || range === "24h" || range === "7d") {
        return format(date, "MMM d 'at' h:mm a");
    }
    if (range === "1y" || range === "all") {
        return format(date, "MMM d, yyyy");
    }
    return format(date, "MMM d");
};

const formatDetailedTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, "MMM d, yyyy 'at' h:mm:ss a");
};

const formatAxisTimestamp = (timestampMs: number, range: RangeKey) => {
    const date = new Date(timestampMs);
    if (range === "3h" || range === "24h") {
        return format(date, "h:mm:ss a");
    }
    if (range === "7d" || range === "30d" || range === "3mo") {
        return format(date, "MMM d, h:mm:ss a");
    }
    return format(date, "MMM d, yyyy h:mm:ss a");
};

const getMedianIntervalMs = (points: Array<{ timestampMs: number }>) => {
    const diffs = points
        .flatMap((point, index) => {
            const diff =
                index === 0
                    ? 0
                    : point.timestampMs - points[index - 1].timestampMs;
            return diff > 0 ? [diff] : [];
        })
        .sort((left, right) => left - right);

    if (diffs.length === 0) {
        return null;
    }

    return diffs[Math.floor(diffs.length / 2)];
};

const getGapThresholdMs = (
    points: Array<{ timestampMs: number }>,
    fallbackIntervalMs: number,
) => {
    const medianIntervalMs = getMedianIntervalMs(points);
    if (medianIntervalMs == null) {
        return fallbackIntervalMs * 2.5;
    }

    const inferredIntervalMs = Math.min(
        Math.max(medianIntervalMs, fallbackIntervalMs),
        fallbackIntervalMs * 6,
    );
    return inferredIntervalMs * 2.5;
};

const getGapBands = (
    points: Array<{ timestampMs: number }>,
    thresholdMs: number,
): ChartGapBand[] =>
    points.slice(1).flatMap((point, index) => {
        const previous = points[index];
        return point.timestampMs - previous.timestampMs > thresholdMs
            ? [
                  {
                      startMs: previous.timestampMs,
                      endMs: point.timestampMs,
                      severity: "down",
                  },
              ]
            : [];
    });

const getStatusSeverity = (status: string) => {
    switch (status) {
        case "down":
            return 2;
        case "degraded":
            return 1;
        default:
            return 0;
    }
};

const setWorstLocationStatus = (
    statusesByLocation: Map<string, string>,
    location: string,
    status: string,
) => {
    const currentStatus = statusesByLocation.get(location);
    if (
        !currentStatus ||
        getStatusSeverity(status) > getStatusSeverity(currentStatus)
    ) {
        statusesByLocation.set(location, status);
    }
};

const createNullChartPoint = <
    T extends { timestamp: string; timestampMs: number; label: string },
>(
    point: T,
    timestampMs: number,
    valueKeys: readonly string[],
) => {
    const nextPoint = {
        ...point,
        timestamp: new Date(timestampMs).toISOString(),
        timestampMs,
        label: "No data",
    } as T;

    for (const key of valueKeys) {
        (nextPoint as Record<string, unknown>)[key] = null;
    }

    return nextPoint;
};

const insertGapBreaks = <
    T extends { timestamp: string; timestampMs: number; label: string },
>(
    points: T[],
    thresholdMs: number,
    valueKeys: readonly string[],
) => {
    if (points.length < 2) {
        return points;
    }

    return points.slice(1).reduce(
        (acc, point) => {
            const previous = acc.at(-1);
            if (
                previous &&
                point.timestampMs - previous.timestampMs > thresholdMs
            ) {
                acc.push(
                    createNullChartPoint(
                        previous,
                        previous.timestampMs + 1,
                        valueKeys,
                    ),
                    createNullChartPoint(
                        point,
                        point.timestampMs - 1,
                        valueKeys,
                    ),
                );
            }
            acc.push(point);
            return acc;
        },
        [points[0]] as T[],
    );
};

const getStatusBands = (
    points: RawDataPoint[],
    bucketMs: number,
    selectedWorkerIds: string[],
): ChartGapBand[] => {
    const buckets = points.reduce((acc, point) => {
        if (!point.status || point.status === "up") {
            return acc;
        }

        const timestampMs = new Date(point.timestamp).getTime();
        const bucketStartMs = Math.floor(timestampMs / bucketMs) * bucketMs;
        const bucket = acc.get(bucketStartMs) ?? {
            aggregateStatuses: [] as string[],
            statusesByLocation: new Map<string, string>(),
        };
        if (point.location) {
            setWorstLocationStatus(
                bucket.statusesByLocation,
                point.location,
                point.status,
            );
        } else {
            bucket.aggregateStatuses.push(point.status);
        }
        acc.set(bucketStartMs, bucket);
        return acc;
    }, new Map<
        number,
        { aggregateStatuses: string[]; statusesByLocation: Map<string, string> }
    >());

    return Array.from(buckets.entries())
        .sort(([left], [right]) => left - right)
        .map(([startMs, bucket]) => {
            const aggregateDown = bucket.aggregateStatuses.includes("down");
            const downWorkerCount = Array.from(
                bucket.statusesByLocation.values(),
            ).filter((status) => status === "down").length;
            const allSelectedWorkersDown =
                selectedWorkerIds.length > 0 &&
                downWorkerCount >= selectedWorkerIds.length;

            return {
                startMs,
                endMs: startMs + bucketMs,
                severity:
                    aggregateDown || allSelectedWorkersDown
                        ? "down"
                        : "degraded",
            };
        });
};

const mergeBands = (bands: ChartGapBand[]) =>
    bands
        .sort(
            (left, right) =>
                left.startMs - right.startMs ||
                (left.severity === "down" ? -1 : 1),
        )
        .reduce((acc, band) => {
            const previous = acc.at(-1);
            if (!previous || band.startMs > previous.endMs) {
                acc.push({ ...band });
                return acc;
            }

            previous.endMs = Math.max(previous.endMs, band.endMs);
            if (band.severity === "down") {
                previous.severity = "down";
            }
            return acc;
        }, [] as ChartGapBand[]);

const calculateQuantile = (
    values: Array<number | undefined>,
    quantile: QuantileKey,
) => {
    const definedValues = values
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b);

    if (definedValues.length === 0) {
        return 0;
    }

    if (definedValues.length === 1) {
        return definedValues[0];
    }

    const index = (definedValues.length - 1) * quantileToRatio(quantile);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);

    if (lowerIndex === upperIndex) {
        return definedValues[lowerIndex];
    }

    const weight = index - lowerIndex;
    return (
        definedValues[lowerIndex] +
        (definedValues[upperIndex] - definedValues[lowerIndex]) * weight
    );
};

const calculateQuantileOrNull = (
    values: Array<number | undefined>,
    quantile: QuantileKey,
) => (values.length > 0 ? calculateQuantile(values, quantile) : null);

const getLatencyMetricValue = (
    points: RawDataPoint[],
    metric: (typeof LATENCY_METRIC_KEYS)[number],
    quantile: QuantileKey,
) =>
    calculateQuantileOrNull(
        points.map((point) => point[metric]),
        quantile,
    );

const getAverageLatencyMetricValue = (
    points: RawDataPoint[],
    metric: (typeof LATENCY_METRIC_KEYS)[number],
) => {
    const values = points.flatMap((point) => {
        const value = point[metric];
        return typeof value === "number" ? [value] : [];
    });

    if (values.length === 0) return null;

    return values.reduce((total, value) => total + value, 0) / values.length;
};

const createLatencyChartPoint = ({
    timestamp,
    label,
    pointsByQuantile,
    averagePoints,
    selectedQuantile,
}: {
    timestamp: string;
    label: string;
    pointsByQuantile: Record<QuantileKey, RawDataPoint[]>;
    averagePoints: RawDataPoint[];
    selectedQuantile: QuantileKey;
}): LatencyBucketPoint => {
    const point: LatencyBucketPoint = {
        timestamp,
        timestampMs: new Date(timestamp).getTime(),
        label,
        latency: null,
        dnsLookup: null,
        tcpConnect: null,
        tlsHandshake: null,
        ttfb: null,
        transfer: null,
    };

    for (const quantile of QUANTILE_VALUES) {
        for (const metric of LATENCY_METRIC_KEYS) {
            point[getLatencySeriesKey(quantile, metric)] =
                getLatencyMetricValue(
                    pointsByQuantile[quantile],
                    metric,
                    quantile,
                );
        }
    }

    for (const metric of LATENCY_METRIC_KEYS) {
        point[metric] =
            getAverageLatencyMetricValue(averagePoints, metric) ??
            (point[getLatencySeriesKey(selectedQuantile, metric)] as
                | number
                | null) ??
            null;
    }

    return point;
};

const formatMetric = (value: number | null) =>
    value == null ? "--" : `${Math.round(value)} ms`;

function RegionTrendSparkline({
    data,
}: {
    data: RegionTrendPoint[];
}): React.ReactElement | null {
    if (data.length === 0) {
        return null;
    }

    return (
        <div className="h-12 w-full min-w-[170px]">
            <RechartsBoundary>
                {({ ResponsiveContainer, LineChart, Line }) => (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            accessibilityLayer={false}
                            data={data}
                            margin={{ top: 3, right: 0, bottom: 3, left: 0 }}
                        >
                            {QUANTILE_VALUES.map((quantile) => (
                                <Line
                                    key={quantile}
                                    type="monotone"
                                    dataKey={quantile}
                                    stroke={QUANTILE_COLORS[quantile]}
                                    strokeWidth={1.6}
                                    strokeDasharray={QUANTILE_DASHES[quantile]}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </RechartsBoundary>
        </div>
    );
}

function ResponseTimeTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;

    const label = payload[0]?.payload?.label;
    return (
        <div className="rounded-xl border border-border bg-background/96 px-3 py-2 text-xs shadow-xl backdrop-blur">
            <div className="mb-2 font-medium text-foreground">{label}</div>
            <div className="space-y-1.5">
                {payload
                    .filter((entry: any) => entry.value != null)
                    .map((entry: any) => (
                        <div
                            key={entry.dataKey}
                            className="flex items-center gap-2"
                        >
                            <span
                                className="h-2.5 w-2.5 rounded-[2px]"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-muted-foreground">
                                {entry.name}
                            </span>
                            <span className="ml-auto font-medium text-foreground">
                                {Math.round(entry.value)} ms
                            </span>
                        </div>
                    ))}
            </div>
        </div>
    );
}

function useResponseTimeChartModel({
    monitorId,
    workerIds,
    monitorType = "http",
    isHttps = false,
    workers = [],
}: ResponseTimeChartProps) {
    const [chartState, setChartState] = useQueryStates(
        {
            latencyRange: parseAsStringEnum([...RANGE_VALUES]).withDefault(
                "3h",
            ),
            latencyQuantile: parseAsStringEnum([
                ...QUANTILE_VALUES,
            ]).withDefault("p99"),
            latencyResolutionMinutes: parseAsStringEnum([
                ...LATENCY_RESOLUTION_VALUES,
            ]).withDefault("1"),
            latencyView: parseAsStringEnum([
                ...LATENCY_VIEW_VALUES,
            ]).withDefault("percentiles"),
            regionView: parseAsStringEnum([...REGION_VIEW_VALUES]).withDefault(
                "chart",
            ),
            rowsPerPage: parseAsStringEnum([
                ...ROWS_PER_PAGE_VALUES,
            ]).withDefault("20"),
            page: parseAsInteger.withDefault(1),
            sortBy: parseAsStringEnum([...QUANTILE_VALUES]).withDefault("p50"),
            selectedWorkerIds: parseAsArrayOf(parseAsString).withDefault([]),
        },
        {
            urlKeys: {
                latencyResolutionMinutes: "latencyResolution",
                rowsPerPage: "regionRows",
                page: "regionPage",
                sortBy: "regionSort",
                selectedWorkerIds: "workers",
            },
        },
    );
    const {
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        latencyView,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
    } = chartState;
    const regionRange = latencyRange;
    const regionQuantile = latencyQuantile;
    const page = Math.max(chartState.page, 1);
    const updateChartState = (nextState: ChartStateUpdate) => {
        void setChartState(nextState);
    };

    const hasDetailedTimings = HTTP_MONITOR_TYPES.includes(monitorType);
    const showLatencyTabs = isHttps && hasDetailedTimings;
    const activeWorkerIds = resolveSelectedWorkerIds(
        selectedWorkerIds,
        workerIds,
    );
    const effectiveLatencyResolutionMinutes = normalizeLatencyResolution(
        latencyRange,
        latencyResolutionMinutes,
    );
    const isAllChecksResolution = effectiveLatencyResolutionMinutes === "all";
    const latencyBucketSeconds = getLatencyBucketSeconds(
        effectiveLatencyResolutionMinutes,
    );

    useEffect(() => {
        if (effectiveLatencyResolutionMinutes === latencyResolutionMinutes) {
            return;
        }

        void setChartState({
            latencyResolutionMinutes: effectiveLatencyResolutionMinutes,
        });
    }, [
        effectiveLatencyResolutionMinutes,
        latencyResolutionMinutes,
        setChartState,
    ]);

    const latencyQueries = useQueries({
        queries: QUANTILE_VALUES.map((quantile) => ({
            ...orpc.monitors.getResponseTimes.queryOptions({
                input: {
                    monitorId,
                    range: latencyRange,
                    workerIds: activeWorkerIds,
                    allChecks: isAllChecksResolution,
                    bucketSeconds: latencyBucketSeconds,
                    bucketQuantile: quantile,
                    groupByLocation: !isAllChecksResolution,
                },
            }),
            enabled: activeWorkerIds.length > 0,
        })),
    });
    const latencyRawDataByQuantile = Object.fromEntries(
        QUANTILE_VALUES.map((quantile, index) => [
            quantile,
            latencyQueries[index]?.data ?? [],
        ]),
    ) as Record<QuantileKey, RawDataPoint[]>;
    const latencyRawData = latencyRawDataByQuantile[latencyQuantile] ?? [];
    const isLatencyLoading = latencyQueries.some((query) => query.isLoading);
    const {
        data: averageLatencyRawData = [],
        isLoading: isAverageLatencyLoading,
    } = useQuery({
        ...orpc.monitors.getResponseTimes.queryOptions({
            input: {
                monitorId,
                range: latencyRange,
                workerIds: activeWorkerIds,
                allChecks: isAllChecksResolution,
                bucketSeconds: latencyBucketSeconds,
                bucketAggregation: "average",
                groupByLocation: false,
            },
        }),
        enabled: showLatencyTabs && activeWorkerIds.length > 0,
    });

    const regionQueries = useQueries({
        queries: QUANTILE_VALUES.map((quantile) => ({
            ...orpc.monitors.getResponseTimes.queryOptions({
                input: {
                    monitorId,
                    range: regionRange,
                    workerIds: activeWorkerIds,
                    bucketSeconds: getRegionBucketSeconds(regionRange),
                    bucketQuantile: quantile,
                    groupByLocation: true,
                },
            }),
            enabled: activeWorkerIds.length > 0,
        })),
    });
    const regionRawDataByQuantile = Object.fromEntries(
        QUANTILE_VALUES.map((quantile, index) => [
            quantile,
            regionQueries[index]?.data ?? [],
        ]),
    ) as Record<QuantileKey, RawDataPoint[]>;
    const regionRawData = regionRawDataByQuantile[regionQuantile] ?? [];
    const isRegionLoading = regionQueries.some((query) => query.isLoading);

    const workersById = new Map(workers.map((worker) => [worker.id, worker]));
    const locationTitle = workers.length > 0 ? "Workers" : "Regions";

    const getLocationDisplay = (workerId: string) => {
        const worker = workersById.get(workerId);
        const regionInfo = getRegionInfo(worker?.location ?? workerId);
        return {
            regionInfo,
            primaryLabel: worker?.name ?? workerId,
            secondaryLabel: worker ? regionInfo.label : null,
        };
    };

    const baseLatencyChartData: LatencyBucketPoint[] = (() => {
        const getChartTimestamp = (timestamp: string) =>
            isAllChecksResolution
                ? timestamp
                : getBucketStart(
                      timestamp,
                      Number(effectiveLatencyResolutionMinutes),
                  );
        const groupByTimestamp = (points: RawDataPoint[]) =>
            points.reduce(
                (acc, point) => {
                    const timestamp = getChartTimestamp(point.timestamp);
                    if (!acc[timestamp]) {
                        acc[timestamp] = [];
                    }
                    acc[timestamp].push(point);
                    return acc;
                },
                {} as Record<string, RawDataPoint[]>,
            );
        const groupedByQuantile = Object.fromEntries(
            QUANTILE_VALUES.map((quantile) => [
                quantile,
                groupByTimestamp(latencyRawDataByQuantile[quantile]),
            ]),
        ) as Record<QuantileKey, Record<string, RawDataPoint[]>>;
        const averageByTimestamp = groupByTimestamp(averageLatencyRawData);
        const timestamps = new Set([
            ...QUANTILE_VALUES.flatMap((quantile) =>
                Object.keys(groupedByQuantile[quantile]),
            ),
            ...Object.keys(averageByTimestamp),
        ]);

        if (timestamps.size === 0) {
            return [];
        }

        return Array.from(timestamps)
            .sort()
            .map((timestamp) =>
                createLatencyChartPoint({
                    timestamp,
                    label: formatDetailedTimestamp(timestamp),
                    pointsByQuantile: Object.fromEntries(
                        QUANTILE_VALUES.map((quantile) => [
                            quantile,
                            groupedByQuantile[quantile][timestamp] ?? [],
                        ]),
                    ) as Record<QuantileKey, RawDataPoint[]>,
                    averagePoints: averageByTimestamp[timestamp] ?? [],
                    selectedQuantile: latencyQuantile,
                }),
            );
    })();
    const latencyGapThresholdMs = getGapThresholdMs(
        baseLatencyChartData,
        (latencyBucketSeconds ?? 60) * 1000,
    );
    const latencyStatusBucketMs =
        latencyBucketSeconds != null
            ? latencyBucketSeconds * 1000
            : Math.max(
                  getMedianIntervalMs(baseLatencyChartData) ?? 60_000,
                  60_000,
              );
    const latencyBands = mergeBands([
        ...getGapBands(baseLatencyChartData, latencyGapThresholdMs),
        ...getStatusBands(
            latencyRawData,
            latencyStatusBucketMs,
            activeWorkerIds,
        ),
    ]);
    const chartData = insertGapBreaks(
        baseLatencyChartData,
        latencyGapThresholdMs,
        LATENCY_CHART_VALUE_KEYS,
    );

    const regionMetrics: RegionMetricRow[] = (() => {
        if (regionRawData.length === 0) {
            return [];
        }

        return activeWorkerIds
            .map((workerId) => {
                const regionPointsByQuantile = Object.fromEntries(
                    QUANTILE_VALUES.map((quantile) => [
                        quantile,
                        regionRawDataByQuantile[quantile].filter(
                            (point) => point.location === workerId,
                        ),
                    ]),
                ) as Record<QuantileKey, RawDataPoint[]>;
                const groupedTrendByQuantile = Object.fromEntries(
                    QUANTILE_VALUES.map((quantile) => [
                        quantile,
                        regionPointsByQuantile[quantile].reduce(
                            (acc, point) => {
                                const bucketStart = getBucketStart(
                                    point.timestamp,
                                    getRegionBucketMinutes(regionRange),
                                );
                                if (!acc[bucketStart]) {
                                    acc[bucketStart] = [];
                                }
                                acc[bucketStart].push(point.latency);
                                return acc;
                            },
                            {} as Record<string, number[]>,
                        ),
                    ]),
                );
                const trendTimestamps = new Set(
                    QUANTILE_VALUES.flatMap((quantile) =>
                        Object.keys(groupedTrendByQuantile[quantile]),
                    ),
                );

                const trend = Array.from(trendTimestamps)
                    .sort()
                    .map((timestamp) => {
                        const values = Object.fromEntries(
                            QUANTILE_VALUES.map((quantile) => [
                                quantile,
                                calculateQuantileOrNull(
                                    groupedTrendByQuantile[quantile][
                                        timestamp
                                    ] ?? [],
                                    quantile,
                                ),
                            ]),
                        ) as Record<QuantileKey, number | null>;
                        return {
                            label: formatChartTimestamp(timestamp, regionRange),
                            value: values[regionQuantile] ?? 0,
                            p50: values.p50,
                            p90: values.p90,
                            p99: values.p99,
                        };
                    });

                const latencyValuesByQuantile = Object.fromEntries(
                    QUANTILE_VALUES.map((quantile) => [
                        quantile,
                        regionPointsByQuantile[quantile].map(
                            (point) => point.latency,
                        ),
                    ]),
                ) as Record<QuantileKey, number[]>;
                return {
                    workerId,
                    trend,
                    current: trend.at(-1)?.value ?? null,
                    min:
                        trend.length > 0
                            ? Math.min(...trend.map((point) => point.value))
                            : null,
                    max:
                        trend.length > 0
                            ? Math.max(...trend.map((point) => point.value))
                            : null,
                    p50: calculateQuantileOrNull(
                        latencyValuesByQuantile.p50,
                        "p50",
                    ),
                    p90: calculateQuantileOrNull(
                        latencyValuesByQuantile.p90,
                        "p90",
                    ),
                    p99: calculateQuantileOrNull(
                        latencyValuesByQuantile.p99,
                        "p99",
                    ),
                };
            })
            .sort((left, right) => (right[sortBy] ?? 0) - (left[sortBy] ?? 0));
    })();

    const regionColors = (() => {
        const colors: Record<string, Record<QuantileKey, string>> = {};
        activeWorkerIds.forEach((workerId, index) => {
            colors[workerId] = Object.fromEntries(
                QUANTILE_VALUES.map((quantile) => [
                    quantile,
                    generateRegionQuantileColor(index, quantile),
                ]),
            ) as Record<QuantileKey, string>;
        });
        return colors;
    })();

    const baseRegionChartData: RegionChartPoint[] = (() => {
        if (regionRawData.length === 0 || activeWorkerIds.length === 0) {
            return [];
        }

        const groupedByQuantile = Object.fromEntries(
            QUANTILE_VALUES.map((quantile) => [
                quantile,
                regionRawDataByQuantile[quantile].reduce(
                    (acc, point) => {
                        const bucketStart = getBucketStart(
                            point.timestamp,
                            getRegionBucketMinutes(regionRange),
                        );
                        if (!acc[bucketStart]) {
                            acc[bucketStart] = [];
                        }
                        acc[bucketStart].push(point);
                        return acc;
                    },
                    {} as Record<string, RawDataPoint[]>,
                ),
            ]),
        );
        const timestamps = new Set(
            QUANTILE_VALUES.flatMap((quantile) =>
                Object.keys(groupedByQuantile[quantile]),
            ),
        );

        return Array.from(timestamps)
            .sort()
            .map((timestamp) => {
                const byLocation = activeWorkerIds.reduce(
                    (acc, workerId) => {
                        for (const quantile of QUANTILE_VALUES) {
                            const locationLatencies = (
                                groupedByQuantile[quantile][timestamp] ?? []
                            ).reduce((latencies, point) => {
                                if (point.location === workerId) {
                                    latencies.push(point.latency);
                                }
                                return latencies;
                            }, [] as number[]);
                            acc[getRegionSeriesKey(workerId, quantile)] =
                                calculateQuantileOrNull(
                                    locationLatencies,
                                    quantile,
                                );
                        }
                        return acc;
                    },
                    {} as Record<string, number | null>,
                );

                return {
                    timestamp,
                    timestampMs: new Date(timestamp).getTime(),
                    label: formatDetailedTimestamp(timestamp),
                    ...byLocation,
                };
            });
    })();
    const regionGapThresholdMs = getGapThresholdMs(
        baseRegionChartData,
        getRegionBucketSeconds(regionRange) * 1000,
    );
    const regionBands = mergeBands([
        ...getGapBands(baseRegionChartData, regionGapThresholdMs),
        ...getStatusBands(
            regionRawData,
            getRegionBucketSeconds(regionRange) * 1000,
            activeWorkerIds,
        ),
    ]);
    const regionChartData = insertGapBreaks(
        baseRegionChartData,
        regionGapThresholdMs,
        activeWorkerIds.flatMap((workerId) =>
            QUANTILE_VALUES.map((quantile) =>
                getRegionSeriesKey(workerId, quantile),
            ),
        ),
    );

    const totalPages = Math.max(
        1,
        Math.ceil(regionMetrics.length / Number(rowsPerPage)),
    );
    const paginatedRegionMetrics = regionMetrics.slice(
        (page - 1) * Number(rowsPerPage),
        page * Number(rowsPerPage),
    );
    const regionPageResetKey = `${rowsPerPage}:${regionMetrics.length}:${sortBy}:${regionRange}:${regionQuantile}`;
    const previousRegionPageResetKey = useRef(regionPageResetKey);

    useEffect(() => {
        if (previousRegionPageResetKey.current === regionPageResetKey) {
            return;
        }

        previousRegionPageResetKey.current = regionPageResetKey;
        if (page !== 1) {
            void setChartState({ page: 1 });
        }
    }, [page, regionPageResetKey, setChartState]);

    const summaryText =
        activeWorkerIds.length === workerIds.length
            ? `All ${workers.length > 0 ? "workers" : "regions"}`
            : `${activeWorkerIds.length} selected`;
    const activeWorkerIdSet = new Set(activeWorkerIds);

    return {
        monitorId,
        workerIds,
        monitorType,
        isHttps,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        latencyView,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        showLatencyTabs,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        averageLatencyRawData,
        isAverageLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    };
}

type ResponseTimeChartModel = ReturnType<typeof useResponseTimeChartModel>;

function ResponseTimeChartCardSection3({
    model,
}: {
    model: ResponseTimeChartModel;
}) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
                <CardTitle className="font-semibold text-xl tracking-tight">
                    Latency
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                    Response time across all configured{" "}
                    {workers.length > 0 ? "workers" : "regions"}
                </p>
            </div>
            {workerIds.length > 0 && (
                <Popover>
                    <PopoverTrigger
                        render={
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2 border-border/70 bg-background/60"
                            >
                                <FontAwesomeIcon
                                    icon={faGlobe}
                                    className="h-4 w-4"
                                />
                                {summaryText}
                            </Button>
                        }
                    />
                    <PopoverContent align="end" className="w-60 p-0">
                        <div className="mb-2 flex items-center justify-between px-2">
                            <div className="font-medium text-muted-foreground text-xs">
                                {locationTitle}
                            </div>
                            <button
                                type="button"
                                className="text-primary text-xs"
                                onClick={() =>
                                    updateChartState({
                                        selectedWorkerIds: [],
                                    })
                                }
                            >
                                All
                            </button>
                        </div>
                        <div className="space-y-1">
                            {workerIds.map((workerId) => {
                                const {
                                    primaryLabel,
                                    regionInfo,
                                    secondaryLabel,
                                } = getLocationDisplay(workerId);
                                const Flag = regionInfo.Flag;
                                const checked = activeWorkerIdSet.has(workerId);
                                return (
                                    // biome-ignore lint/a11y/noLabelWithoutControl: shhhh its okay
                                    <label
                                        key={workerId}
                                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                                    >
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={(nextChecked) => {
                                                const nextWorkerIds =
                                                    nextChecked === true
                                                        ? [
                                                              ...activeWorkerIds,
                                                              workerId,
                                                          ]
                                                        : activeWorkerIds.filter(
                                                              (value) =>
                                                                  value !==
                                                                  workerId,
                                                          );

                                                if (
                                                    nextWorkerIds.length === 0
                                                ) {
                                                    return;
                                                }

                                                updateChartState({
                                                    selectedWorkerIds:
                                                        normalizeWorkerSelectionForUrl(
                                                            nextWorkerIds,
                                                            workerIds,
                                                        ),
                                                });
                                            }}
                                        />
                                        {isFontAwesomeRegionFlag(Flag) ? (
                                            <FontAwesomeIcon
                                                icon={Flag}
                                                className="size-4 shrink-0 rounded-[2px]"
                                            />
                                        ) : (
                                            <Flag className="size-4 shrink-0 rounded-[2px]" />
                                        )}
                                        <div className="min-w-0">
                                            <div className="truncate text-sm">
                                                {primaryLabel}
                                            </div>
                                            {secondaryLabel ? (
                                                <div className="truncate text-muted-foreground text-xs">
                                                    {secondaryLabel}
                                                </div>
                                            ) : null}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}

function ResponseTimeChartCardSection2({
    model,
}: {
    model: ResponseTimeChartModel;
}) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        latencyView,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        showLatencyTabs,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    return (
        <CardHeader className="space-y-5">
            <ResponseTimeChartCardSection3 model={model} />

            <div className="flex flex-wrap items-center justify-between gap-3">
                {showLatencyTabs ? (
                    <Tabs
                        value={latencyView}
                        onValueChange={(value) =>
                            updateChartState({
                                latencyView: value as LatencyView,
                            })
                        }
                    >
                        <TabsList
                            aria-label="Latency chart mode"
                            className="[&_[data-slot=tab-indicator]]:h-8"
                        >
                            <TabsTrigger className="h-8" value="percentiles">
                                Percentiles
                            </TabsTrigger>
                            <TabsTrigger className="h-8" value="average">
                                AVG
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                ) : (
                    <span />
                )}
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <span>Chart resolution</span>
                    <Select
                        value={effectiveLatencyResolutionMinutes}
                        onValueChange={(value) => {
                            if (value) {
                                updateChartState({
                                    latencyResolutionMinutes:
                                        normalizeLatencyResolution(
                                            latencyRange,
                                            value as LatencyResolutionKey,
                                        ),
                                });
                            }
                        }}
                    >
                        <SelectTrigger
                            aria-label="Chart resolution"
                            className="h-8 w-[140px] bg-background/60 text-foreground"
                        >
                            <SelectValue>
                                {
                                    RESOLUTION_OPTIONS.find(
                                        (option) =>
                                            option.value ===
                                            effectiveLatencyResolutionMinutes,
                                    )?.label
                                }
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {RESOLUTION_OPTIONS.map(({ label, value }) => (
                                <SelectItem
                                    key={value}
                                    value={value}
                                    disabled={
                                        value !== "all" &&
                                        compareLatencyResolution(
                                            value,
                                            MIN_LATENCY_RESOLUTION_BY_RANGE[
                                                latencyRange
                                            ],
                                        ) < 0
                                    }
                                >
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
    );
}

function ResponseTimeChartCardSection1({
    model,
}: {
    model: ResponseTimeChartModel;
}) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        latencyView,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        showLatencyTabs,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        isAverageLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    const showAverageTimings =
        hasDetailedTimings && (!showLatencyTabs || latencyView === "average");
    const showPercentiles = !showLatencyTabs || latencyView === "percentiles";
    const isCurrentViewLoading =
        showLatencyTabs && latencyView === "average"
            ? isAverageLatencyLoading
            : isLatencyLoading;

    return (
        <Card>
            <ResponseTimeChartCardSection2 model={model} />
            <CardContent className="space-y-5">
                <div className="h-[260px] w-full rounded-2xl border bg-muted/20 p-3">
                    {isCurrentViewLoading ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                            Loading latency data...
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                            No latency data available for this range
                        </div>
                    ) : (
                        <RechartsBoundary
                            fallback={
                                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                    Loading chart...
                                </div>
                            }
                        >
                            {({
                                ResponsiveContainer,
                                AreaChart,
                                CartesianGrid,
                                XAxis,
                                YAxis,
                                Tooltip,
                                ReferenceArea,
                                Area,
                                Line,
                            }) => (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart
                                        accessibilityLayer={false}
                                        data={chartData}
                                        margin={{
                                            top: 8,
                                            right: 6,
                                            bottom: 0,
                                            left: 0,
                                        }}
                                    >
                                        <CartesianGrid
                                            vertical={false}
                                            stroke="rgba(255,255,255,0.08)"
                                            strokeDasharray="0"
                                        />
                                        <XAxis
                                            dataKey="timestampMs"
                                            type="number"
                                            scale="time"
                                            domain={["dataMin", "dataMax"]}
                                            axisLine={false}
                                            tickLine={false}
                                            minTickGap={28}
                                            stroke="#8a8a8a"
                                            fontSize={11}
                                            tickFormatter={(value: number) =>
                                                formatAxisTimestamp(
                                                    Number(value),
                                                    latencyRange,
                                                )
                                            }
                                        />
                                        <YAxis
                                            orientation="right"
                                            axisLine={false}
                                            tickLine={false}
                                            width={54}
                                            stroke="#8a8a8a"
                                            fontSize={11}
                                            tickFormatter={(value: number) =>
                                                `${Math.round(value)}ms`
                                            }
                                        />
                                        <Tooltip
                                            content={ResponseTimeTooltip}
                                        />
                                        {latencyBands.map((band) => (
                                            <ReferenceArea
                                                key={`${band.severity}-${band.startMs}-${band.endMs}`}
                                                x1={band.startMs}
                                                x2={band.endMs}
                                                fill={
                                                    STATUS_BAND_COLORS[
                                                        band.severity
                                                    ]
                                                }
                                                fillOpacity={
                                                    band.severity === "down"
                                                        ? 0.34
                                                        : 0.28
                                                }
                                                stroke={
                                                    STATUS_BAND_COLORS[
                                                        band.severity
                                                    ]
                                                }
                                                strokeOpacity={0.2}
                                                ifOverflow="extendDomain"
                                            />
                                        ))}

                                        {showAverageTimings &&
                                            TIMING_KEYS.map((key) => (
                                                <Area
                                                    key={key}
                                                    type="monotone"
                                                    dataKey={key}
                                                    name={TIMING_LABELS[key]}
                                                    stackId="latency"
                                                    stroke={TIMING_COLORS[key]}
                                                    fill={TIMING_COLORS[key]}
                                                    fillOpacity={
                                                        key === "transfer"
                                                            ? 0.25
                                                            : 0.18
                                                    }
                                                    strokeWidth={1.6}
                                                    dot={false}
                                                    isAnimationActive={false}
                                                />
                                            ))}
                                        {showPercentiles &&
                                            QUANTILE_VALUES.map((quantile) => (
                                                <Line
                                                    key={quantile}
                                                    type="monotone"
                                                    dataKey={getLatencySeriesKey(
                                                        quantile,
                                                        "latency",
                                                    )}
                                                    name={`Latency ${quantile.toUpperCase()}`}
                                                    stroke={
                                                        QUANTILE_COLORS[
                                                            quantile
                                                        ]
                                                    }
                                                    strokeWidth={
                                                        quantile ===
                                                        latencyQuantile
                                                            ? 2.8
                                                            : 1.6
                                                    }
                                                    strokeOpacity={
                                                        quantile ===
                                                        latencyQuantile
                                                            ? 1
                                                            : 0.72
                                                    }
                                                    dot={false}
                                                    isAnimationActive={false}
                                                />
                                            ))}
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </RechartsBoundary>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                    {showPercentiles &&
                        QUANTILE_OPTIONS.map(({ label, value }) => (
                            <div
                                key={value}
                                className="flex items-center gap-2 text-muted-foreground"
                            >
                                <span
                                    className="h-0.5 w-4"
                                    style={{
                                        backgroundColor: QUANTILE_COLORS[value],
                                    }}
                                />
                                <span>Latency {label}</span>
                            </div>
                        ))}
                    {showAverageTimings &&
                        TIMING_KEYS.map((key) => (
                            <div
                                key={key}
                                className="flex items-center gap-2 text-muted-foreground"
                            >
                                <span
                                    className="h-2.5 w-2.5 rounded-[2px]"
                                    style={{
                                        backgroundColor: TIMING_COLORS[key],
                                    }}
                                />
                                <span>{TIMING_LABELS[key]}</span>
                            </div>
                        ))}
                </div>
            </CardContent>
        </Card>
    );
}

function useResponseTimeChartDataTable6Model({
    model,
}: {
    model: ResponseTimeChartModel;
}) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    return {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    };
}

type ResponseTimeChartDataTable6Model = ReturnType<
    typeof useResponseTimeChartDataTable6Model
>;

function ResponseTimeChartDataTable6DataTable3({
    model,
}: {
    model: ResponseTimeChartDataTable6Model;
}) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    return (
        <Table>
            <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="px-4">
                        {locationTitle.slice(0, -1)}
                    </TableHead>
                    <TableHead className="min-w-[260px]">Trend</TableHead>
                    {(["p50", "p90", "p99"] as const).map((metric) => (
                        <TableHead key={metric} className="w-[90px] text-right">
                            <button
                                type="button"
                                className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                    updateChartState({
                                        sortBy: metric,
                                        page: 1,
                                    })
                                }
                            >
                                <span className="uppercase">{metric}</span>
                                <FontAwesomeIcon
                                    icon={faUpDown}
                                    className="h-3.5 w-3.5"
                                />
                            </button>
                        </TableHead>
                    ))}
                    <TableHead className="w-[48px]" />
                </TableRow>
            </TableHeader>
            <TableBody>
                {paginatedRegionMetrics.map((row) => {
                    const { primaryLabel, regionInfo, secondaryLabel } =
                        getLocationDisplay(row.workerId);
                    const Flag = regionInfo.Flag;
                    return (
                        <TableRow
                            key={row.workerId}
                            className="border-border/50 hover:bg-white/2"
                        >
                            <TableCell className="px-4">
                                <div className="flex items-center gap-3">
                                    {isFontAwesomeRegionFlag(Flag) ? (
                                        <FontAwesomeIcon
                                            icon={Flag}
                                            className="size-4 shrink-0 rounded-[2px]"
                                        />
                                    ) : (
                                        <Flag className="size-4 shrink-0 rounded-[2px]" />
                                    )}
                                    <div className="min-w-0">
                                        <div className="truncate font-medium text-sm">
                                            {primaryLabel}
                                        </div>
                                        {secondaryLabel ? (
                                            <div className="truncate text-muted-foreground text-xs">
                                                {secondaryLabel}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-4">
                                    <RegionTrendSparkline data={row.trend} />
                                    <div className="w-[52px] text-right text-xs">
                                        <div className="font-medium text-foreground">
                                            {formatMetric(row.max)}
                                        </div>
                                        <div className="text-muted-foreground">
                                            {formatMetric(row.min)}
                                        </div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-foreground">
                                {formatMetric(row.p50)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-foreground">
                                {formatMetric(row.p90)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-foreground">
                                {formatMetric(row.p99)}
                            </TableCell>
                            <TableCell className="pr-4 text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        render={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground"
                                            >
                                                <FontAwesomeIcon
                                                    icon={faEllipsis}
                                                    className="h-4 w-4"
                                                />
                                            </Button>
                                        }
                                    />
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>
                                            {primaryLabel}
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuCheckboxItem checked>
                                            Current{" "}
                                            {regionQuantile.toUpperCase()}:{" "}
                                            {formatMetric(row.current)}
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked>
                                            Peak: {formatMetric(row.max)}
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

function ResponseTimeChartDataTable6DataTable2({
    model,
}: {
    model: ResponseTimeChartDataTable6Model;
}) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    return (
        <div className="rounded-2xl border bg-muted/20">
            <ResponseTimeChartDataTable6DataTable3 model={model} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-border/50 border-t px-4 py-3 text-sm">
                <div className="text-muted-foreground">
                    {regionMetrics.length}{" "}
                    {workers.length > 0 ? "worker" : "region"}
                    (s) visible.
                </div>
                {totalPages > 1 && (
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                                Rows per page
                            </span>
                            <Select
                                value={rowsPerPage}
                                onValueChange={(value) => {
                                    if (value) {
                                        updateChartState({
                                            rowsPerPage: value,
                                            page: 1,
                                        });
                                    }
                                }}
                            >
                                <SelectTrigger className="h-8 w-[78px] rounded-xl border-border/70 bg-background/60">
                                    <SelectValue>
                                        {
                                            ROWS_PER_PAGE_OPTIONS.find(
                                                (option) =>
                                                    option.value ===
                                                    rowsPerPage,
                                            )?.label
                                        }
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {ROWS_PER_PAGE_OPTIONS.map(
                                        ({ label, value }) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="text-muted-foreground">
                            Page {page} of {totalPages}
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={page === 1}
                                onClick={() =>
                                    updateChartState({
                                        page: 1,
                                    })
                                }
                            >
                                <FontAwesomeIcon
                                    icon={faAnglesLeft}
                                    className="h-4 w-4"
                                />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={page === 1}
                                onClick={() =>
                                    updateChartState({
                                        page: Math.max(1, page - 1),
                                    })
                                }
                            >
                                <FontAwesomeIcon
                                    icon={faChevronLeft}
                                    className="h-4 w-4"
                                />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={page === totalPages}
                                onClick={() =>
                                    updateChartState({
                                        page: Math.min(totalPages, page + 1),
                                    })
                                }
                            >
                                <FontAwesomeIcon
                                    icon={faChevronRight}
                                    className="h-4 w-4"
                                />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={page === totalPages}
                                onClick={() =>
                                    updateChartState({
                                        page: totalPages,
                                    })
                                }
                            >
                                <FontAwesomeIcon
                                    icon={faAnglesRight}
                                    className="h-4 w-4"
                                />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ResponseTimeChartDataTable6DataTable1({
    model,
}: {
    model: ResponseTimeChartDataTable6Model;
}) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    return (
        <>
            {regionView === "table" ? (
                <ResponseTimeChartDataTable6DataTable2 model={model} />
            ) : (
                <div className="rounded-2xl border bg-muted/20 p-4">
                    <div className="h-[320px] w-full">
                        {isRegionLoading ? (
                            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                Loading regional latency data...
                            </div>
                        ) : regionChartData.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                No regional latency data available for this
                                range
                            </div>
                        ) : (
                            <RechartsBoundary
                                fallback={
                                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                        Loading chart...
                                    </div>
                                }
                            >
                                {({
                                    ResponsiveContainer,
                                    LineChart,
                                    CartesianGrid,
                                    XAxis,
                                    YAxis,
                                    Tooltip,
                                    ReferenceArea,
                                    Line,
                                }) => (
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <LineChart
                                            accessibilityLayer={false}
                                            data={regionChartData}
                                            margin={{
                                                top: 8,
                                                right: 8,
                                                bottom: 0,
                                                left: 0,
                                            }}
                                        >
                                            <CartesianGrid
                                                vertical={false}
                                                stroke="rgba(255,255,255,0.08)"
                                                strokeDasharray="0"
                                            />
                                            <XAxis
                                                dataKey="timestampMs"
                                                type="number"
                                                scale="time"
                                                domain={["dataMin", "dataMax"]}
                                                axisLine={false}
                                                tickLine={false}
                                                minTickGap={28}
                                                stroke="#8a8a8a"
                                                fontSize={11}
                                                tickFormatter={(
                                                    value: number,
                                                ) =>
                                                    formatAxisTimestamp(
                                                        Number(value),
                                                        regionRange,
                                                    )
                                                }
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                width={54}
                                                stroke="#8a8a8a"
                                                fontSize={11}
                                                tickFormatter={(
                                                    value: number,
                                                ) => `${Math.round(value)}ms`}
                                            />
                                            <Tooltip
                                                content={ResponseTimeTooltip}
                                            />
                                            {regionBands.map((band) => (
                                                <ReferenceArea
                                                    key={`${band.severity}-${band.startMs}-${band.endMs}`}
                                                    x1={band.startMs}
                                                    x2={band.endMs}
                                                    fill={
                                                        STATUS_BAND_COLORS[
                                                            band.severity
                                                        ]
                                                    }
                                                    fillOpacity={
                                                        band.severity === "down"
                                                            ? 0.34
                                                            : 0.28
                                                    }
                                                    stroke={
                                                        STATUS_BAND_COLORS[
                                                            band.severity
                                                        ]
                                                    }
                                                    strokeOpacity={0.2}
                                                    ifOverflow="extendDomain"
                                                />
                                            ))}
                                            {activeWorkerIds.flatMap(
                                                (workerId) => {
                                                    const { primaryLabel } =
                                                        getLocationDisplay(
                                                            workerId,
                                                        );
                                                    return QUANTILE_VALUES.map(
                                                        (quantile) => (
                                                            <Line
                                                                key={getRegionSeriesKey(
                                                                    workerId,
                                                                    quantile,
                                                                )}
                                                                type="monotone"
                                                                dataKey={getRegionSeriesKey(
                                                                    workerId,
                                                                    quantile,
                                                                )}
                                                                name={`${primaryLabel} ${quantile.toUpperCase()}`}
                                                                stroke={
                                                                    regionColors[
                                                                        workerId
                                                                    ][quantile]
                                                                }
                                                                strokeOpacity={
                                                                    1
                                                                }
                                                                strokeWidth={
                                                                    quantile ===
                                                                    regionQuantile
                                                                        ? 2.4
                                                                        : 1.8
                                                                }
                                                                dot={false}
                                                                isAnimationActive={
                                                                    false
                                                                }
                                                            />
                                                        ),
                                                    );
                                                },
                                            )}
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </RechartsBoundary>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
function ResponseTimeChartDataTable6View({
    model,
}: {
    model: ResponseTimeChartDataTable6Model;
}) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    return (
        <>
            <ResponseTimeChartDataTable6DataTable1 model={model} />
        </>
    );
}

function ResponseTimeChartDataTable6({
    model,
}: {
    model: ResponseTimeChartModel;
}) {
    const sectionModel = useResponseTimeChartDataTable6Model({ model });
    return <ResponseTimeChartDataTable6View model={sectionModel} />;
}

function ResponseTimeChartDataTable5({
    model,
}: {
    model: ResponseTimeChartModel;
}) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    return (
        <CardContent>
            <ResponseTimeChartDataTable6 model={model} />
        </CardContent>
    );
}

function ResponseTimeChartCardSection4({
    model,
}: {
    model: ResponseTimeChartModel;
}) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5">
                        <CardTitle className="font-semibold text-xl tracking-tight">
                            Regions
                        </CardTitle>
                        <p className="text-muted-foreground text-sm">
                            Every selected region&apos;s latency trend
                        </p>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
                        {regionView === "chart" && (
                            <div className="flex flex-wrap items-center justify-end gap-3 text-xs">
                                {activeWorkerIds.map((workerId) => {
                                    const { primaryLabel } =
                                        getLocationDisplay(workerId);
                                    return (
                                        <div
                                            key={workerId}
                                            className="flex items-center gap-2 text-muted-foreground"
                                        >
                                            <span className="flex items-center gap-0.5">
                                                {QUANTILE_VALUES.map(
                                                    (quantile) => (
                                                        <span
                                                            key={quantile}
                                                            className="h-2.5 w-2 rounded-[2px]"
                                                            style={{
                                                                backgroundColor:
                                                                    regionColors[
                                                                        workerId
                                                                    ][quantile],
                                                            }}
                                                        />
                                                    ),
                                                )}
                                            </span>
                                            <span>{primaryLabel}</span>
                                        </div>
                                    );
                                })}
                                {QUANTILE_OPTIONS.map(({ label, value }) => (
                                    <div
                                        key={value}
                                        className="flex items-center gap-2 text-muted-foreground"
                                    >
                                        <span
                                            className="w-4 border-t-2"
                                            style={{
                                                borderColor: `hsl(0, 0%, ${REGION_QUANTILE_LIGHTNESS[value]}%)`,
                                            }}
                                        />
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-1">
                            <button
                                type="button"
                                onClick={() =>
                                    updateChartState({ regionView: "chart" })
                                }
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-xs transition-colors",
                                    regionView === "chart"
                                        ? "bg-muted text-foreground"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                Chart
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    updateChartState({ regionView: "table" })
                                }
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-xs transition-colors",
                                    regionView === "table"
                                        ? "bg-muted text-foreground"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                Table
                            </button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <ResponseTimeChartDataTable5 model={model} />
        </Card>
    );
}
function ResponseTimeChartView({ model }: { model: ResponseTimeChartModel }) {
    const {
        monitorId,
        workerIds,
        monitorType,
        workers,
        chartState,
        setChartState,
        latencyRange,
        latencyQuantile,
        latencyResolutionMinutes,
        regionRange,
        regionQuantile,
        regionView,
        rowsPerPage,
        sortBy,
        selectedWorkerIds,
        page,
        updateChartState,
        hasDetailedTimings,
        activeWorkerIds,
        effectiveLatencyResolutionMinutes,
        isAllChecksResolution,
        latencyBucketSeconds,
        latencyRawData,
        isLatencyLoading,
        regionRawData,
        isRegionLoading,
        workersById,
        locationTitle,
        getLocationDisplay,
        baseLatencyChartData,
        latencyGapThresholdMs,
        latencyStatusBucketMs,
        latencyBands,
        chartData,
        regionMetrics,
        regionColors,
        baseRegionChartData,
        regionGapThresholdMs,
        regionBands,
        regionChartData,
        totalPages,
        paginatedRegionMetrics,
        regionPageResetKey,
        previousRegionPageResetKey,
        summaryText,
        activeWorkerIdSet,
    } = model;
    return (
        <div className="space-y-6">
            <DashboardHeaderActions>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <span className="hidden lg:inline">Quantile</span>
                        <Select
                            aria-label="Global quantile"
                            value={latencyQuantile}
                            onValueChange={(value) =>
                                updateChartState({
                                    latencyQuantile: value as QuantileKey,
                                })
                            }
                        >
                            <SelectTrigger className="h-8 w-[86px] bg-background/60 text-foreground">
                                <SelectValue>
                                    {
                                        QUANTILE_OPTIONS.find(
                                            (option) =>
                                                option.value ===
                                                latencyQuantile,
                                        )?.label
                                    }
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {QUANTILE_OPTIONS.map(({ label, value }) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <span className="hidden lg:inline">Period</span>
                        <Select
                            aria-label="Global period"
                            value={latencyRange}
                            onValueChange={(value) => {
                                const nextRange = value as RangeKey;
                                updateChartState({
                                    latencyRange: nextRange,
                                    latencyResolutionMinutes:
                                        normalizeLatencyResolution(
                                            nextRange,
                                            effectiveLatencyResolutionMinutes,
                                        ),
                                });
                            }}
                        >
                            <SelectTrigger className="h-8 w-[150px] bg-background/60 text-foreground">
                                <SelectValue>
                                    {
                                        RANGE_OPTIONS.find(
                                            (option) =>
                                                option.value === latencyRange,
                                        )?.label
                                    }
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {RANGE_OPTIONS.map(({ label, value }) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </DashboardHeaderActions>

            <div className="space-y-1">
                <h2 className="font-semibold text-lg tracking-tight">
                    Response time metrics
                </h2>
                <p className="text-muted-foreground text-sm">
                    Compare every latency quantile across the selected period.
                </p>
            </div>

            <ResponseTimeChartCardSection1 model={model} />

            <ResponseTimeChartCardSection4 model={model} />
        </div>
    );
}

export function ResponseTimeChart({
    monitorId,
    workerIds,
    monitorType = "http",
    isHttps = false,
    workers = [],
}: ResponseTimeChartProps) {
    const model = useResponseTimeChartModel({
        monitorId,
        workerIds,
        monitorType,
        isHttps,
        workers,
    });
    return <ResponseTimeChartView model={model} />;
}
