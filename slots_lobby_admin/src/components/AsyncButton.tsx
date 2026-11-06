import { Button } from 'antd';
import type { ButtonProps } from 'antd';
export function AsyncButton({ loading, children, disabled, ...props }: ButtonProps) {
 const busy = Boolean(loading);
 return <Button {...props} disabled={busy || disabled} aria-busy={busy} className={`async-button ${props.className ?? ''}`}>
  <span style={busy ? { visibility: 'hidden' } : undefined}>{children}</span>
  {busy && <span className="button-spinner" aria-hidden="true" />}
 </Button>;
}
