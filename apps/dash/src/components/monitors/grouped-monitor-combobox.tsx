"use client";

import { useQuery } from "@tanstack/react-query";
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxEmpty,
    ComboboxGroup,
    ComboboxGroupLabel,
    ComboboxItem,
    ComboboxList,
    ComboboxPopup,
    ComboboxValue,
} from "@/components/ui/combobox";
import { orpc } from "@/utils/orpc";
import { buildGroupPaths } from "./group-tree";

export interface MonitorGroupOption {
    id: string;
    name: string;
    parentId?: string | null;
}

export interface GroupedMonitorOption {
    id: string;
    name: string;
    group?: MonitorGroupOption | null;
}

export function groupMonitorOptions(
    monitors: GroupedMonitorOption[],
    groupPaths?: Map<string, string>,
) {
    const groups = monitors.reduce(
        (acc, monitor) => {
            const groupName =
                (monitor.group &&
                    (groupPaths?.get(monitor.group.id) ??
                        monitor.group.name)) ||
                "Ungrouped";
            if (!acc[groupName]) {
                acc[groupName] = [];
            }
            acc[groupName].push(monitor);
            return acc;
        },
        {} as Record<string, GroupedMonitorOption[]>,
    );

    return Object.entries(groups)
        .map(
            ([groupName, items]) =>
                [
                    groupName,
                    [...items].sort((a, b) => a.name.localeCompare(b.name)),
                ] as const,
        )
        .sort(([groupNameA], [groupNameB]) => {
            if (groupNameA === "Ungrouped") return 1;
            if (groupNameB === "Ungrouped") return -1;
            return groupNameA.localeCompare(groupNameB);
        });
}

interface GroupedMonitorComboboxProps {
    ariaLabel: string;
    emptyMessage?: string;
    inputClassName?: string;
    monitors: GroupedMonitorOption[];
    onValueChange: (value: GroupedMonitorOption[]) => void;
    placeholder: string;
    value: GroupedMonitorOption[];
}

export function GroupedMonitorCombobox({
    ariaLabel,
    emptyMessage = "No monitors found.",
    inputClassName,
    monitors,
    onValueChange,
    placeholder,
    value,
}: GroupedMonitorComboboxProps) {
    const { data: groups } = useQuery({
        ...orpc.monitors.listGroups.queryOptions(),
    });
    const groupPaths = new Map(
        buildGroupPaths(groups).map(({ group, path }) => [group.id, path]),
    );
    const groupedMonitors = groupMonitorOptions(monitors, groupPaths);

    return (
        <Combobox
            items={monitors}
            value={value}
            onValueChange={onValueChange}
            multiple
        >
            <ComboboxChips>
                <ComboboxValue>
                    {(selected: GroupedMonitorOption[]) => (
                        <>
                            {selected?.map((monitor) => (
                                <ComboboxChip
                                    key={monitor.id}
                                    aria-label={monitor.name}
                                >
                                    {monitor.name}
                                </ComboboxChip>
                            ))}
                            <ComboboxChipsInput
                                aria-label={ariaLabel}
                                placeholder={
                                    selected?.length > 0
                                        ? undefined
                                        : placeholder
                                }
                                className={inputClassName}
                            />
                        </>
                    )}
                </ComboboxValue>
            </ComboboxChips>
            <ComboboxPopup>
                <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
                <ComboboxList>
                    {groupedMonitors.map(([groupName, items]) => (
                        <ComboboxGroup key={groupName}>
                            <ComboboxGroupLabel>{groupName}</ComboboxGroupLabel>
                            {items.map((monitor) => (
                                <ComboboxItem key={monitor.id} value={monitor}>
                                    {monitor.name}
                                </ComboboxItem>
                            ))}
                        </ComboboxGroup>
                    ))}
                </ComboboxList>
            </ComboboxPopup>
        </Combobox>
    );
}
