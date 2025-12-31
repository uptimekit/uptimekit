"use client";

import { AQ, AU, BR, CA, EU, HK, type FlagComponent } from "country-flag-icons/react/3x2";
import { Globe } from "lucide-react";

export interface RegionInfo {
	value: string;
	label: string;
	Flag: FlagComponent | typeof Globe;
}

// Complete mapping of region codes to display info
export const REGION_MAPPING: Record<string, RegionInfo> = {
	// Worker regions (used in create-worker-dialog)
	"na-canada": {
		value: "na-canada",
		label: "North America",
		Flag: CA,
	},
	"sa-brazil": {
		value: "sa-brazil",
		label: "South America",
		Flag: BR,
	},
	"eu-general": {
		value: "eu-general",
		label: "Europe",
		Flag: EU,
	},
	"ap-hongkong": {
		value: "ap-hongkong",
		label: "Asia/Pacific",
		Flag: HK,
	},
	global: {
		value: "global",
		label: "Global",
		Flag: AQ,
	},
	// Additional regions (for backwards compatibility)
	"oc-syd": {
		value: "oc-syd",
		label: "Oceania",
		Flag: AU,
	},
};

// List of all regions for worker creation
export const WORKER_REGIONS: RegionInfo[] = [
	{ value: "na-canada", label: "North America", Flag: CA },
	{ value: "sa-brazil", label: "South America", Flag: BR },
	{ value: "eu-general", label: "Europe", Flag: EU },
	{ value: "ap-hongkong", label: "Asia/Pacific", Flag: HK },
	{ value: "global", label: "Global", Flag: AQ },
];

// Helper function to get region info with fallback
export function getRegionInfo(regionCode: string): RegionInfo {
	return REGION_MAPPING[regionCode] || {
		value: regionCode,
		label: regionCode,
		Flag: Globe,
	};
}
