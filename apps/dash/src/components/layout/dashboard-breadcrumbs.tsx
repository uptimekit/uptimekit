"use client"

import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import React from "react"

export function DashboardBreadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter((segment) => segment !== "")

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.length === 0 ? (
             <BreadcrumbItem>
                <BreadcrumbPage>Incidents</BreadcrumbPage>
             </BreadcrumbItem>
        ) : (
            <>
                {segments.map((segment, index) => {
                    const href = `/${segments.slice(0, index + 1).join("/")}`
                    const isLast = index === segments.length - 1
                    
                    const title = segment
                        .split("-")
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(" ")

                    return (
                        <React.Fragment key={href}>
                             {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                             <BreadcrumbItem>
                                {isLast ? (
                                    <BreadcrumbPage>{title}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink href={href}>{title}</BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </React.Fragment>
                    )
                })}
            </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
