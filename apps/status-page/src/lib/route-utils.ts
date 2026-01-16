export function buildPath(basePath: string, slug?: string): string {
	if (slug) {
		return `/${slug}${basePath}`;
	}
	return basePath;
}
