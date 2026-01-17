/** @type {import('sponsorkit').SponsorkitConfig} */
export default {
	login: "stripsior",
	outputDir: ".github/sponsors",
	formats: ["svg", "png"],

	tiers: [
		{
			title: "Gold Sponsors",
			monthlyDollars: 100,
			preset: {
				avatar: { size: 80 },
				boxWidth: 100,
				boxHeight: 100,
				container: { sidePadding: 30 },
			},
		},
		{
			title: "Silver Sponsors",
			monthlyDollars: 50,
			preset: {
				avatar: { size: 60 },
				boxWidth: 80,
				boxHeight: 80,
				container: { sidePadding: 25 },
			},
		},
		{
			title: "Bronze Sponsors",
			monthlyDollars: 10,
			preset: {
				avatar: { size: 45 },
				boxWidth: 60,
				boxHeight: 60,
				container: { sidePadding: 20 },
			},
		},
		{
			title: "Supporters",
			monthlyDollars: -1,
			preset: {
				avatar: { size: 35 },
				boxWidth: 50,
				boxHeight: 50,
				container: { sidePadding: 15 },
			},
		},
	],

	renders: [
		{
			name: "sponsors",
			width: 800,
			renderer: "circles",
		},
	],
};
