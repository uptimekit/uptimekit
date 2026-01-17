import { defineConfig, tierPresets } from "sponsorkit";

export default defineConfig({
	login: "stripsior",
	outputDir: ".github/sponsors",
	formats: ["svg", "png"],

	tiers: [
		{
			title: "Gold Sponsors",
			monthlyDollars: 100,
			preset: tierPresets.xl,
		},
		{
			title: "Silver Sponsors",
			monthlyDollars: 50,
			preset: tierPresets.large,
		},
		{
			title: "Bronze Sponsors",
			monthlyDollars: 10,
			preset: tierPresets.medium,
		},
		{
			title: "Supporters",
			monthlyDollars: -1,
			preset: tierPresets.small,
		},
	],

	renders: [
		{
			name: "sponsors",
			width: 800,
			renderer: "circles",
		},
	],
});
