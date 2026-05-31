"use client";

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

type SlottableProps = React.HTMLAttributes<HTMLElement> & {
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
	id?: string;
};

interface FormFieldContextValue<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
	name: TName;
}

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

interface FormItemContextValue {
	id: string;
}

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
	children,
	...props
}: Omit<SlottableProps, "children"> & {
	children: React.ReactElement;
}): React.ReactElement {
	const { error, formDescriptionId, formItemId, formMessageId } =
		useFormField();
	const controlProps: SlottableProps = {
		"aria-describedby": error
			? `${formDescriptionId} ${formMessageId}`
			: formDescriptionId,
		"aria-invalid": Boolean(error),
		id: formItemId,
		...props,
	};

	if (!React.isValidElement(children)) {
		throw new Error("FormControl expects a single valid React element");
	}

	return React.cloneElement(
		children as React.ReactElement<SlottableProps>,
		controlProps,
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
}: React.ComponentProps<"p">): React.ReactElement | null {
	const { error, formMessageId } = useFormField();
	const body = error ? String(error.message ?? "") : children;

	if (!body) {
		return null;
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
