"use client";

import { useQuery } from "@tanstack/react-query";
import countries from "world-countries";
import { getRegionInfo } from "@/lib/regions";
import { orpc } from "@/utils/orpc";
import {
	MapMarker,
	MarkerContent,
	MarkerTooltip,
	Map as WorkerRegionMap,
} from "../ui/map";

interface WorkerRecord {
	id: string;
	name: string;
	location: string;
	active: boolean;
	lastHeartbeat: Date | null;
	monitorCount: number;
}

type Coordinates = {
	lat: number;
	lng: number;
};

const LEGACY_REGION_COORDINATES: Record<string, Coordinates> = {
	"na-canada": { lat: 56.1304, lng: -106.3468 },
	"sa-brazil": { lat: -14.235, lng: -51.9253 },
	"eu-general": { lat: 54.526, lng: 15.2551 },
	"ap-hongkong": { lat: 22.3193, lng: 114.1694 },
	"oc-syd": { lat: -33.8688, lng: 151.2093 },
	global: { lat: 20, lng: 0 },
};

const CONTINENT_COORDINATES: Record<string, Coordinates> = {
	Africa: { lat: 1.6508, lng: 17.6791 },
	Asia: { lat: 34.0479, lng: 100.6197 },
	Europe: { lat: 54.526, lng: 15.2551 },
	"North America": { lat: 54.526, lng: -105.2551 },
	Oceania: { lat: -22.7359, lng: 140.0188 },
	"South America": { lat: -8.7832, lng: -55.4915 },
};

const COUNTRY_COORDINATES = new Map<string, Coordinates>(
	countries.map((country) => [
		country.cca2.toLowerCase(),
		{
			lat: country.latlng[0],
			lng: country.latlng[1],
		},
	]),
);

function getCoordinatesForRegion(regionCode: string): Coordinates {
	const normalizedRegionCode = regionCode.toLowerCase();
	const legacyCoordinates = LEGACY_REGION_COORDINATES[normalizedRegionCode];
	if (legacyCoordinates) {
		return legacyCoordinates;
	}

	const countryCoordinates = COUNTRY_COORDINATES.get(normalizedRegionCode);
	if (countryCoordinates) {
		return countryCoordinates;
	}

	const regionInfo = getRegionInfo(normalizedRegionCode);
	if (regionInfo.continent) {
		return (
			CONTINENT_COORDINATES[regionInfo.continent] ||
			LEGACY_REGION_COORDINATES.global
		);
	}

	return LEGACY_REGION_COORDINATES.global;
}

function getMarkerSize(workerCount: number) {
	return Math.min(10 + workerCount * 3, 24);
}

export default function WorkersMap() {
	const { data, isLoading } = useQuery(
		orpc.workers.list.queryOptions({
			input: {
				limit: 500,
				offset: 0,
				status: "all",
			},
		}),
	);

	const workers = (data?.items ?? []) as WorkerRecord[];

	const markers = workers.reduce<
		Array<{
			location: string;
			label: string;
			Flag: ReturnType<typeof getRegionInfo>["Flag"];
			workerCount: number;
			monitorCount: number;
			lat: number;
			lng: number;
		}>
	>((acc, worker) => {
		const existingMarker = acc.find(
			(marker) => marker.location === worker.location,
		);
		if (existingMarker) {
			existingMarker.workerCount += 1;
			existingMarker.monitorCount = Math.max(
				existingMarker.monitorCount,
				worker.monitorCount,
			);
			return acc;
		}

		const regionInfo = getRegionInfo(worker.location);
		const coordinates = getCoordinatesForRegion(worker.location);

		acc.push({
			location: worker.location,
			label: regionInfo.label,
			Flag: regionInfo.Flag,
			workerCount: 1,
			monitorCount: worker.monitorCount,
			lat: coordinates.lat,
			lng: coordinates.lng,
		});

		return acc;
	}, []);

	return (
		<div className="flex h-full w-full">
			<WorkerRegionMap
				center={[10, 20]}
				zoom={1.2}
				loading={isLoading}
				theme="dark"
			>
				{markers.map((marker) => {
					const size = getMarkerSize(marker.workerCount);
					const Flag = marker.Flag;

					return (
						<MapMarker
							key={marker.location}
							longitude={marker.lng}
							latitude={marker.lat}
						>
							<MarkerContent>
								<div className="relative flex items-center justify-center">
									<div
										className="absolute rounded-full bg-emerald-500/20"
										style={{
											width: size * 2.5,
											height: size * 2.5,
										}}
									/>
									<div
										className="absolute animate-ping rounded-full bg-emerald-500/40"
										style={{
											width: size * 1.5,
											height: size * 1.5,
											animationDuration: "2s",
										}}
									/>
									<div
										className="relative rounded-full bg-emerald-500 shadow-emerald-500/50 shadow-lg"
										style={{ width: size, height: size }}
									/>
								</div>
							</MarkerContent>
							<MarkerTooltip>
								<div className="min-w-40 rounded-md bg-zinc-950/95 p-3 text-center text-zinc-50 shadow-xl">
									<div className="flex items-center justify-center gap-2">
										<Flag className="h-4 w-4 overflow-hidden rounded-[2px]" />
										<div className="font-medium">{marker.label}</div>
									</div>
									<div className="text-[10px] text-zinc-400 uppercase">
										{marker.location}
									</div>
									<div className="mt-3 font-semibold text-emerald-400">
										{marker.monitorCount} monitor
										{marker.monitorCount === 1 ? "" : "s"}
									</div>
									<div className="font-medium text-zinc-200">
										{marker.workerCount} worker
										{marker.workerCount === 1 ? "" : "s"}
									</div>
								</div>
							</MarkerTooltip>
						</MapMarker>
					);
				})}
			</WorkerRegionMap>
		</div>
	);
}
