import { StructureEditor } from "./structure-editor";

interface PageProps {
	params: {
		statusPageId: string;
	};
}

export default async function StructurePage({ params }: PageProps) {
	const { statusPageId } = await params;
	return <StructureEditor statusPageId={statusPageId} />;
}
