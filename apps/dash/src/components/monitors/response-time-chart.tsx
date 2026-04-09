"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getRegionInfo } from "@/lib/regions";
import { orpc } from "@/utils/orpc";

interface ResponseTimeChartProps {
	monitorId: string;
	locations: string[];
	monitorType?: string;
}

// HTTP monitor types that have detailed timings
const HTTP_MONITOR_TYPES = ["http", "http-json", "keyword"];

// Timing component colors for breakdown view
const TIMING_COLORS = {
	dnsLookup: "#6366f1", // indigo
	tcpConnect: "#8b5cf6", // violet
	tlsHandshake: "#a855f7", // purple
	ttfb: "#22d3ee", // cyan
	transfer: "#34d399", // emerald
} as const;

const TIMING_KEYS = [
	"dnsLookup",
	"tcpConnect",
	"tlsHandshake",
	"ttfb",
	"transfer",
] as const;
type TimingKey = (typeof TIMING_KEYS)[number];

const TIMING_LABELS: Record<TimingKey, string> = {
	dnsLookup: "DNS",
	tcpConnect: "TCP",
	tlsHandshake: "TLS",
	ttfb: "TTFB",
	transfer: "Transfer",
};

// Generate distinct colors for regions using HSL
const generateRegionColor = (index: number, total: number): string => {
	const hue = (index * 360) / Math.max(total, 1);
	return `hsl(${hue}, 70%, 55%)`;
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

interface ChartDataPoint {
	timestamp: string;
	timeDisplay: string;
	// Averages across selected regions (used in breakdown view)
	avgLatency: number;
	avgDnsLookup: number;
	avgTcpConnect: number;
	avgTlsHandshake: number;
	avgTtfb: number;
	avgTransfer: number;
	// Per-region data — value is number | null so recharts can gap properly
	[key: string]: number | string | null;
}

const ONE_MINUTE_MS = 60_000;

const getMinuteBucketStart = (timestamp: string) => {
	const time = new Date(timestamp).getTime();
	return new Date(Math.floor(time / ONE_MINUTE_MS) * ONE_MINUTE_MS);
};

/**
 * Renders a response time chart for a monitor with multi-region support.
 *
 * Features:
 * - Multi-region selection with persistence
 * - Individual region areas (toggleable via legend), connected across sparse timestamps
 * - Tooltip keeps all visible regions in the hovered point list
 * - HTTP monitors: Toggle between "Total Latency" and "Timing Breakdown" views
 * - Dynamic colors for regions
 */
export function ResponseTimeChart({
	monitorId,
	locations,
	monitorType = "http",
}: ResponseTimeChartProps) {
	const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");

	// Multi-region selection with localStorage persistence
	const [selectedLocations, setSelectedLocations] = useState<string[]>(() => {
		if (typeof window === "undefined")
			return locations.length > 0 ? [locations[0]] : [];
		const saved = localStorage.getItem(`monitor-chart-locations-${monitorId}`);
		if (saved) {
			const parsed = JSON.parse(saved);
			const valid = parsed.filter(
				(loc: string) => loc === "all" || locations.includes(loc),
			);
			if (valid.length > 0) return valid;
		}
		return locations.length > 0 ? [locations[0]] : [];
	});

	// HTTP monitor view mode toggle
	const [viewMode, setViewMode] = useState<"total" | "breakdown">("breakdown");

	// Track visibility of individual regions in legend
	const [visibleRegions, setVisibleRegions] = useState<Record<string, boolean>>(
		{},
	);

	// Track visibility of timing components in breakdown view
	const [visibleTimings, setVisibleTimings] = useState<
		Record<TimingKey, boolean>
	>({
		dnsLookup: true,
		tcpConnect: true,
		tlsHandshake: true,
		ttfb: true,
		transfer: true,
	});

	// Check if this is an HTTP-based monitor with detailed timings
	const hasDetailedTimings = HTTP_MONITOR_TYPES.includes(monitorType);

	// Persist location selection
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(
				`monitor-chart-locations-${monitorId}`,
				JSON.stringify(selectedLocations),
			);
		}
	}, [selectedLocations, monitorId]);

	// Initialize visible regions when locations change
	useEffect(() => {
		const initialVisibility: Record<string, boolean> = {};
		selectedLocations.forEach((loc) => {
			if (loc !== "all") {
				initialVisibility[loc] = true;
			}
		});
		setVisibleRegions(initialVisibility);
	}, [selectedLocations]);

	// Fetch data from API
	const { data: rawData, isLoading } = useQuery({
		...orpc.monitors.getResponseTimes.queryOptions({
			input: {
				monitorId,
				range,
				locations: selectedLocations.includes("all") ? [] : selectedLocations,
			},
		}),
		enabled: selectedLocations.length > 0,
	});

	// Get unique locations from data — derived before chartData so it can be used inside it
	const dataLocations = useMemo(() => {
		if (!rawData) return [];
		return Array.from(new Set(rawData.map((d) => d.location)));
	}, [rawData]);

	// Process and aggregate data for chart.
	//
	// Key fix: timestamps are sorted chronologically and every slot gets an
	// explicit `null` for regions that have no reading at that point.
	// `connectNulls` on each <Area> then bridges those gaps with a continuous
	// line instead of dropping to zero or leaving a hole.
	const chartData = useMemo((): ChartDataPoint[] => {
		if (!rawData || rawData.length === 0) return [];

		// Merge all readings that land in the same minute bucket.
		const grouped = rawData.reduce(
			(acc, item) => {
				const bucketTimestamp = getMinuteBucketStart(
					item.timestamp,
				).toISOString();
				if (!acc[bucketTimestamp]) {
					acc[bucketTimestamp] = { items: [], timestamp: bucketTimestamp };
				}
				acc[bucketTimestamp].items.push(item);
				return acc;
			},
			{} as Record<string, { items: RawDataPoint[]; timestamp: string }>,
		);

		// Sort timestamps chronologically
		const sortedTimestamps = Object.keys(grouped).sort(
			(a, b) => new Date(a).getTime() - new Date(b).getTime(),
		);

		return sortedTimestamps.map((ts) => {
			const items: RawDataPoint[] = grouped[ts].items;
			const timestamp = new Date(ts);

			// If a location reported multiple times within the same minute, average them
			// so each region contributes a single point to that bucket.
			const itemsByLocation = items.reduce((acc, item) => {
				const existing = acc.get(item.location) || [];
				existing.push(item);
				acc.set(item.location, existing);
				return acc;
			}, new Map<string, RawDataPoint[]>());

			const averagedItems = Array.from(itemsByLocation.entries()).map(
				([location, locationItems]) => {
					const average = (values: number[]) =>
						values.reduce((sum, value) => sum + value, 0) / values.length;
					const averageOptional = (
						values: Array<number | undefined>,
					): number | undefined => {
						const definedValues = values.filter(
							(value): value is number => value !== undefined,
						);
						return definedValues.length > 0
							? average(definedValues)
							: undefined;
					};

					return {
						location,
						latency: average(locationItems.map((item) => item.latency)),
						dnsLookup: averageOptional(
							locationItems.map((item) => item.dnsLookup),
						),
						tcpConnect: averageOptional(
							locationItems.map((item) => item.tcpConnect),
						),
						tlsHandshake: averageOptional(
							locationItems.map((item) => item.tlsHandshake),
						),
						ttfb: averageOptional(locationItems.map((item) => item.ttfb)),
						transfer: averageOptional(
							locationItems.map((item) => item.transfer),
						),
					};
				},
			);

			const byLocation = new Map<string, (typeof averagedItems)[number]>();
			averagedItems.forEach((item) => byLocation.set(item.location, item));

			// Averages across regions present at this timestamp (used by breakdown view)
			const avgLatency =
				averagedItems.reduce((sum, i) => sum + i.latency, 0) /
				averagedItems.length;
			const avgDnsLookup =
				averagedItems.reduce((sum, i) => sum + (i.dnsLookup || 0), 0) /
				averagedItems.length;
			const avgTcpConnect =
				averagedItems.reduce((sum, i) => sum + (i.tcpConnect || 0), 0) /
				averagedItems.length;
			const avgTlsHandshake =
				averagedItems.reduce((sum, i) => sum + (i.tlsHandshake || 0), 0) /
				averagedItems.length;
			const avgTtfb =
				averagedItems.reduce((sum, i) => sum + (i.ttfb || 0), 0) /
				averagedItems.length;
			const avgTransfer =
				averagedItems.reduce((sum, i) => sum + (i.transfer || 0), 0) /
				averagedItems.length;

			// Per-region slots: null for any region absent at this timestamp
			const perRegionData: Record<string, number | null> = {};
			dataLocations.forEach((loc) => {
				const item = byLocation.get(loc);
				perRegionData[`${loc}_latency`] = item?.latency ?? null;
				perRegionData[`${loc}_dnsLookup`] = item?.dnsLookup ?? null;
				perRegionData[`${loc}_tcpConnect`] = item?.tcpConnect ?? null;
				perRegionData[`${loc}_tlsHandshake`] = item?.tlsHandshake ?? null;
				perRegionData[`${loc}_ttfb`] = item?.ttfb ?? null;
				perRegionData[`${loc}_transfer`] = item?.transfer ?? null;
			});

			return {
				timestamp: ts,
				timeDisplay:
					range === "24h"
						? format(timestamp, "HH:mm")
						: format(timestamp, "MMM d"),
				avgLatency,
				avgDnsLookup,
				avgTcpConnect,
				avgTlsHandshake,
				avgTtfb,
				avgTransfer,
				...perRegionData,
			};
		});
	}, [rawData, range, dataLocations]);

	// Generate colors for each region
	const regionColors = useMemo(() => {
		const colors: Record<string, string> = {};
		dataLocations.forEach((loc, index) => {
			colors[loc] = generateRegionColor(index, dataLocations.length);
		});
		return colors;
	}, [dataLocations]);

	// Toggle region visibility
	const toggleRegion = (location: string) => {
		setVisibleRegions((prev) => ({
			...prev,
			[location]: !prev[location],
		}));
	};

	// Toggle timing component visibility
	const toggleTiming = (key: TimingKey) => {
		setVisibleTimings((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	// Handle "Select All" regions
	const selectAllRegions = () => {
		setSelectedLocations([...locations]);
	};

	// Handle "Clear" regions
	const clearRegions = () => {
		setSelectedLocations([]);
	};

	// Custom tooltip — keeps the visible series list stable like Grafana's shared tooltip.
	const CustomTooltip = ({ active, payload }: any) => {
		if (!active || !payload?.length) return null;

		const data = payload[0]?.payload as ChartDataPoint;
		if (!data) return null;

		const timestamp = new Date(data.timestamp);
		const timeDisplay = format(timestamp, "MMM d, HH:mm");

		const tooltipRows = dataLocations
			.filter((loc) => visibleRegions[loc] !== false)
			.map((loc) => {
				const latency = data[`${loc}_latency`] as number | null;
				const regionInfo = getRegionInfo(loc);
				return {
					color: regionColors[loc],
					label: regionInfo.label,
					hasValue: latency !== null && latency !== undefined,
					value:
						latency === null || latency === undefined
							? "No data"
							: `${Math.round(latency)} ms`,
				};
			})
			.sort((a, b) => {
				if (a.hasValue === b.hasValue) return a.label.localeCompare(b.label);
				return a.hasValue ? -1 : 1;
			});

		const breakdownRows =
			hasDetailedTimings && viewMode === "breakdown"
				? TIMING_KEYS.filter((key) => visibleTimings[key]).map((key) => ({
						color: TIMING_COLORS[key],
						label: TIMING_LABELS[key],
						value: `${Math.round(
							data[
								`avg${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof ChartDataPoint
							] as number,
						)} ms`,
					}))
				: [];

		return (
			<div className="w-56 rounded-lg border border-border bg-background text-muted-foreground text-sm shadow-lg">
				<div className="border-border border-b px-3 py-2">
					<p className="font-medium text-foreground">{timeDisplay}</p>
				</div>
				<div className="space-y-2 px-3 py-2">
					{tooltipRows.map((row) => (
						<div key={row.label} className="flex space-x-2.5">
							<span
								className="w-1 shrink-0 rounded"
								style={{ backgroundColor: row.color }}
								aria-hidden={true}
							/>
							<p className="flex w-full items-center justify-between space-x-8 truncate">
								<span className="truncate">{row.label}</span>
								<span
									className={
										row.hasValue
											? "font-medium text-foreground"
											: "text-muted-foreground"
									}
								>
									{row.value}
								</span>
							</p>
						</div>
					))}
				</div>
				{breakdownRows.length > 0 && (
					<div className="border-border border-t px-3 py-2">
						<div className="space-y-2">
							{breakdownRows.map((row) => (
								<div key={row.label} className="flex space-x-2.5">
									<span
										className="w-1 shrink-0 rounded"
										style={{ backgroundColor: row.color }}
										aria-hidden={true}
									/>
									<p className="flex w-full items-center justify-between space-x-8 truncate">
										<span className="truncate">{row.label}</span>
										<span className="font-medium text-foreground">
											{row.value}
										</span>
									</p>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		);
	};

	// Check if "all" is selected
	const isAllSelected = selectedLocations.includes("all");

	return (
		<Card className="col-span-4 transition-all hover:shadow-md">
			<CardHeader className="flex flex-row items-center justify-between pb-4">
				<div className="space-y-1">
					<CardTitle className="font-normal text-base">
						{hasDetailedTimings
							? viewMode === "breakdown"
								? "Response Time Breakdown"
								: "Response Time"
							: "Response Time"}
					</CardTitle>
				</div>
				<div className="flex items-center gap-2">
					{/* Region selector */}
					{locations.length > 0 && (
						<Popover>
							<PopoverTrigger
								render={
									<button
										type="button"
										className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs hover:bg-accent"
									>
										<Globe className="h-3.5 w-3.5" />
										<span>
											{isAllSelected
												? "All Regions"
												: selectedLocations.length === 0
													? "Select Regions"
													: selectedLocations.length === 1
														? getRegionInfo(selectedLocations[0]).label
														: `${selectedLocations.length} regions`}
										</span>
										<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
									</button>
								}
							/>
							<PopoverContent className="w-56 p-2" align="end">
								<div className="space-y-2">
									<div className="flex items-center justify-between px-2">
										<span className="font-medium text-xs">Regions</span>
										<div className="flex gap-1">
											<button
												type="button"
												onClick={selectAllRegions}
												className="text-primary text-xs hover:underline"
											>
												All
											</button>
											<span className="text-muted-foreground text-xs">|</span>
											<button
												type="button"
												onClick={clearRegions}
												className="text-primary text-xs hover:underline"
											>
												Clear
											</button>
										</div>
									</div>
									<div className="space-y-1">
										{locations.map((loc) => {
											const regionInfo = getRegionInfo(loc);
											const isSelected = selectedLocations.includes(loc);
											return (
												<div
													key={loc}
													className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
												>
													<Checkbox
														id={`region-${loc}`}
														checked={isSelected}
														onCheckedChange={(checked) => {
															if (checked) {
																setSelectedLocations((prev) =>
																	prev.filter((l) => l !== "all").concat(loc),
																);
															} else {
																setSelectedLocations((prev) =>
																	prev.filter((l) => l !== loc),
																);
															}
														}}
													/>
													<label
														htmlFor={`region-${loc}`}
														className="flex cursor-pointer items-center gap-2"
													>
														<regionInfo.Flag className="h-3.5 w-5 rounded-sm object-cover" />
														<span className="text-sm">{regionInfo.label}</span>
													</label>
												</div>
											);
										})}
									</div>
								</div>
							</PopoverContent>
						</Popover>
					)}

					{/* View mode toggle for HTTP monitors */}
					{hasDetailedTimings && (
						<Tabs
							value={viewMode}
							onValueChange={(v) => setViewMode(v as "total" | "breakdown")}
							className="w-auto"
						>
							<TabsList className="h-8 w-auto bg-muted/50 p-1">
								<TabsTrigger value="total" className="h-6 px-2 text-xs">
									Total
								</TabsTrigger>
								<TabsTrigger value="breakdown" className="h-6 px-2 text-xs">
									Breakdown
								</TabsTrigger>
							</TabsList>
						</Tabs>
					)}

					{/* Time range selector */}
					<Tabs
						value={range}
						onValueChange={(v) => setRange(v as "24h" | "7d" | "30d")}
						className="w-auto"
					>
						<TabsList className="h-8 w-auto bg-muted/50 p-1">
							<TabsTrigger value="24h" className="h-6 px-3 text-xs">
								24h
							</TabsTrigger>
							<TabsTrigger value="7d" className="h-6 px-3 text-xs">
								7d
							</TabsTrigger>
							<TabsTrigger value="30d" className="h-6 px-3 text-xs">
								30d
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</CardHeader>

			<CardContent className="pl-0">
				{/* Legend for regions */}
				{dataLocations.length > 1 && (
					<div className="mb-4 flex flex-wrap items-center justify-center gap-2 px-6">
						{dataLocations.map((loc) => {
							const regionInfo = getRegionInfo(loc);
							const isVisible = visibleRegions[loc] !== false;
							return (
								<button
									key={loc}
									type="button"
									onClick={() => toggleRegion(loc)}
									className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-all ${
										isVisible ? "opacity-100" : "line-through opacity-40"
									} hover:bg-muted/50`}
								>
									<div
										className="h-3 w-3 rounded-sm"
										style={{ backgroundColor: regionColors[loc] }}
									/>
									<span className="text-muted-foreground">
										{regionInfo.label}
									</span>
								</button>
							);
						})}
					</div>
				)}

				{/* Legend for timing components (only in breakdown mode) */}
				{hasDetailedTimings && viewMode === "breakdown" && (
					<div className="mb-4 flex flex-wrap items-center justify-center gap-3 px-6">
						{TIMING_KEYS.map((key) => (
							<button
								key={key}
								type="button"
								onClick={() => toggleTiming(key)}
								className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-all ${
									visibleTimings[key]
										? "opacity-100"
										: "line-through opacity-40"
								} hover:bg-muted/50`}
							>
								<div
									className="h-3 w-3 rounded-sm"
									style={{ backgroundColor: TIMING_COLORS[key] }}
								/>
								<span className="text-muted-foreground">
									{TIMING_LABELS[key]}
								</span>
							</button>
						))}
					</div>
				)}

				{/* Chart */}
				<div className="h-[280px] w-full">
					{isLoading ? (
						<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
							Loading chart...
						</div>
					) : chartData.length === 0 ? (
						<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
							No data available for this period
						</div>
					) : hasDetailedTimings && viewMode === "breakdown" ? (
						// HTTP monitors - breakdown view (stacked area)
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={chartData}>
								<CartesianGrid
									strokeDasharray="3 3"
									vertical={false}
									stroke="#333"
									opacity={0.2}
								/>
								<XAxis
									dataKey="timeDisplay"
									stroke="#666"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									minTickGap={30}
								/>
								<YAxis
									stroke="#666"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									tickFormatter={(value) => `${value}ms`}
								/>
								<Tooltip content={<CustomTooltip />} />

								{visibleTimings.tcpConnect && (
									<Area
										type="monotone"
										dataKey="avgTcpConnect"
										stackId="timing"
										stroke={TIMING_COLORS.tcpConnect}
										strokeWidth={1}
										fillOpacity={0.7}
										fill={TIMING_COLORS.tcpConnect}
										isAnimationActive={false}
										connectNulls
									/>
								)}
								{visibleTimings.tlsHandshake && (
									<Area
										type="monotone"
										dataKey="avgTlsHandshake"
										stackId="timing"
										stroke={TIMING_COLORS.tlsHandshake}
										strokeWidth={1}
										fillOpacity={0.7}
										fill={TIMING_COLORS.tlsHandshake}
										isAnimationActive={false}
										connectNulls
									/>
								)}
								{visibleTimings.ttfb && (
									<Area
										type="monotone"
										dataKey="avgTtfb"
										stackId="timing"
										stroke={TIMING_COLORS.ttfb}
										strokeWidth={1}
										fillOpacity={0.7}
										fill={TIMING_COLORS.ttfb}
										isAnimationActive={false}
										connectNulls
									/>
								)}
								{visibleTimings.transfer && (
									<Area
										type="monotone"
										dataKey="avgTransfer"
										stackId="timing"
										stroke={TIMING_COLORS.transfer}
										strokeWidth={1}
										fillOpacity={0.7}
										fill={TIMING_COLORS.transfer}
										isAnimationActive={false}
										connectNulls
									/>
								)}
							</AreaChart>
						</ResponsiveContainer>
					) : (
						// Total latency view — one area per region, connected across gaps
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={chartData}>
								<CartesianGrid
									strokeDasharray="3 3"
									vertical={false}
									stroke="#333"
									opacity={0.2}
								/>
								<XAxis
									dataKey="timeDisplay"
									stroke="#666"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									minTickGap={30}
								/>
								<YAxis
									stroke="#666"
									fontSize={12}
									tickLine={false}
									axisLine={false}
									tickFormatter={(value) => `${value}ms`}
								/>
								<Tooltip content={<CustomTooltip />} />

								{dataLocations.map(
									(loc) =>
										visibleRegions[loc] !== false && (
											<Area
												key={loc}
												type="monotone"
												dataKey={`${loc}_latency`}
												stroke={regionColors[loc]}
												strokeWidth={1.5}
												fillOpacity={0.1}
												fill={regionColors[loc]}
												dot={false}
												isAnimationActive={false}
												connectNulls
											/>
										),
								)}
							</AreaChart>
						</ResponsiveContainer>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
