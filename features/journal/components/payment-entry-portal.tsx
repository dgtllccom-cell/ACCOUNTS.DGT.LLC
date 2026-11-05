"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children where they are written, or — when `active` — inside the element with id `slotId` once that element exists. It lets the
 * existing entry form (which owns all the payment state) appear inside the new document without being copied or moved in the source.
 */
export function EntryPortal({ slotId, active, children }: { slotId: string; active: boolean; children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) { setTarget(null); return; }
    // Booking first fetches verified dues and may wait for a user to select a
    // loading. Its document slot can appear much later than 120 animation frames,
    // or be replaced when another loading is opened. Observe its real lifecycle
    // rather than leaving the existing form inside the hidden legacy container.
    const find = () => {
      const element = document.getElementById(slotId);
      setTarget(current => current === element ? current : element);
    };
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    find();
    return () => observer.disconnect();
  }, [active, slotId]);
  if (active && target) return createPortal(children, target);
  return <>{children}</>;
}

