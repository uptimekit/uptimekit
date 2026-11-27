"use client";

import {
    uppiesAccentSwatches,
    uppiesAnnouncementColors,
    uppiesCorners,
    uppiesFonts,
    uppiesSurfaces,
} from "@uptimekit/config/status-page-themes";
import { Card, CardContent } from "@/components/ui/card";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectItem,
    SelectPopup,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SettingsFormApi } from "./settings-form";

type LookChoiceName =
    | "uppies.surface"
    | "uppies.corners"
    | "uppies.font"
    | "uppies.announcementColor";

function LookSelect({
    form,
    name,
    label,
    choices,
}: {
    form: SettingsFormApi;
    name: LookChoiceName;
    label: string;
    choices: readonly string[];
}) {
    const items = choices.map((value) => ({ value, label: value }));

    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <Select
                        aria-label={label}
                        onValueChange={field.onChange}
                        value={field.value}
                        items={items}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectPopup>
                            {items.map(({ label, value }) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectPopup>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function AccentHueField({ form }: { form: SettingsFormApi }) {
    return (
        <FormField
            control={form.control}
            name="uppies.accentHue"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Accent hue</FormLabel>
                    <div className="flex flex-wrap items-center gap-2">
                        {uppiesAccentSwatches.map((hue) => (
                            <button
                                key={hue}
                                type="button"
                                aria-label={`Hue ${hue}`}
                                aria-pressed={field.value === hue}
                                onClick={() => field.onChange(hue)}
                                className={cn(
                                    "size-7 rounded-full border-2 border-transparent transition-transform hover:scale-110",
                                    field.value === hue &&
                                        "border-foreground ring-2 ring-background ring-inset",
                                )}
                                style={{
                                    background: `oklch(0.6 0.12 ${hue})`,
                                }}
                            />
                        ))}
                        <FormControl>
                            <Input
                                type="number"
                                min={0}
                                max={360}
                                className="w-24"
                                aria-label="Custom hue"
                                value={field.value}
                                onChange={(event) =>
                                    field.onChange(Number(event.target.value))
                                }
                            />
                        </FormControl>
                    </div>
                    <FormDescription>
                        Links, the brand name and focus rings. Any hue from 0 to
                        360 keeps its contrast in light and dark.
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

export function UppiesLookSection({ form }: { form: SettingsFormApi }) {
    return (
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-3">
            <div className="space-y-2">
                <h2 className="font-semibold text-lg leading-none tracking-tight">
                    Uppies look
                </h2>
                <p className="text-muted-foreground text-sm">
                    The look options of the Uppies theme, ported from{" "}
                    <a
                        href="https://github.com/schmayterling/uppies"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                    >
                        uppies
                    </a>{" "}
                    by ryana may que.
                </p>
            </div>
            <Card className="md:col-span-2">
                <CardContent className="grid gap-6 p-6">
                    <AccentHueField form={form} />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <LookSelect
                            form={form}
                            name="uppies.surface"
                            label="Background"
                            choices={uppiesSurfaces}
                        />
                        <LookSelect
                            form={form}
                            name="uppies.corners"
                            label="Corners"
                            choices={uppiesCorners}
                        />
                        <LookSelect
                            form={form}
                            name="uppies.font"
                            label="Typeface"
                            choices={uppiesFonts}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="uppies.showStatusIcon"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg bg-muted/50 p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">
                                        Status icon
                                    </FormLabel>
                                    <FormDescription>
                                        The round icon next to the status
                                        sentence.
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="uppies.tagline"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tagline</FormLabel>
                                <FormControl>
                                    <Input
                                        maxLength={200}
                                        placeholder="the status of everything we run"
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    A line under the status banner.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="uppies.navLinks"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Top bar links</FormLabel>
                                <FormControl>
                                    <Textarea
                                        rows={3}
                                        maxLength={2000}
                                        spellCheck={false}
                                        placeholder="docs | https://docs.example.com"
                                        className="font-mono text-xs"
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    One per line, written as: label |
                                    https://example.com. Up to 6.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="md:col-span-2">
                            <FormField
                                control={form.control}
                                name="uppies.announcement"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Announcement</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                rows={2}
                                                maxLength={1000}
                                                placeholder="A plain text notice at the top of the page"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <LookSelect
                            form={form}
                            name="uppies.announcementColor"
                            label="Announcement color"
                            choices={uppiesAnnouncementColors}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="uppies.footerText"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Footer text</FormLabel>
                                <FormControl>
                                    <Input maxLength={500} {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
