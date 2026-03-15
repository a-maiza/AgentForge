import * as React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

function Slider({
  className,
  value,
  onValueChange,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  ...props
}: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value?.[0] ?? 0}
      className={cn('w-full accent-primary cursor-pointer', className)}
      onChange={(e) => {
        onChange?.(e);
        onValueChange?.([parseFloat(e.target.value)]);
      }}
      {...props}
    />
  );
}

export { Slider };
