import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AccessibleButtonProps extends ButtonProps {
  /** Required when the button shows only an icon. */
  label?: string;
  loading?: boolean;
  loadingLabel?: string;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
}

/**
 * Button with WCAG-safe defaults: 44px minimum touch target, always-visible
 * focus ring, accessible name for icon-only buttons, and busy/pressed state
 * announced to screen readers.
 */
export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({ label, loading, loadingLabel = "Working…", pressed, expanded, controls, className, children, disabled, ...props }, ref) => (
    <Button
      ref={ref}
      aria-label={label ?? undefined}
      aria-busy={loading || undefined}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-disabled={disabled || loading || undefined}
      disabled={disabled || loading}
      className={cn(
        "min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-600",
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>{children ?? loadingLabel}</span>
          <span className="sr-only">{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  ),
);
AccessibleButton.displayName = "AccessibleButton";
