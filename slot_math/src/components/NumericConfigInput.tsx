import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  value: number;
  onValueChange: (value: number) => void;
};

/** Keep editing text separate from the last valid numeric configuration value. */
export function NumericConfigInput({ value, onValueChange, onFocus, onBlur, ...props }: Props) {
  const [text, setText] = useState(() => Number.isFinite(value) ? String(value) : '');
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(Number.isFinite(value) ? String(value) : '');
  }, [value]);
  return <input {...props} type="number" value={text}
    onFocus={event => { focused.current = true; onFocus?.(event); }}
    onChange={event => {
      const next = event.target.value;
      setText(next);
      if (next.trim() && event.currentTarget.validity.valid && Number.isFinite(Number(next))) onValueChange(Number(next));
    }}
    onBlur={event => {
      focused.current = false;
      if (!event.currentTarget.value.trim() || !event.currentTarget.validity.valid) setText(Number.isFinite(value) ? String(value) : '');
      onBlur?.(event);
    }} />;
}
