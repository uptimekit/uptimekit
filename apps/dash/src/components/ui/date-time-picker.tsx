"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DateTimePickerProps {
	date: Date | undefined;
	setDate: (date: Date | undefined) => void;
}

export function DateTimePicker({ date, setDate }: DateTimePickerProps) {
	const [selectedDateTime, setSelectedDateTime] = React.useState<
		Date | undefined
	>(date);

	// Sync local state when prop changes
	React.useEffect(() => {
		setSelectedDateTime(date);
	}, [date]);

	const handleSelect = (day: Date | undefined) => {
		if (!day) {
			setSelectedDateTime(undefined);
			setDate(undefined);
			return;
		}

		const newDateTime = new Date(day);
		if (selectedDateTime) {
			newDateTime.setHours(selectedDateTime.getHours());
			newDateTime.setMinutes(selectedDateTime.getMinutes());
		} else {
			// Default to current time if no time was set
			const now = new Date();
			newDateTime.setHours(now.getHours());
			newDateTime.setMinutes(now.getMinutes());
		}
		setSelectedDateTime(newDateTime);
		setDate(newDateTime);
	};

	const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const time = e.target.value;
		if (!time) return;
		const [hours, minutes] = time.split(":").map(Number);
		if (selectedDateTime) {
			const newDateTime = new Date(selectedDateTime);
			newDateTime.setHours(hours);
			newDateTime.setMinutes(minutes);
			setSelectedDateTime(newDateTime);
			setDate(newDateTime);
		}
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant={"outline"}
					className={cn(
						"w-full justify-start text-left font-normal",
						!date && "text-muted-foreground",
					)}
				>
					<CalendarIcon className="mr-2 h-4 w-4" />
					{date ? format(date, "PP p") : <span>Pick a date</span>}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={selectedDateTime}
					onSelect={handleSelect}
					initialFocus
				/>
				<div className="p-3 border-t bg-background">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-muted-foreground" />
						<Input
							type="time"
							className="h-8"
							value={selectedDateTime ? format(selectedDateTime, "HH:mm") : ""}
							onChange={handleTimeChange}
							disabled={!selectedDateTime}
						/>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
