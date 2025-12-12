"use client";

import { useState } from "react";
import {
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
	CartesianGrid,
	Area,
	AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

interface ResponseTimeChartProps {
	monitorId: string;
	locations: string[];
}

export function ResponseTimeChart({
	monitorId,
	locations,
}: ResponseTimeChartProps) {
	const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
	const [location, setLocation] = useState<string>("all");

	const { data, isLoading } = useQuery(
		orpc.monitors.getResponseTimes.queryOptions({
			input: { monitorId, range, location },
		}),
	);

	const formattedData =
		data?.map((item) => ({
			...item,
			// Format timestamp for display based on range
			timeDisplay:
				range === "24h"
					? format(new Date(item.timestamp), "HH:mm")
					: format(new Date(item.timestamp), "MMM d"),
		})) || [];

	return (
		<Card className="col-span-4 transition-all hover:shadow-md">
			<CardHeader className="flex flex-row items-center justify-between pb-8">
				<div className="space-y-1">
					<CardTitle className="text-base font-normal">Response time</CardTitle>
				</div>
				<div className="flex items-center gap-2">
					{locations.length > 0 && (
						<Select value={location} onValueChange={setLocation}>
							<SelectTrigger className="h-8 w-[130px] text-xs">
								<SelectValue placeholder="All regions" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All regions</SelectItem>
								{locations.map((loc) => (
									<SelectItem key={loc} value={loc}>
										{loc}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					<Tabs
						value={range}
						onValueChange={(v) => setRange(v as any)}
						className="w-auto"
					>
						<TabsList className="h-8 w-auto p-1 bg-muted/50">
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
				<div className="h-[300px] w-full">
					{isLoading ? (
						<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
							Loading chart...
						</div>
					) : formattedData.length === 0 ? (
						<div className="flex h-full items-center justify-center text-muted-foreground text-sm">
							No data available for this period
						</div>
					) : (
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={formattedData}>
								<defs>
									<linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#ffffff" stopOpacity={0.3} />
										<stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
									</linearGradient>
								</defs>
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
								<Tooltip
									contentStyle={{
										backgroundColor: "#1f1f1f",
										border: "none",
										borderRadius: "8px",
									}}
									itemStyle={{ color: "#fff" }}
									labelStyle={{ color: "#aaa", marginBottom: "4px" }}
									formatter={(value: number) => [`${value} ms`, "Latency"]}
								/>
								<Area
									type="monotone"
									dataKey="latency"
									stroke="#ffffff"
									strokeWidth={2}
									fillOpacity={1}
									fill="url(#colorLatency)"
								/>
							</AreaChart>
						</ResponsiveContainer>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
