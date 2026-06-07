"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";

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

const STATUS_CODE_COLORS = [
	"#10b981",
	"#38bdf8",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#14b8a6",
	"#64748b",
	"#f97316",
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]["value"];

interface StatusCodePieChartProps {
	monitorId: string;
}

interface StatusCodeChartPoint {
	statusCode: number;
	label: string;
	count: number;
	percentage: number;
	fill: string;
}

interface StatusCodeTooltipProps {
	active?: boolean;
	payload?: Array<{ payload?: StatusCodeChartPoint }>;
	total: number;
}

function formatPercentage(value: number) {
	if (value >= 10) {
		return `${value.toFixed(0)}%`;
	}

	return `${value.toFixed(1)}%`;
}

function formatCheckCount(count: number) {
	return `${count.toLocaleString()} ${count === 1 ? "check" : "checks"}`;
}

function StatusCodeTooltip({ active, payload, total }: StatusCodeTooltipProps) {
	const point = payload?.[0]?.payload;

	if (!active || !point) {
		return null;
	}

	return (
		<div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-xl">
			<div className="font-medium font-mono">{point.label}</div>
			<div className="text-muted-foreground">
				{formatCheckCount(point.count)} of {formatCheckCount(total)}
			</div>
		</div>
	);
}

export function StatusCodePieChart({ monitorId }: StatusCodePieChartProps) {
	const [range, setRange] = useState<RangeKey>("24h");

	const { data = [], isLoading } = useQuery(
		orpc.monitors.getStatusCodeDistribution.queryOptions({
			input: { monitorId, range },
		}),
	);

	const total = useMemo(
		() => data.reduce((sum, point) => sum + point.count, 0),
		[data],
	);

	const chartData = useMemo(
		() =>
			data.map((point, index) => ({
				statusCode: point.statusCode,
				label: String(point.statusCode),
				count: point.count,
				percentage: total > 0 ? (point.count / total) * 100 : 0,
				fill: STATUS_CODE_COLORS[index % STATUS_CODE_COLORS.length],
			})),
		[data, total],
	);

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
				<CardTitle className="font-normal text-base">
					HTTP status codes
				</CardTitle>
				<Select
					aria-label="Select status code range"
					value={range}
					onValueChange={(value) => setRange(value as RangeKey)}
				>
					<SelectTrigger className="h-8 w-[150px] bg-background/60">
						<SelectValue>
							{RANGE_OPTIONS.find((option) => option.value === range)?.label}
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
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="flex h-56 items-center justify-center text-muted-foreground text-sm">
						Loading status codes...
					</div>
				) : chartData.length === 0 ? (
					<div className="flex h-56 items-center justify-center text-muted-foreground text-sm">
						No status code data for this range
					</div>
				) : (
					<div className="grid gap-6 md:grid-cols-[minmax(220px,1fr)_minmax(180px,240px)] md:items-center">
						<div className="h-56 min-w-0">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
									<Pie
										data={chartData}
										dataKey="count"
										nameKey="label"
										cx="50%"
										cy="50%"
										innerRadius={58}
										outerRadius={92}
										paddingAngle={2}
										stroke="transparent"
									>
										{chartData.map((point) => (
											<Cell
												key={point.statusCode}
												fill={point.fill}
												stroke="transparent"
											/>
										))}
									</Pie>
									<Tooltip
										content={<StatusCodeTooltip total={total} />}
										cursor={false}
									/>
								</PieChart>
							</ResponsiveContainer>
						</div>
						<div className="space-y-3">
							<div className="text-muted-foreground text-sm">
								{formatCheckCount(total)}
							</div>
							<ul className="space-y-2">
								{chartData.map((point) => (
									<li
										key={point.statusCode}
										className="flex items-center justify-between gap-3 text-sm"
									>
										<span className="flex min-w-0 items-center gap-2">
											<span
												className="h-2.5 w-2.5 shrink-0 rounded-sm"
												style={{ backgroundColor: point.fill }}
											/>
											<span className="truncate font-mono">{point.label}</span>
										</span>
										<span className="shrink-0 text-muted-foreground">
											{point.count.toLocaleString()} (
											{formatPercentage(point.percentage)})
										</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
