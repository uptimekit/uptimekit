import { ImportWizard } from "@/components/admin/import/import-wizard";

export default function AdminImportPage() {
    return (
        <div className="mx-auto w-full max-w-4xl space-y-6 py-2">
            <div>
                <h1 className="font-bold text-2xl tracking-tight">
                    Import monitors
                </h1>
                <p className="text-muted-foreground text-sm">
                    Import monitors from another monitoring tool into an
                    organization.
                </p>
            </div>
            <ImportWizard />
        </div>
    );
}
