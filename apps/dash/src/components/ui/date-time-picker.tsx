"use client";

import { faCalendar, faClock } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { format } from "date-fns";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
    date: Date | undefined;
    setDate: (date: Date | undefined) => void;
}

export function DateTimePicker({ date, setDate }: DateTimePickerProps) {
    const handleSelect = (day: Date | undefined) => {
        if (!day) {
            setDate(undefined);
            return;
        }

        const newDateTime = new Date(day);
        if (date) {
            newDateTime.setHours(date.getHours());
            newDateTime.setMinutes(date.getMinutes());
        } else {
            // Default to current time if no time was set
            const now = new Date();
            newDateTime.setHours(now.getHours());
            newDateTime.setMinutes(now.getMinutes());
        }
        setDate(newDateTime);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = e.target.value;
        if (!time) return;
        const [hours, minutes] = time.split(":").map(Number);
        if (date) {
            const newDateTime = new Date(date);
            newDateTime.setHours(hours);
            newDateTime.setMinutes(minutes);
            setDate(newDateTime);
        }
    };

    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button
                        variant="outline"
                        className={cn(
                            "w-full justify-start text-left font-normal",
                            !date && "text-muted-foreground",
                        )}
                    />
                }
            >
                <FontAwesomeIcon icon={faCalendar} className="mr-2 h-4 w-4" />
                {date ? format(date, "PP p") : <span>Pick a date</span>}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleSelect}
                    autoFocus
                />
                <div className="-mx-2 mt-2 -mb-2 rounded-b-xl border-t bg-background p-3">
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon
                            icon={faClock}
                            className="h-4 w-4 text-muted-foreground"
                        />
                        <Input
                            type="time"
                            className="h-8"
                            value={date ? format(date, "HH:mm") : ""}
                            onChange={handleTimeChange}
                            disabled={!date}
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
