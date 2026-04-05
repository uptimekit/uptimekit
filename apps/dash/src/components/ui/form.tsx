"use client";

import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import {
	Controller,
	type ControllerProps,
	type FieldPath,
	type FieldValues,
	FormProvider,
	useFormContext,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Form = FormProvider;

type FormFieldContextValue<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
	name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>(
	{} as FormFieldContextValue,
);

export function FormField<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>): React.ReactElement {
	return (
		<FormFieldContext.Provider value={{ name: props.name }}>
			<Controller {...props} />
		</FormFieldContext.Provider>
	);
}

type FormItemContextValue = {
	id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>(
	{} as FormItemContextValue,
);

function useFormField() {
	const fieldContext = React.useContext(FormFieldContext);
	const itemContext = React.useContext(FormItemContext);
	const { getFieldState, formState } = useFormContext();

	const fieldState = getFieldState(fieldContext.name, formState);

	if (!fieldContext) {
		throw new Error("useFormField must be used within <FormField>");
	}

	const { id } = itemContext;

	return {
		id,
		name: fieldContext.name,
		formDescriptionId: `${id}-form-item-description`,
		formItemId: `${id}-form-item`,
		formMessageId: `${id}-form-item-message`,
		...fieldState,
	};
}

export function FormItem({
	className,
	...props
}: React.ComponentProps<"div">): React.ReactElement {
	const id = React.useId();

	return (
		<FormItemContext.Provider value={{ id }}>
			<div className={cn("space-y-2", className)} {...props} />
		</FormItemContext.Provider>
	);
}

export function FormLabel({
	className,
	...props
}: React.ComponentProps<typeof Label>): React.ReactElement {
	const { error, formItemId } = useFormField();

	return (
		<Label
			className={cn(error && "text-destructive", className)}
			htmlFor={formItemId}
			{...props}
		/>
	);
}

export function FormControl({
	...props
}: React.ComponentProps<typeof Slot>): React.ReactElement {
	const { error, formDescriptionId, formItemId, formMessageId } =
		useFormField();

	return (
		<Slot
			aria-describedby={
				error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId
			}
			aria-invalid={Boolean(error)}
			id={formItemId}
			{...props}
		/>
	);
}

export function FormDescription({
	className,
	...props
}: React.ComponentProps<"p">): React.ReactElement {
	const { formDescriptionId } = useFormField();

	return (
		<p
			className={cn("text-muted-foreground text-sm", className)}
			id={formDescriptionId}
			{...props}
		/>
	);
}

export function FormMessage({
	className,
	children,
	...props
}: React.ComponentProps<"p">): React.ReactElement {
	const { error, formMessageId } = useFormField();
	const body = error ? String(error.message ?? "") : children;

	if (!body) {
		return <></>;
	}

	return (
		<p
			className={cn("font-medium text-destructive text-sm", className)}
			id={formMessageId}
			{...props}
		>
			{body}
		</p>
	);
}

export { Form, useFormField };
