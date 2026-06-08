declare module '@admin-basic/Button' {
  import type { ButtonHTMLAttributes, ComponentType } from 'react';
  export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
    size?: 'sm' | 'md' | 'lg';
  }
  export const Button: ComponentType<ButtonProps>;
}

declare module '@admin-basic/Div' {
  import type { ComponentType, HTMLAttributes, Ref } from 'react';
  export const Div: ComponentType<HTMLAttributes<HTMLDivElement> & { ref?: Ref<HTMLDivElement> }>;
}

declare module '@admin-basic/Span' {
  import type { ComponentType, HTMLAttributes } from 'react';
  export const Span: ComponentType<HTMLAttributes<HTMLSpanElement>>;
}

declare module '@admin-basic/Icon' {
  import type { ComponentType } from 'react';
  export interface IconProps {
    name: string;
    className?: string;
  }
  export const Icon: ComponentType<IconProps>;
}

declare module '@admin-basic/Input' {
  import type { ComponentType, InputHTMLAttributes } from 'react';
  export const Input: ComponentType<InputHTMLAttributes<HTMLInputElement>>;
}

declare module '@admin-basic/Select' {
  import type { ChangeEvent, ComponentType, SelectHTMLAttributes } from 'react';
  export interface SelectOption {
    value: string | number;
    label: string;
    disabled?: boolean;
  }
  export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
    label?: string;
    error?: string;
    options?: SelectOption[] | string[];
    onChange?: (e: ChangeEvent<HTMLSelectElement> | { target: { value: string | number } }) => void;
    searchable?: boolean;
    searchPlaceholder?: string;
  }
  export const Select: ComponentType<SelectProps>;
}
