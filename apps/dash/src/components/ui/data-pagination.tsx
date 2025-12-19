import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
} from "@/components/ui/pagination";

interface DataPaginationProps {
	page: number;
	totalPages: number;
	setPage: (page: number) => void;
	className?: string;
}

export function DataPagination({
	page,
	totalPages,
	setPage,
	className,
}: DataPaginationProps) {
	if (totalPages <= 1) return null;

	return (
		<div
			className={`flex items-center justify-end border-t bg-muted/20 px-4 py-3 ${className}`}
		>
			<Pagination className="mx-0 w-auto">
				<PaginationContent>
					<PaginationItem>
						<Button
							variant="ghost"
							size="icon"
							disabled={page === 1}
							onClick={() => setPage(page - 1)}
						>
							<ChevronLeftIcon className="h-4 w-4" />
						</Button>
					</PaginationItem>
					{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
						if (
							totalPages > 7 &&
							(p < page - 2 || p > page + 2) &&
							p !== 1 &&
							p !== totalPages
						) {
							if (p === page - 3 || p === page + 3) {
								return (
									<PaginationItem key={p}>
										<PaginationEllipsis />
									</PaginationItem>
								);
							}
							return null;
						}

						return (
							<PaginationItem key={p}>
								<Button
									variant={p === page ? "outline" : "ghost"}
									size="icon"
									onClick={() => setPage(p)}
									className="h-8 w-8"
								>
									{p}
								</Button>
							</PaginationItem>
						);
					})}
					<PaginationItem>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setPage(page + 1)}
							disabled={page === totalPages}
						>
							<ChevronRightIcon className="h-4 w-4" />
						</Button>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</div>
	);
}
