"use client";
import { useEffect } from "react";
import { StatusPagesTable } from "@/components/status-pages/table";

export default function StatusPagesPage() {
    useEffect(() => {
        console.log("spit it out!!");
        console.log(process.env.NEXT_PUBLIC_STATUS_PAGE_DOMAIN);
    });
    return (
        <div className="flex flex-1 flex-col pb-8">
            <StatusPagesTable />
        </div>
    );
}
