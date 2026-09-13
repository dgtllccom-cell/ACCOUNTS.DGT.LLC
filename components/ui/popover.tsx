"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        // `data-[state=closed]:pointer-events-none` is a defensive fix, not cosmetic:
        // Radix's Popover.Content unmounts only after it observes the CSS animation's
        // `animationend` event, but a rapid open/close/re-open cycle (e.g. tabbing
        // between several pickers on one page) can interrupt that animation before it
        // fires, leaving Radix believing the content is still "present". The node then
        // sits in the DOM at its last position with `data-state="closed"` yet fully
        // interactive, silently swallowing clicks meant for whatever is underneath.
        // Gating pointer-events on data-state (independent of Radix's own unmount
        // timing) makes a stuck popover inert immediately, with no visible behavior
        // change for the normal open/close path.
        "z-[999999] w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-popover-foreground shadow-2xl outline-none backdrop-blur-none data-[state=closed]:pointer-events-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
