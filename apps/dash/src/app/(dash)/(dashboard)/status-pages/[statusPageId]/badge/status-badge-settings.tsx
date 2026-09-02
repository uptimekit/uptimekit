"use client";

import { faCopy, faExternalLink } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useQuery } from "@tanstack/react-query";
import { sileo as toast } from "sileo";
import { useStatusPageDomain } from "@/components/providers/status-page-domain-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getStatusPageUrl } from "@/lib/status-page-url";
import { orpc } from "@/utils/orpc";

function escapeHtmlAttribute(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

export function StatusBadgeSettings({
    statusPageId,
}: {
    statusPageId: string;
}) {
    const statusPageDomain = useStatusPageDomain();
    const { data: statusPage, isLoading } = useQuery(
        orpc.statusPages.get.queryOptions({ input: { id: statusPageId } }),
    );

    if (isLoading || !statusPage) {
        return <div className="h-48 animate-pulse rounded-xl bg-muted" />;
    }

    const badgeUrl = `${getStatusPageUrl(statusPage, statusPageDomain)}/badge`;
    const iframeCode = `<iframe src="${escapeHtmlAttribute(badgeUrl)}" title="${escapeHtmlAttribute(statusPage.name)} system status" width="290" height="38" frameborder="0" scrolling="no"></iframe>`;

    const copyEmbedCode = async () => {
        await navigator.clipboard.writeText(iframeCode);
        toast.success({ title: "Embed code copied" });
    };

    return (
        <div className="grid max-w-4xl gap-6">
            <Card>
                <CardContent className="grid gap-6 p-6">
                    <div className="space-y-2">
                        <h2 className="font-semibold text-xl">Status badge</h2>
                        <p className="max-w-2xl text-muted-foreground text-sm">
                            Add a compact live service-status indicator to your
                            website footer, documentation, or help center. It
                            opens your full status page when selected.
                        </p>
                    </div>

                    <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed bg-muted/30 p-6">
                        <iframe
                            src={badgeUrl}
                            title={`${statusPage.name} status badge preview`}
                            width="290"
                            height="38"
                            frameBorder="0"
                            scrolling="no"
                        />
                    </div>

                    <div className="grid gap-2">
                        <label
                            htmlFor="status-badge-embed-code"
                            className="font-medium text-sm"
                        >
                            Embed code
                        </label>
                        <div className="flex gap-2">
                            <textarea
                                id="status-badge-embed-code"
                                readOnly
                                value={iframeCode}
                                className="min-h-20 flex-1 resize-none rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs outline-none"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="self-start"
                                onClick={() => void copyEmbedCode()}
                            >
                                <FontAwesomeIcon icon={faCopy} />
                                Copy
                            </Button>
                        </div>
                        <p className="text-muted-foreground text-xs">
                            The badge refreshes with the same status data as
                            this status page. Public pages can be embedded on
                            any website. Private status pages require visitors
                            to authenticate before the badge can load.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="outline"
                            render={
                                <a
                                    href={badgeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                />
                            }
                        >
                            <FontAwesomeIcon icon={faExternalLink} />
                            Open badge
                        </Button>
                        <Button
                            variant="link"
                            render={
                                <a
                                    href={getStatusPageUrl(
                                        statusPage,
                                        statusPageDomain,
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                />
                            }
                        >
                            View status page
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
