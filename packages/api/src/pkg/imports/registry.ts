import type { ImportSource } from "./types";

export class ImportSourceRegistry {
    private sources = new Map<string, ImportSource<any>>();

    register(source: ImportSource<any>) {
        this.sources.set(source.id, source);
    }

    get(id: string) {
        return this.sources.get(id);
    }

    list() {
        return Array.from(this.sources.values());
    }
}

export const importSourceRegistry = new ImportSourceRegistry();
