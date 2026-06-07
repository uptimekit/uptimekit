"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	parseAsArrayOf,
	parseAsInteger,
	parseAsString,
	parseAsStringEnum,
	useQueryStates,
} from "nuqs";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	ReferenceArea,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	ChevronsUpDown,
	Globe,
	MoreHorizontal,
} from "@/components/icons";
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
import { getRegionInfo } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

interface ResponseTimeChartProps {
	monitorId: string;
	workerIds: string[];
	monitorType?: string;
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
const REGION_VIEW_VALUES = ["table", "chart"] as const;
const ROWS_PER_PAGE_VALUES = ["10", "20", "50"] as const;
type TimingKey = (typeof TIMING_KEYS)[number];
type QuantileKey = (typeof QUANTILE_VALUES)[number];
type RangeKey = (typeof RANGE_VALUES)[number];
type LatencyResolutionKey = (typeof LATENCY_RESOLUTION_VALUES)[number];
type RegionView = (typeof REGION_VIEW_VALUES)[number];
type RowsPerPageKey = (typeof ROWS_PER_PAGE_VALUES)[number];
type ChartStateUpdate = Partial<{
	latencyRange: RangeKey;
	latencyQuantile: QuantileKey;
	latencyResolutionMinutes: LatencyResolutionKey;
	regionRange: RangeKey;
	regionQuantile: QuantileKey;
	regionView: RegionView;
	rowsPerPage: RowsPerPageKey;
	page: number;
	sortBy: QuantileKey;
	selectedWorkerIds: string[];
}>;

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

const generateRegionColor = (index: number, total: number) => {
	const hue = (index * 360) / Math.max(total, 1);
	return `hsl(${hue}, 75%, 58%)`;
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
}

interface RegionTrendPoint {
	label: string;
	value: number;
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
const LATENCY_CHART_VALUE_KEYS = [
	"latency",
	"dnsLookup",
	"tcpConnect",
	"tlsHandshake",
	"ttfb",
	"transfer",
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
		.map((point, index) =>
			index === 0 ? 0 : point.timestampMs - points[index - 1].timestampMs,
		)
		.filter((diff) => diff > 0)
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
			if (previous && point.timestampMs - previous.timestampMs > thresholdMs) {
				acc.push(
					createNullChartPoint(previous, previous.timestampMs + 1, valueKeys),
					createNullChartPoint(point, point.timestampMs - 1, valueKeys),
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
				severity: aggregateDown || allSelectedWorkersDown ? "down" : "degraded",
			};
		});
};

const mergeBands = (bands: ChartGapBand[]) =>
	bands
		.sort(
			(left, right) =>
				left.startMs - right.startMs || (left.severity === "down" ? -1 : 1),
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
			<ResponsiveContainer width="100%" height="100%">
				<LineChart
					data={data}
					margin={{ top: 3, right: 0, bottom: 3, left: 0 }}
				>
					<Line
						type="monotone"
						dataKey="value"
						stroke="#1dd67d"
						strokeWidth={2}
						dot={false}
						isAnimationActive={false}
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}

export function ResponseTimeChart({
	monitorId,
	workerIds,
	monitorType = "http",
	workers = [],
}: ResponseTimeChartProps) {
	const [chartState, setChartState] = useQueryStates(
		{
			latencyRange: parseAsStringEnum([...RANGE_VALUES]).withDefault("3h"),
			latencyQuantile: parseAsStringEnum([...QUANTILE_VALUES]).withDefault(
				"p99",
			),
			latencyResolutionMinutes: parseAsStringEnum([
				...LATENCY_RESOLUTION_VALUES,
			]).withDefault("1"),
			regionRange: parseAsStringEnum([...RANGE_VALUES]).withDefault("24h"),
			regionQuantile: parseAsStringEnum([...QUANTILE_VALUES]).withDefault(
				"p99",
			),
			regionView: parseAsStringEnum([...REGION_VIEW_VALUES]).withDefault(
				"chart",
			),
			rowsPerPage: parseAsStringEnum([...ROWS_PER_PAGE_VALUES]).withDefault(
				"20",
			),
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
		regionRange,
		regionQuantile,
		regionView,
		rowsPerPage,
		sortBy,
		selectedWorkerIds,
	} = chartState;
	const page = Math.max(chartState.page, 1);
	const updateChartState = useCallback(
		(nextState: ChartStateUpdate) => {
			void setChartState(nextState);
		},
		[setChartState],
	);

	useEffect(() => {
		if (workerIds.length === 0) {
			if (selectedWorkerIds.length > 0) {
				updateChartState({ selectedWorkerIds: [] });
			}
			return;
		}

		const normalizedWorkerIds = normalizeWorkerSelectionForUrl(
			selectedWorkerIds,
			workerIds,
		);

		if (normalizedWorkerIds.length !== selectedWorkerIds.length) {
			updateChartState({ selectedWorkerIds: normalizedWorkerIds });
		}
	}, [selectedWorkerIds, updateChartState, workerIds]);

	const hasDetailedTimings = HTTP_MONITOR_TYPES.includes(monitorType);
	const activeWorkerIds = useMemo(
		() => resolveSelectedWorkerIds(selectedWorkerIds, workerIds),
		[selectedWorkerIds, workerIds],
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

		updateChartState({
			latencyResolutionMinutes: effectiveLatencyResolutionMinutes,
		});
	}, [
		effectiveLatencyResolutionMinutes,
		latencyResolutionMinutes,
		updateChartState,
	]);

	const { data: latencyRawData = [], isLoading: isLatencyLoading } = useQuery({
		...orpc.monitors.getResponseTimes.queryOptions({
			input: {
				monitorId,
				range: latencyRange,
				workerIds: activeWorkerIds,
				allChecks: isAllChecksResolution,
				bucketSeconds: latencyBucketSeconds,
				bucketQuantile: latencyQuantile,
				groupByLocation: !isAllChecksResolution,
			},
		}),
		enabled: activeWorkerIds.length > 0,
	});

	const { data: regionRawData = [], isLoading: isRegionLoading } = useQuery({
		...orpc.monitors.getResponseTimes.queryOptions({
			input: {
				monitorId,
				range: regionRange,
				workerIds: activeWorkerIds,
				bucketSeconds: getRegionBucketSeconds(regionRange),
				bucketQuantile: regionQuantile,
				groupByLocation: true,
			},
		}),
		enabled: activeWorkerIds.length > 0,
	});

	const workersById = useMemo(
		() => new Map(workers.map((worker) => [worker.id, worker])),
		[workers],
	);
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

	const baseLatencyChartData = useMemo((): LatencyBucketPoint[] => {
		if (latencyRawData.length === 0) {
			return [];
		}

		if (isAllChecksResolution) {
			return latencyRawData.map((point) => ({
				timestamp: point.timestamp,
				timestampMs: new Date(point.timestamp).getTime(),
				label: formatDetailedTimestamp(point.timestamp),
				latency: point.latency,
				dnsLookup: point.dnsLookup ?? 0,
				tcpConnect: point.tcpConnect ?? 0,
				tlsHandshake: point.tlsHandshake ?? 0,
				ttfb: point.ttfb ?? 0,
				transfer: point.transfer ?? 0,
			}));
		}

		const grouped = latencyRawData.reduce(
			(acc, point) => {
				const bucketStart = getBucketStart(
					point.timestamp,
					Number(effectiveLatencyResolutionMinutes),
				);
				if (!acc[bucketStart]) {
					acc[bucketStart] = [];
				}
				acc[bucketStart].push(point);
				return acc;
			},
			{} as Record<string, RawDataPoint[]>,
		);

		return Object.entries(grouped)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([timestamp, points]) => ({
				timestamp,
				timestampMs: new Date(timestamp).getTime(),
				label: formatDetailedTimestamp(timestamp),
				latency: calculateQuantile(
					points.map((point) => point.latency),
					latencyQuantile,
				),
				dnsLookup: calculateQuantile(
					points.map((point) => point.dnsLookup),
					latencyQuantile,
				),
				tcpConnect: calculateQuantile(
					points.map((point) => point.tcpConnect),
					latencyQuantile,
				),
				tlsHandshake: calculateQuantile(
					points.map((point) => point.tlsHandshake),
					latencyQuantile,
				),
				ttfb: calculateQuantile(
					points.map((point) => point.ttfb),
					latencyQuantile,
				),
				transfer: calculateQuantile(
					points.map((point) => point.transfer),
					latencyQuantile,
				),
			}));
	}, [
		latencyRawData,
		isAllChecksResolution,
		effectiveLatencyResolutionMinutes,
		latencyQuantile,
	]);
	const latencyGapThresholdMs = useMemo(
		() =>
			getGapThresholdMs(
				baseLatencyChartData,
				(latencyBucketSeconds ?? 60) * 1000,
			),
		[baseLatencyChartData, latencyBucketSeconds],
	);
	const latencyStatusBucketMs = useMemo(
		() =>
			latencyBucketSeconds != null
				? latencyBucketSeconds * 1000
				: Math.max(getMedianIntervalMs(baseLatencyChartData) ?? 60_000, 60_000),
		[baseLatencyChartData, latencyBucketSeconds],
	);
	const latencyBands = useMemo(
		() =>
			mergeBands([
				...getGapBands(baseLatencyChartData, latencyGapThresholdMs),
				...getStatusBands(
					latencyRawData,
					latencyStatusBucketMs,
					activeWorkerIds,
				),
			]),
		[
			activeWorkerIds,
			baseLatencyChartData,
			latencyGapThresholdMs,
			latencyRawData,
			latencyStatusBucketMs,
		],
	);
	const chartData = useMemo(
		() =>
			insertGapBreaks(
				baseLatencyChartData,
				latencyGapThresholdMs,
				LATENCY_CHART_VALUE_KEYS,
			),
		[baseLatencyChartData, latencyGapThresholdMs],
	);

	const regionMetrics = useMemo((): RegionMetricRow[] => {
		if (regionRawData.length === 0) {
			return [];
		}

		return activeWorkerIds
			.map((workerId) => {
				const regionPoints = regionRawData.filter(
					(point) => point.location === workerId,
				);
				const groupedTrend = regionPoints.reduce(
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
				);

				const trend = Object.entries(groupedTrend)
					.sort(([left], [right]) => left.localeCompare(right))
					.map(([timestamp, latencies]) => ({
						label: formatChartTimestamp(timestamp, regionRange),
						value: calculateQuantile(latencies, regionQuantile),
					}));

				const latencyValues = regionPoints.map((point) => point.latency);
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
					p50: calculateQuantile(latencyValues, "p50"),
					p90: calculateQuantile(latencyValues, "p90"),
					p99: calculateQuantile(latencyValues, "p99"),
				};
			})
			.sort((left, right) => (right[sortBy] ?? 0) - (left[sortBy] ?? 0));
	}, [activeWorkerIds, regionRawData, regionRange, regionQuantile, sortBy]);

	const regionColors = useMemo(() => {
		const colors: Record<string, string> = {};
		activeWorkerIds.forEach((workerId, index) => {
			colors[workerId] = generateRegionColor(index, activeWorkerIds.length);
		});
		return colors;
	}, [activeWorkerIds]);

	const baseRegionChartData = useMemo((): RegionChartPoint[] => {
		if (regionRawData.length === 0 || activeWorkerIds.length === 0) {
			return [];
		}

		const grouped = regionRawData.reduce(
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
		);

		return Object.entries(grouped)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([timestamp, points]) => {
				const byLocation = activeWorkerIds.reduce(
					(acc, workerId) => {
						const locationLatencies = points
							.filter((point) => point.location === workerId)
							.map((point) => point.latency);
						acc[workerId] =
							locationLatencies.length > 0
								? calculateQuantile(locationLatencies, regionQuantile)
								: null;
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
	}, [regionRawData, activeWorkerIds, regionQuantile, regionRange]);
	const regionGapThresholdMs = useMemo(
		() =>
			getGapThresholdMs(
				baseRegionChartData,
				getRegionBucketSeconds(regionRange) * 1000,
			),
		[baseRegionChartData, regionRange],
	);
	const regionBands = useMemo(
		() =>
			mergeBands([
				...getGapBands(baseRegionChartData, regionGapThresholdMs),
				...getStatusBands(
					regionRawData,
					getRegionBucketSeconds(regionRange) * 1000,
					activeWorkerIds,
				),
			]),
		[
			activeWorkerIds,
			baseRegionChartData,
			regionGapThresholdMs,
			regionRange,
			regionRawData,
		],
	);
	const regionChartData = useMemo(
		() =>
			insertGapBreaks(
				baseRegionChartData,
				regionGapThresholdMs,
				activeWorkerIds,
			),
		[activeWorkerIds, baseRegionChartData, regionGapThresholdMs],
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
			updateChartState({ page: 1 });
		}
	}, [page, regionPageResetKey, updateChartState]);

	const topChartTooltip = ({ active, payload }: any) => {
		if (!active || !payload?.length) {
			return null;
		}

		const label = payload[0]?.payload?.label;

		return (
			<div className="rounded-xl border border-border bg-background/96 px-3 py-2 text-xs shadow-xl backdrop-blur">
				<div className="mb-2 font-medium text-foreground">{label}</div>
				<div className="space-y-1.5">
					{payload
						.filter((entry: any) => entry.value != null)
						.map((entry: any) => (
							<div key={entry.dataKey} className="flex items-center gap-2">
								<span
									className="h-2.5 w-2.5 rounded-[2px]"
									style={{ backgroundColor: entry.color }}
								/>
								<span className="text-muted-foreground">{entry.name}</span>
								<span className="ml-auto font-medium text-foreground">
									{Math.round(entry.value)} ms
								</span>
							</div>
						))}
				</div>
			</div>
		);
	};

	const regionChartTooltip = ({ active, payload }: any) => {
		if (!active || !payload?.length) {
			return null;
		}

		const label = payload[0]?.payload?.label;

		return (
			<div className="rounded-xl border border-border bg-background/96 px-3 py-2 text-xs shadow-xl backdrop-blur">
				<div className="mb-2 font-medium text-foreground">{label}</div>
				<div className="space-y-1.5">
					{payload
						.filter((entry: any) => entry.value != null)
						.map((entry: any) => (
							<div key={entry.dataKey} className="flex items-center gap-2">
								<span
									className="h-2.5 w-2.5 rounded-[2px]"
									style={{ backgroundColor: entry.color }}
								/>
								<span className="text-muted-foreground">{entry.name}</span>
								<span className="ml-auto font-medium text-foreground">
									{Math.round(entry.value)} ms
								</span>
							</div>
						))}
				</div>
			</div>
		);
	};

	const summaryText =
		activeWorkerIds.length === workerIds.length
			? `All ${workers.length > 0 ? "workers" : "regions"}`
			: `${activeWorkerIds.length} selected`;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="space-y-5">
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
											<Globe className="h-4 w-4" />
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
												updateChartState({ selectedWorkerIds: [] })
											}
										>
											All
										</button>
									</div>
									<div className="space-y-1">
										{workerIds.map((workerId) => {
											const { primaryLabel, regionInfo, secondaryLabel } =
												getLocationDisplay(workerId);
											const checked = activeWorkerIds.includes(workerId);
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
																	? [...activeWorkerIds, workerId]
																	: activeWorkerIds.filter(
																			(value) => value !== workerId,
																		);

															if (nextWorkerIds.length === 0) {
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
													<regionInfo.Flag className="size-4 shrink-0 rounded-[2px]" />
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

					<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
						{isAllChecksResolution ? (
							<span>Latency over the</span>
						) : (
							<>
								<span>The</span>
								<Select
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
													(option) => option.value === latencyQuantile,
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
								<span>quantile over the</span>
							</>
						)}
						<Select
							value={latencyRange}
							onValueChange={(value) => {
								const nextRange = value as RangeKey;
								updateChartState({
									latencyRange: nextRange,
									latencyResolutionMinutes: normalizeLatencyResolution(
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
											(option) => option.value === latencyRange,
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
						<span>{isAllChecksResolution ? "shown as" : "within a"}</span>
						<Select
							value={effectiveLatencyResolutionMinutes}
							onValueChange={(value) => {
								if (value) {
									updateChartState({
										latencyResolutionMinutes: normalizeLatencyResolution(
											latencyRange,
											value as LatencyResolutionKey,
										),
									});
								}
							}}
						>
							<SelectTrigger className="h-8 w-[140px] bg-background/60 text-foreground">
								<SelectValue>
									{
										RESOLUTION_OPTIONS.find(
											(option) =>
												option.value === effectiveLatencyResolutionMinutes,
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
												MIN_LATENCY_RESOLUTION_BY_RANGE[latencyRange],
											) < 0
										}
									>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{!isAllChecksResolution && <span>resolution</span>}
					</div>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="h-[260px] w-full rounded-2xl border bg-muted/20 p-3">
						{isLatencyLoading ? (
							<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
								Loading latency data...
							</div>
						) : chartData.length === 0 ? (
							<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
								No latency data available for this range
							</div>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart
									data={chartData}
									margin={{ top: 8, right: 6, bottom: 0, left: 0 }}
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
										tickFormatter={(value) =>
											formatAxisTimestamp(Number(value), latencyRange)
										}
									/>
									<YAxis
										orientation="right"
										axisLine={false}
										tickLine={false}
										width={54}
										stroke="#8a8a8a"
										fontSize={11}
										tickFormatter={(value) => `${Math.round(value)}ms`}
									/>
									<Tooltip content={topChartTooltip} />
									{latencyBands.map((band) => (
										<ReferenceArea
											key={`${band.severity}-${band.startMs}-${band.endMs}`}
											x1={band.startMs}
											x2={band.endMs}
											fill={STATUS_BAND_COLORS[band.severity]}
											fillOpacity={band.severity === "down" ? 0.34 : 0.28}
											stroke={STATUS_BAND_COLORS[band.severity]}
											strokeOpacity={0.2}
											ifOverflow="extendDomain"
										/>
									))}

									{hasDetailedTimings ? (
										TIMING_KEYS.map((key) => (
											<Area
												key={key}
												type="monotone"
												dataKey={key}
												name={TIMING_LABELS[key]}
												stackId="latency"
												stroke={TIMING_COLORS[key]}
												fill={TIMING_COLORS[key]}
												fillOpacity={key === "transfer" ? 0.25 : 0.18}
												strokeWidth={1.6}
												dot={false}
												isAnimationActive={false}
											/>
										))
									) : (
										<Area
											type="monotone"
											dataKey="latency"
											name={
												QUANTILE_OPTIONS.find(
													(option) => option.value === latencyQuantile,
												)?.label
											}
											stroke="#ff2f92"
											fill="#ff2f92"
											fillOpacity={0.22}
											strokeWidth={1.8}
											dot={false}
											isAnimationActive={false}
										/>
									)}
								</AreaChart>
							</ResponsiveContainer>
						)}
					</div>

					{hasDetailedTimings && (
						<div className="flex flex-wrap items-center justify-center gap-4 text-xs">
							{TIMING_KEYS.map((key) => (
								<div
									key={key}
									className="flex items-center gap-2 text-muted-foreground"
								>
									<span
										className="h-2.5 w-2.5 rounded-[2px]"
										style={{ backgroundColor: TIMING_COLORS[key] }}
									/>
									<span>{TIMING_LABELS[key]}</span>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="space-y-5">
					<div className="space-y-1.5">
						<CardTitle className="font-semibold text-xl tracking-tight">
							Regions
						</CardTitle>
						<p className="text-muted-foreground text-sm">
							Every selected region&apos;s latency trend
						</p>
					</div>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
							<span>The</span>
							<Select
								value={regionQuantile}
								onValueChange={(value) =>
									updateChartState({
										regionQuantile: value as QuantileKey,
									})
								}
							>
								<SelectTrigger className="h-8 w-[86px] bg-background/60 text-foreground">
									<SelectValue>
										{
											QUANTILE_OPTIONS.find(
												(option) => option.value === regionQuantile,
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
							<span>quantile trend over the</span>
							<Select
								value={regionRange}
								onValueChange={(value) =>
									updateChartState({ regionRange: value as RangeKey })
								}
							>
								<SelectTrigger className="h-8 w-[126px] bg-background/60 text-foreground">
									<SelectValue>
										{
											RANGE_OPTIONS.find(
												(option) => option.value === regionRange,
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

						<div className="flex items-center gap-2 rounded-lg border bg-background/60 p-1">
							<button
								type="button"
								onClick={() => updateChartState({ regionView: "chart" })}
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
								onClick={() => updateChartState({ regionView: "table" })}
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
				</CardHeader>
				<CardContent>
					{regionView === "table" ? (
						<div className="rounded-2xl border bg-muted/20">
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
														updateChartState({ sortBy: metric, page: 1 })
													}
												>
													<span className="uppercase">{metric}</span>
													<ChevronsUpDown className="h-3.5 w-3.5" />
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
										return (
											<TableRow
												key={row.workerId}
												className="border-border/50 hover:bg-white/2"
											>
												<TableCell className="px-4">
													<div className="flex items-center gap-3">
														<regionInfo.Flag className="size-4 shrink-0 rounded-[2px]" />
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
																	<MoreHorizontal className="h-4 w-4" />
																</Button>
															}
														/>
														<DropdownMenuContent align="end">
															<DropdownMenuLabel>
																{primaryLabel}
															</DropdownMenuLabel>
															<DropdownMenuSeparator />
															<DropdownMenuCheckboxItem checked>
																Current {regionQuantile.toUpperCase()}:{" "}
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

							<div className="flex flex-wrap items-center justify-between gap-3 border-border/50 border-t px-4 py-3 text-sm">
								<div className="text-muted-foreground">
									{regionMetrics.length}{" "}
									{workers.length > 0 ? "worker" : "region"}(s) visible.
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
																(option) => option.value === rowsPerPage,
															)?.label
														}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													{ROWS_PER_PAGE_OPTIONS.map(({ label, value }) => (
														<SelectItem key={value} value={value}>
															{label}
														</SelectItem>
													))}
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
												onClick={() => updateChartState({ page: 1 })}
											>
												<ChevronsLeft className="h-4 w-4" />
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												disabled={page === 1}
												onClick={() =>
													updateChartState({ page: Math.max(1, page - 1) })
												}
											>
												<ChevronLeft className="h-4 w-4" />
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
												<ChevronRight className="h-4 w-4" />
											</Button>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												disabled={page === totalPages}
												onClick={() => updateChartState({ page: totalPages })}
											>
												<ChevronsRight className="h-4 w-4" />
											</Button>
										</div>
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
							<div className="h-[320px] w-full">
								{isRegionLoading ? (
									<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
										Loading regional latency data...
									</div>
								) : regionChartData.length === 0 ? (
									<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
										No regional latency data available for this range
									</div>
								) : (
									<ResponsiveContainer width="100%" height="100%">
										<LineChart
											data={regionChartData}
											margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
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
												tickFormatter={(value) =>
													formatAxisTimestamp(Number(value), regionRange)
												}
											/>
											<YAxis
												axisLine={false}
												tickLine={false}
												width={54}
												stroke="#8a8a8a"
												fontSize={11}
												tickFormatter={(value) => `${Math.round(value)}ms`}
											/>
											<Tooltip content={regionChartTooltip} />
											{regionBands.map((band) => (
												<ReferenceArea
													key={`${band.severity}-${band.startMs}-${band.endMs}`}
													x1={band.startMs}
													x2={band.endMs}
													fill={STATUS_BAND_COLORS[band.severity]}
													fillOpacity={band.severity === "down" ? 0.34 : 0.28}
													stroke={STATUS_BAND_COLORS[band.severity]}
													strokeOpacity={0.2}
													ifOverflow="extendDomain"
												/>
											))}
											{activeWorkerIds.map((workerId) => {
												const { primaryLabel } = getLocationDisplay(workerId);
												return (
													<Line
														key={workerId}
														type="monotone"
														dataKey={workerId}
														name={primaryLabel}
														stroke={regionColors[workerId]}
														strokeWidth={2}
														dot={false}
														isAnimationActive={false}
													/>
												);
											})}
										</LineChart>
									</ResponsiveContainer>
								)}
							</div>
							<div className="flex flex-wrap items-center gap-4 text-xs">
								{activeWorkerIds.map((workerId) => {
									const { primaryLabel } = getLocationDisplay(workerId);
									return (
										<div
											key={workerId}
											className="flex items-center gap-2 text-muted-foreground"
										>
											<span
												className="h-2.5 w-2.5 rounded-[2px]"
												style={{ backgroundColor: regionColors[workerId] }}
											/>
											<span>{primaryLabel}</span>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
