"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
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
	// Averages across selected regions
	avgLatency: number;
	avgDnsLookup: number;
	avgTcpConnect: number;
	avgTlsHandshake: number;
	avgTtfb: number;
	avgTransfer: number;
	// Per-region data (dynamic keys like "us-east-1_latency")
	[key: string]: number | string;
}

/**
 * Renders a response time chart for a monitor with multi-region support.
 *
 * Features:
 * - Multi-region selection with persistence
 * - Average line across all selected regions (bold)
 * - Individual region lines (toggleable via legend)
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
			// Validate that saved locations still exist
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
		queryKey: ["monitor-response-times", monitorId, range, selectedLocations],
		queryFn: async () => {
			const result = await orpc.monitors.getResponseTimes.query({
				input: {
					monitorId,
					range,
					locations: selectedLocations.includes("all") ? [] : selectedLocations,
				},
			});
			return result as RawDataPoint[];
		},
		enabled: selectedLocations.length > 0,
	});

	// Process and aggregate data for chart
	const chartData = useMemo((): ChartDataPoint[] => {
		if (!rawData || rawData.length === 0) return [];

		// Group by timestamp
		const grouped = rawData.reduce(
			(acc, item) => {
				if (!acc[item.timestamp]) {
					acc[item.timestamp] = {
						items: [],
						timestamp: item.timestamp,
					};
				}
				acc[item.timestamp].items.push(item);
				return acc;
			},
			{} as Record<string, { items: RawDataPoint[]; timestamp: string }>,
		);

		// Process each timestamp group
		return Object.values(grouped).map((group: any) => {
			const items: RawDataPoint[] = group.items;
			const timestamp = new Date(group.timestamp);

			// Calculate averages across all regions at this timestamp
			const avgLatency =
				items.reduce((sum, i) => sum + i.latency, 0) / items.length;
			const avgDnsLookup =
				items.reduce((sum, i) => sum + (i.dnsLookup || 0), 0) / items.length;
			const avgTcpConnect =
				items.reduce((sum, i) => sum + (i.tcpConnect || 0), 0) / items.length;
			const avgTlsHandshake =
				items.reduce((sum, i) => sum + (i.tlsHandshake || 0), 0) / items.length;
			const avgTtfb =
				items.reduce((sum, i) => sum + (i.ttfb || 0), 0) / items.length;
			const avgTransfer =
				items.reduce((sum, i) => sum + (i.transfer || 0), 0) / items.length;

			// Create per-region data points
			const perRegionData: Record<string, number> = {};
			items.forEach((item) => {
				perRegionData[`${item.location}_latency`] = item.latency;
				if (item.dnsLookup !== undefined) {
					perRegionData[`${item.location}_dnsLookup`] = item.dnsLookup;
					perRegionData[`${item.location}_tcpConnect`] = item.tcpConnect || 0;
					perRegionData[`${item.location}_tlsHandshake`] =
						item.tlsHandshake || 0;
					perRegionData[`${item.location}_ttfb`] = item.ttfb || 0;
					perRegionData[`${item.location}_transfer`] = item.transfer || 0;
				}
			});

			return {
				timestamp: group.timestamp,
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
	}, [rawData, range]);

	// Get unique locations from data
	const dataLocations = useMemo(() => {
		if (!rawData) return [];
		return Array.from(new Set(rawData.map((d) => d.location)));
	}, [rawData]);

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

	// Custom tooltip
	const CustomTooltip = ({ active, payload, label }: any) => {
		if (!active || !payload?.length) return null;

		const data = payload[0]?.payload as ChartDataPoint;
		if (!data) return null;

		return (
			<div className="rounded-lg border border-border/50 bg-background/95 p-3 shadow-lg backdrop-blur-sm">
				<p className="mb-2 text-muted-foreground text-xs">{label}</p>

				{/* Show average */}
				<div className="mb-2 flex items-center justify-between gap-4 font-medium">
					<span className="text-xs">Average</span>
					<span className="font-mono text-xs">
						{Math.round(data.avgLatency)}ms
					</span>
				</div>

				{/* Show individual regions if multiple selected */}
				{dataLocations.length > 1 && (
					<div className="space-y-1 border-border/50 border-t pt-2">
						{dataLocations
							.filter((loc) => visibleRegions[loc])
							.map((loc) => {
								const latency = data[`${loc}_latency`];
								if (latency === undefined) return null;
								const regionInfo = getRegionInfo(loc);
								return (
									<div
										key={loc}
										className="flex items-center justify-between gap-4"
									>
										<div className="flex items-center gap-2">
											<div
												className="h-2 w-2 rounded-full"
												style={{ backgroundColor: regionColors[loc] }}
											/>
											<span className="text-xs">{regionInfo.label}</span>
										</div>
										<span className="font-mono text-xs">
											{Math.round(latency)}ms
										</span>
									</div>
								);
							})}
					</div>
				)}

				{/* Show timing breakdown if in breakdown mode */}
				{hasDetailedTimings && viewMode === "breakdown" && (
					<div className="mt-2 space-y-1 border-border/50 border-t pt-2">
						{TIMING_KEYS.filter((key) => visibleTimings[key]).map((key) => (
							<div
								key={key}
								className="flex items-center justify-between gap-4"
							>
								<div className="flex items-center gap-2">
									<div
										className="h-2 w-2 rounded-full"
										style={{ backgroundColor: TIMING_COLORS[key] }}
									/>
									<span className="text-xs">{TIMING_LABELS[key]}</span>
								</div>
								<span className="font-mono text-xs">
									{Math.round(
										data[
											`avg${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof ChartDataPoint
										] as number,
									)}
									ms
								</span>
							</div>
						))}
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
							<PopoverTrigger asChild>
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
							</PopoverTrigger>
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
						{/* Average line toggle (always visible) */}
						<button
							type="button"
							className="flex items-center gap-2 rounded-md px-2 py-1 font-medium text-xs"
						>
							<div className="h-3 w-3 rounded-sm bg-foreground" />
							<span>Average</span>
						</button>

						{/* Individual region toggles */}
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

								{/* Stacked timing areas (average across regions) */}
								{visibleTimings.dnsLookup && (
									<Area
										type="monotone"
										dataKey="avgDnsLookup"
										stackId="timing"
										stroke={TIMING_COLORS.dnsLookup}
										strokeWidth={1}
										fillOpacity={0.7}
										fill={TIMING_COLORS.dnsLookup}
										isAnimationActive={false}
									/>
								)}
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
									/>
								)}
							</AreaChart>
						</ResponsiveContainer>
					) : (
						// Total latency view (line chart with average + individual regions)
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

								{/* Individual region lines */}
								{dataLocations.length > 1 &&
									dataLocations.map(
										(loc) =>
											visibleRegions[loc] && (
												<Line
													key={loc}
													type="monotone"
													dataKey={`${loc}_latency`}
													stroke={regionColors[loc]}
													strokeWidth={1}
													strokeDasharray="4 4"
													dot={false}
													isAnimationActive={false}
												/>
											),
									)}

								{/* Average line (bold, on top) */}
								<Area
									type="monotone"
									dataKey="avgLatency"
									stroke="#fff"
									strokeWidth={2}
									fillOpacity={0.1}
									fill="#fff"
									isAnimationActive={false}
								/>
							</AreaChart>
						</ResponsiveContainer>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
