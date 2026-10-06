"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type ViewportActionMenuProps = {
  ariaLabel?: string;
  align?: "left" | "right";
  buttonClassName?: string;
  buttonTitle?: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  menuClassName?: string;
};

export function ViewportActionMenu({
  ariaLabel = "Actions",
  align = "right",
  buttonClassName,
  buttonTitle,
  trigger,
  children,
  menuClassName
}: ViewportActionMenuProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const close = useCallback(() => setOpen(false), []);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined" || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth || 224;
    const menuHeight = Math.min(menuRef.current?.offsetHeight || 360, window.innerHeight - 16);
    let left = align === "right" ? rect.right - menuWidth : rect.left;
    let top = rect.bottom + 8;

    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - 8);
    }

    setPosition({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const handle = setTimeout(updatePosition, 0);
    return () => clearTimeout(handle);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [close, open, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        title={buttonTitle || ariaLabel}
        className={buttonClassName}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        {trigger}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={close} />
              <div
                ref={menuRef}
                style={{ top: position.top, left: position.left, maxHeight: "calc(100vh - 16px)" }}
                className={cn(
                  "fixed z-[9999] w-56 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-2xl",
                  menuClassName
                )}
                onClick={(event) => event.stopPropagation()}
              >
                {children(close)}
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}
