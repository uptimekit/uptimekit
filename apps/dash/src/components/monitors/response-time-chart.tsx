"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
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

// Muted color palette for dark theme - harmonious gradient
const TIMING_COLORS = {
	dnsLookup: "#6366f1", // indigo - network lookup
	tcpConnect: "#8b5cf6", // violet - connection
	tlsHandshake: "#a855f7", // purple - security
	ttfb: "#22d3ee", // cyan - server response
	transfer: "#34d399", // emerald - data transfer
	latency: "#22d3ee", // cyan - simple latency for non-HTTP
};

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

/**
 * Renders a response time chart for a monitor, showing either a stacked breakdown of HTTP timing components or a single latency series.
 *
 * The chart supports selecting a time range (24h, 7d, 30d) and a region from the provided locations. For HTTP-based monitors, individual timing series (DNS lookup, TCP connect, TLS handshake, TTFB, transfer) can be toggled via the interactive legend.
 *
 * @param monitorId - The ID of the monitor to fetch response time data for
 * @param locations - Available region/location identifiers; the component defaults selection to the first entry (or empty string when none)
 * @param monitorType - Monitor type; when set to an HTTP-based type the chart shows detailed timing breakdowns. Defaults to `"http"`.
 * @returns A React element containing the response time chart and its controls
 */
export function ResponseTimeChart({
	monitorId,
	locations,
	monitorType = "http",
}: ResponseTimeChartProps) {
	const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
	// Default to first location, no "all" option
	const [location, setLocation] = useState<string>(locations[0] || "");
	// Track which timing series are visible (all enabled by default)
	const [visibleSeries, setVisibleSeries] = useState<
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

	// Update location when locations prop changes
	useEffect(() => {
		if (locations.length > 0 && !locations.includes(location)) {
			setLocation(locations[0]);
		}
	}, [locations, location]);

	const { data, isLoading } = useQuery(
		orpc.monitors.getResponseTimes.queryOptions({
			input: { monitorId, range, location: location || locations[0] || "all" },
		}),
	);

	const formattedData =
		data?.map((item) => ({
			...item,
			timeDisplay:
				range === "24h"
					? format(new Date(item.timestamp), "HH:mm")
					: format(new Date(item.timestamp), "MMM d"),
			dnsLookup: item.dnsLookup ?? 0,
			tcpConnect: item.tcpConnect ?? 0,
			tlsHandshake: item.tlsHandshake ?? 0,
			ttfb: item.ttfb ?? 0,
			transfer: item.transfer ?? 0,
			// For non-HTTP monitors, use latency directly from API
			latency: item.latency ?? 0,
		})) || [];

	// Toggle series visibility when clicking legend
	const toggleSeries = (key: TimingKey) => {
		setVisibleSeries((prev) => ({
			...prev,
			[key]: !prev[key],
		}));
	};

	// Custom tooltip for HTTP monitors
	const HttpTooltip = ({ active, payload, label }: any) => {
		if (!active || !payload || !payload.length) return null;

		const data = payload[0]?.payload;
		if (!data) return null;

		const total = TIMING_KEYS.reduce((sum, key) => sum + (data[key] || 0), 0);

		return (
			<div className="rounded-lg border border-border/50 bg-background/95 p-3 shadow-lg backdrop-blur-sm">
				<p className="mb-2 text-muted-foreground text-xs">{label}</p>
				<div className="space-y-1">
					{TIMING_KEYS.filter((key) => visibleSeries[key] && data[key] > 0).map(
						(key) => (
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
								<span className="font-mono text-xs">{data[key]}ms</span>
							</div>
						),
					)}
					<div className="mt-2 border-border/50 border-t pt-2">
						<div className="flex items-center justify-between font-medium">
							<span className="text-xs">Total</span>
							<span className="font-mono text-xs">{total}ms</span>
						</div>
					</div>
				</div>
			</div>
		);
	};

	// Simple tooltip for non-HTTP monitors
	const SimpleTooltip = ({ active, payload, label }: any) => {
		if (!active || !payload || !payload.length) return null;

		const data = payload[0]?.payload;
		if (!data) return null;

		return (
			<div className="rounded-lg border border-border/50 bg-background/95 p-3 shadow-lg backdrop-blur-sm">
				<p className="mb-2 text-muted-foreground text-xs">{label}</p>
				<div className="flex items-center justify-between gap-4">
					<span className="text-xs">Latency</span>
					<span className="font-mono text-xs">{data.latency}ms</span>
				</div>
			</div>
		);
	};

	return (
		<Card className="col-span-4 transition-all hover:shadow-md">
			<CardHeader className="flex flex-row items-center justify-between pb-4">
				<div className="space-y-1">
					<CardTitle className="font-normal text-base">
						{hasDetailedTimings ? "Response Time Breakdown" : "Response Time"}
					</CardTitle>
				</div>
				<div className="flex items-center gap-2">
					{locations.length > 0 &&
						(() => {
							const selectedRegion = getRegionInfo(location);
							const SelectedFlag = selectedRegion.Flag;
							return (
								<Select value={location} onValueChange={setLocation}>
									<SelectTrigger className="h-8 w-[160px] text-xs">
										<div className="flex items-center gap-2">
											<SelectedFlag className="h-3.5 w-5 shrink-0 rounded-sm object-cover" />
											<span className="truncate">{selectedRegion.label}</span>
										</div>
									</SelectTrigger>
									<SelectContent>
										{locations.map((loc) => {
											const regionInfo = getRegionInfo(loc);
											const Flag = regionInfo.Flag;
											return (
												<SelectItem key={loc} value={loc}>
													<div className="flex items-center gap-2">
														<Flag className="h-3.5 w-5 rounded-sm object-cover" />
														<span>{regionInfo.label}</span>
													</div>
												</SelectItem>
											);
										})}
									</SelectContent>
								</Select>
							);
						})()}
					<Tabs
						value={range}
						onValueChange={(v) => setRange(v as any)}
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
				{/* Interactive legend - only for HTTP monitors */}
				{hasDetailedTimings && (
					<div className="mb-4 flex flex-wrap items-center justify-center gap-3 px-6">
						{TIMING_KEYS.map((key) => (
							<button
								key={key}
								type="button"
								onClick={() => toggleSeries(key)}
								className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-all ${
									visibleSeries[key] ? "opacity-100" : "line-through opacity-40"
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

				<div className="h-[280px] w-full">
					{isLoading ? (
						<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
							Loading chart...
						</div>
					) : formattedData.length === 0 ? (
						<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
							No data available for this period
						</div>
					) : hasDetailedTimings ? (
						// HTTP monitors - stacked area chart
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={formattedData}>
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
								<Tooltip content={<HttpTooltip />} />

								{/* Stacked timing areas */}
								<Area
									type="monotone"
									dataKey="dnsLookup"
									stackId="timing"
									stroke={TIMING_COLORS.dnsLookup}
									strokeWidth={1}
									fillOpacity={0.7}
									fill={TIMING_COLORS.dnsLookup}
									hide={!visibleSeries.dnsLookup}
									isAnimationActive={false}
								/>
								<Area
									type="monotone"
									dataKey="tcpConnect"
									stackId="timing"
									stroke={TIMING_COLORS.tcpConnect}
									strokeWidth={1}
									fillOpacity={0.7}
									fill={TIMING_COLORS.tcpConnect}
									hide={!visibleSeries.tcpConnect}
									isAnimationActive={false}
								/>
								<Area
									type="monotone"
									dataKey="tlsHandshake"
									stackId="timing"
									stroke={TIMING_COLORS.tlsHandshake}
									strokeWidth={1}
									fillOpacity={0.7}
									fill={TIMING_COLORS.tlsHandshake}
									hide={!visibleSeries.tlsHandshake}
									isAnimationActive={false}
								/>
								<Area
									type="monotone"
									dataKey="ttfb"
									stackId="timing"
									stroke={TIMING_COLORS.ttfb}
									strokeWidth={1}
									fillOpacity={0.7}
									fill={TIMING_COLORS.ttfb}
									hide={!visibleSeries.ttfb}
									isAnimationActive={false}
								/>
								<Area
									type="monotone"
									dataKey="transfer"
									stackId="timing"
									stroke={TIMING_COLORS.transfer}
									strokeWidth={1}
									fillOpacity={0.7}
									fill={TIMING_COLORS.transfer}
									hide={!visibleSeries.transfer}
									isAnimationActive={false}
								/>
							</AreaChart>
						</ResponsiveContainer>
					) : (
						// Non-HTTP monitors - simple latency chart
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={formattedData}>
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
								<Tooltip content={<SimpleTooltip />} />
								<Area
									type="monotone"
									dataKey="latency"
									stroke={TIMING_COLORS.latency}
									strokeWidth={2}
									fillOpacity={0.3}
									fill={TIMING_COLORS.latency}
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