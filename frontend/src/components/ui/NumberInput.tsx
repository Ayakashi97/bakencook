import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number | undefined;
    onChange: (value: number | undefined) => void;
}

export function NumberInput({ value, onChange, className, ...props }: NumberInputProps) {
    const [localValue, setLocalValue] = useState(value?.toString().replace('.', ',') || '');
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync from parent value, but avoid overwriting transient user input (like "1,")
    useEffect(() => {
        // If parent value is undefined/null, clear local
        if (value === undefined || value === null) {
            if (localValue !== '') setLocalValue('');
            return;
        }

        // Parse current local value to check if it matches parent
        const currentParsed = parseFloat(localValue.replace(',', '.'));

        // Only update local if parent value is different from what we have
        // This prevents "1," (parsed 1) from being overwritten by parent "1"
        if (value !== currentParsed) {
            setLocalValue(value.toString().replace('.', ','));
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setLocalValue(newVal);

        const normalized = newVal.replace(',', '.');

        if (normalized === '') {
            onChange(undefined);
            return;
        }

        if (/^-?\d*\.?\d*$/.test(normalized)) {
            const num = parseFloat(normalized);
            if (!isNaN(num)) {
                onChange(num);
            }
        }
    };

    return (
        <input
            {...props}
            ref={inputRef}
            type="text"
            inputMode="decimal"
            className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            value={localValue}
            onChange={handleChange}
        />
    );
}
