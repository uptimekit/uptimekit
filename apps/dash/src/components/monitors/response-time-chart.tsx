"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	ChevronsUpDown,
	Globe,
	MoreHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
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
	locations: string[];
	monitorType?: string;
}

const HTTP_MONITOR_TYPES = ["http", "http-json", "keyword"];
const TIMING_KEYS = [
	"dnsLookup",
	"tcpConnect",
	"tlsHandshake",
	"ttfb",
	"transfer",
] as const;
type TimingKey = (typeof TIMING_KEYS)[number];
type QuantileKey = "p50" | "p90" | "p99";
type RangeKey = "24h" | "7d" | "30d";
type RegionView = "table" | "chart";
type ChartStateUpdate = Partial<{
	latencyRange: RangeKey;
	latencyQuantile: QuantileKey;
	latencyResolutionMinutes: "5" | "15" | "30" | "60";
	regionRange: RangeKey;
	regionQuantile: QuantileKey;
	regionView: RegionView;
	rowsPerPage: "10" | "20" | "50";
	page: number;
	sortBy: QuantileKey;
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
	{ label: "Last day", value: "24h" },
	{ label: "Last week", value: "7d" },
	{ label: "Last month", value: "30d" },
] as const;

const RESOLUTION_OPTIONS = [
	{ label: "5 minutes", value: "5" },
	{ label: "15 minutes", value: "15" },
	{ label: "30 minutes", value: "30" },
	{ label: "1 hour", value: "60" },
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

interface RawDataPoint {
	timestamp: string;
	location: string;
	latency: number;
	dnsLookup?: number;
	tcpConnect?: number;
	tlsHandshake?: number;
	ttfb?: number;
	transfer?: number;
}

interface LatencyBucketPoint {
	timestamp: string;
	label: string;
	latency: number;
	dnsLookup: number;
	tcpConnect: number;
	tlsHandshake: number;
	ttfb: number;
	transfer: number;
}

interface RegionTrendPoint {
	label: string;
	value: number;
}

interface RegionMetricRow {
	location: string;
	trend: RegionTrendPoint[];
	current: number | null;
	min: number | null;
	max: number | null;
	p50: number | null;
	p90: number | null;
	p99: number | null;
}

const ONE_MINUTE_MS = 60_000;

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

const formatChartTimestamp = (timestamp: string, range: RangeKey) => {
	const date = new Date(timestamp);
	if (range === "24h") {
		return format(date, "MMM d 'at' h:mm a");
	}
	if (range === "7d") {
		return format(date, "MMM d 'at' h:mm a");
	}
	return format(date, "MMM d");
};

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
	locations,
	monitorType = "http",
}: ResponseTimeChartProps) {
	const [latencyRange, setLatencyRange] = useState<RangeKey>("24h");
	const [latencyQuantile, setLatencyQuantile] = useState<QuantileKey>("p50");
	const [latencyResolutionMinutes, setLatencyResolutionMinutes] = useState<
		"5" | "15" | "30" | "60"
	>("30");
	const [regionRange, setRegionRange] = useState<RangeKey>("24h");
	const [regionQuantile, setRegionQuantile] = useState<QuantileKey>("p50");
	const [regionView, setRegionView] = useState<RegionView>("table");
	const [rowsPerPage, setRowsPerPage] = useState<"10" | "20" | "50">("20");
	const [page, setPage] = useState(1);
	const [sortBy, setSortBy] = useState<QuantileKey>("p50");
	const [selectedLocations, setSelectedLocations] = useState<string[]>(() =>
		locations.length > 0 ? [...locations] : [],
	);
	const updateChartState = (nextState: ChartStateUpdate) => {
		if (nextState.latencyRange !== undefined) {
			setLatencyRange(nextState.latencyRange);
		}
		if (nextState.latencyQuantile !== undefined) {
			setLatencyQuantile(nextState.latencyQuantile);
		}
		if (nextState.latencyResolutionMinutes !== undefined) {
			setLatencyResolutionMinutes(nextState.latencyResolutionMinutes);
		}
		if (nextState.regionRange !== undefined) {
			setRegionRange(nextState.regionRange);
		}
		if (nextState.regionQuantile !== undefined) {
			setRegionQuantile(nextState.regionQuantile);
		}
		if (nextState.regionView !== undefined) {
			setRegionView(nextState.regionView);
		}
		if (nextState.rowsPerPage !== undefined) {
			setRowsPerPage(nextState.rowsPerPage);
		}
		if (nextState.page !== undefined) {
			setPage(nextState.page);
		}
		if (nextState.sortBy !== undefined) {
			setSortBy(nextState.sortBy);
		}
	};

	useEffect(() => {
		if (locations.length === 0) {
			setSelectedLocations([]);
			return;
		}

		setSelectedLocations((prev) => {
			const next = prev.filter((location) => locations.includes(location));
			return next.length > 0 ? next : [...locations];
		});
	}, [locations]);

	const hasDetailedTimings = HTTP_MONITOR_TYPES.includes(monitorType);

	const { data: latencyRawData = [], isLoading: isLatencyLoading } = useQuery({
		...orpc.monitors.getResponseTimes.queryOptions({
			input: {
				monitorId,
				range: latencyRange,
				locations: selectedLocations,
			},
		}),
		enabled: selectedLocations.length > 0,
	});

	const { data: regionRawData = [], isLoading: isRegionLoading } = useQuery({
		...orpc.monitors.getResponseTimes.queryOptions({
			input: {
				monitorId,
				range: regionRange,
				locations: selectedLocations,
			},
		}),
		enabled: selectedLocations.length > 0,
	});

	const activeLocations = useMemo(
		() => selectedLocations.filter((location) => locations.includes(location)),
		[selectedLocations, locations],
	);

	const chartData = useMemo((): LatencyBucketPoint[] => {
		if (latencyRawData.length === 0) {
			return [];
		}

		const grouped = latencyRawData.reduce(
			(acc, point) => {
				const bucketStart = getBucketStart(
					point.timestamp,
					Number(latencyResolutionMinutes),
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
				label: formatChartTimestamp(timestamp, latencyRange),
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
	}, [latencyRawData, latencyResolutionMinutes, latencyRange, latencyQuantile]);

	const regionMetrics = useMemo((): RegionMetricRow[] => {
		if (regionRawData.length === 0) {
			return [];
		}

		return activeLocations
			.map((location) => {
				const regionPoints = regionRawData.filter(
					(point) => point.location === location,
				);
				const groupedTrend = regionPoints.reduce(
					(acc, point) => {
						const bucketStart = getBucketStart(point.timestamp, 15);
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
					location,
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
	}, [activeLocations, regionRawData, regionRange, regionQuantile, sortBy]);

	const regionColors = useMemo(() => {
		const colors: Record<string, string> = {};
		activeLocations.forEach((location, index) => {
			colors[location] = generateRegionColor(index, activeLocations.length);
		});
		return colors;
	}, [activeLocations]);

	const regionChartData = useMemo(() => {
		if (regionRawData.length === 0 || activeLocations.length === 0) {
			return [];
		}

		const grouped = regionRawData.reduce(
			(acc, point) => {
				const bucketStart = getBucketStart(point.timestamp, 15);
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
				const byLocation = activeLocations.reduce(
					(acc, location) => {
						const locationLatencies = points
							.filter((point) => point.location === location)
							.map((point) => point.latency);
						acc[location] =
							locationLatencies.length > 0
								? calculateQuantile(locationLatencies, regionQuantile)
								: null;
						return acc;
					},
					{} as Record<string, number | null>,
				);

				return {
					timestamp,
					label: formatChartTimestamp(timestamp, regionRange),
					...byLocation,
				};
			});
	}, [regionRawData, activeLocations, regionQuantile, regionRange]);

	const totalPages = Math.max(
		1,
		Math.ceil(regionMetrics.length / Number(rowsPerPage)),
	);
	const paginatedRegionMetrics = regionMetrics.slice(
		(page - 1) * Number(rowsPerPage),
		page * Number(rowsPerPage),
	);

	useEffect(() => {
		if (page === 1) {
			return;
		}

		updateChartState({ page: 1 });
	}, [
		page,
		rowsPerPage,
		regionMetrics.length,
		sortBy,
		regionRange,
		regionQuantile,
	]);

	const topChartTooltip = ({ active, payload, label }: any) => {
		if (!active || !payload?.length) {
			return null;
		}

		return (
			<div className="rounded-xl border border-border bg-background/96 px-3 py-2 text-xs shadow-xl backdrop-blur">
				<div className="mb-2 font-medium text-foreground">{label}</div>
				<div className="space-y-1.5">
					{payload.map((entry: any) => (
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

	const regionChartTooltip = ({ active, payload, label }: any) => {
		if (!active || !payload?.length) {
			return null;
		}

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
		activeLocations.length === locations.length
			? "All regions"
			: `${activeLocations.length} selected`;

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
								Response time across all the regions
							</p>
						</div>
						{locations.length > 0 && (
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
											Regions
										</div>
										<button
											type="button"
											className="text-primary text-xs"
											onClick={() => setSelectedLocations([...locations])}
										>
											All
										</button>
									</div>
									<div className="space-y-1">
										{locations.map((location) => {
											const regionInfo = getRegionInfo(location);
											const checked = selectedLocations.includes(location);
											return (
												// biome-ignore lint/a11y/noLabelWithoutControl: shhhh its okay
												<label
													key={location}
													className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
												>
													<Checkbox
														checked={checked}
														onCheckedChange={(nextChecked) => {
															setSelectedLocations((prev) => {
																if (nextChecked) {
																	return prev.includes(location)
																		? prev
																		: [...prev, location];
																}

																const next = prev.filter(
																	(value) => value !== location,
																);
																return next.length > 0 ? next : prev;
															});
														}}
													/>
													<regionInfo.Flag className="h-3.5 w-5 rounded-[2px]" />
													<span className="text-sm">{regionInfo.label}</span>
												</label>
											);
										})}
									</div>
								</PopoverContent>
							</Popover>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
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
						<span>quantile within a</span>
						<Select
							value={latencyResolutionMinutes}
							onValueChange={(value) => {
								if (value) {
									updateChartState({
										latencyResolutionMinutes: value,
									});
								}
							}}
						>
							<SelectTrigger className="h-8 w-[140px] bg-background/60 text-foreground">
								<SelectValue>
									{
										RESOLUTION_OPTIONS.find(
											(option) => option.value === latencyResolutionMinutes,
										)?.label
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{RESOLUTION_OPTIONS.map(({ label, value }) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<span>resolution</span>
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
										dataKey="label"
										axisLine={false}
										tickLine={false}
										minTickGap={28}
										stroke="#8a8a8a"
										fontSize={11}
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
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{regionView === "table" ? (
						<div className="rounded-2xl border bg-muted/20">
							<Table>
								<TableHeader>
									<TableRow className="border-border/60 hover:bg-transparent">
										<TableHead className="px-4">Region</TableHead>
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
										const regionInfo = getRegionInfo(row.location);
										return (
											<TableRow
												key={row.location}
												className="border-border/50 hover:bg-white/2"
											>
												<TableCell className="px-4">
													<div className="flex items-center gap-3">
														<regionInfo.Flag className="h-3.5 w-5 rounded-[2px]" />
														<span className="font-medium text-sm">
															{row.location}
														</span>
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
																{regionInfo.label}
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
									{regionMetrics.length} region(s) visible.
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
												dataKey="label"
												axisLine={false}
												tickLine={false}
												minTickGap={28}
												stroke="#8a8a8a"
												fontSize={11}
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
											{activeLocations.map((location) => {
												const regionInfo = getRegionInfo(location);
												return (
													<Line
														key={location}
														type="monotone"
														dataKey={location}
														name={regionInfo.label}
														stroke={regionColors[location]}
														strokeWidth={2}
														dot={false}
														connectNulls
														isAnimationActive={false}
													/>
												);
											})}
										</LineChart>
									</ResponsiveContainer>
								)}
							</div>
							<div className="flex flex-wrap items-center gap-4 text-xs">
								{activeLocations.map((location) => {
									const regionInfo = getRegionInfo(location);
									return (
										<div
											key={location}
											className="flex items-center gap-2 text-muted-foreground"
										>
											<span
												className="h-2.5 w-2.5 rounded-[2px]"
												style={{ backgroundColor: regionColors[location] }}
											/>
											<span>{regionInfo.label}</span>
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
