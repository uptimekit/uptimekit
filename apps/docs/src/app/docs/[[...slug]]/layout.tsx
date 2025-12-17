import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import type { ReactNode } from "react";
import { DocsSwitcher } from "@/components/docs-switcher";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default async function Layout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ slug?: string[] }>;
}) {
	const { slug } = await params;
	const root = slug?.[0];

	let tree = source.pageTree;
	const isSdk = slug?.[0] === "sdk";
	const isApi = slug?.[0] === "api";

	const isSdkNode = (node: (typeof source.pageTree.children)[number]) => {
		if (node.type !== "folder") return false;
		if (node.index?.url === "/docs/sdk") return true;
		if (typeof node.name === "string" && node.name.toLowerCase() === "sdk")
			return true;
		return false;
	};

	const isApiNode = (node: (typeof source.pageTree.children)[number]) => {
		if (node.type !== "folder") return false;
		if (node.index?.url === "/docs/api") return true;
		if (
			typeof node.name === "string" &&
			(node.name.toLowerCase() === "api" ||
				node.name.toLowerCase() === "api reference")
		)
			return true;
		return false;
	};

	if (isSdk) {
		const sdkNode = source.pageTree.children.find(isSdkNode);
		if (sdkNode && sdkNode.type === "folder") {
			tree = {
				name: sdkNode.name,
				children: sdkNode.index
					? [sdkNode.index, ...sdkNode.children]
					: sdkNode.children,
			};
		}
	} else if (isApi) {
		const apiNode = source.pageTree.children.find(isApiNode);
		if (apiNode && apiNode.type === "folder") {
			tree = {
				name: apiNode.name,
				children: apiNode.index
					? [apiNode.index, ...apiNode.children]
					: apiNode.children,
			};
		}
	} else {
		tree = {
			...source.pageTree,
			children: source.pageTree.children.filter(
				(node) => !isSdkNode(node) && !isApiNode(node),
			),
		};
	}

	return (
		<DocsLayout
			tree={tree}
			{...baseOptions()}
			sidebar={{
				banner: <DocsSwitcher />,
				collapsible: true,
			}}
		>
			{children}
		</DocsLayout>
	);
}
