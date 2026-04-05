"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface LatencySparklineProps {
	data: number[];
}

/**
 * Render a compact sparkline area chart for a sequence of latency samples.
 *
 * The component returns null when `data` is undefined or empty. When rendering,
 * the input values are plotted in order and an initial point at zero is prepended
 * to anchor the sparkline to the baseline.
 *
 * @param data - Ordered latency samples (numbers). If empty or undefined, nothing is rendered.
 * @returns A JSX element containing the sparkline area chart, or `null` when `data` is empty.
 */
export function LatencySparkline({ data }: LatencySparklineProps) {
	const gradientId = useId();

	if (!data || data.length === 0) {
		return null;
	}

	// Prepend 0 for smooth transition from zero
	const chartData = [
		{ value: 0, index: 0 },
		...data.map((value, index) => ({
			value,
			index: index + 1,
		})),
	];

	return (
		<div className="absolute inset-0 overflow-hidden">
			<ResponsiveContainer width="100%" height="100%">
				<AreaChart
					data={chartData}
					margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
				>
					<defs>
						<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
							<stop
								offset="0%"
								stopColor="rgb(156, 163, 175)"
								stopOpacity={0.3}
							/>
							<stop
								offset="100%"
								stopColor="rgb(156, 163, 175)"
								stopOpacity={0.05}
							/>
						</linearGradient>
					</defs>
					<Area
						type="monotone"
						dataKey="value"
						stroke="rgb(156, 163, 175)"
						strokeWidth={1.5}
						fill={`url(#${gradientId})`}
						isAnimationActive={false}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
