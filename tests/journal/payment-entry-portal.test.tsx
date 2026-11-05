import React from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EntryPortal } from "@/features/journal/components/payment-entry-portal";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("mounts the existing payment form when its slot appears after the old 120-frame timeout", async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", vi.fn(callback => { frames.push(callback); return frames.length; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const form = <input aria-label="Payment reference" defaultValue="Original entry" />;
  const { rerender } = render(<div><div /><div hidden><EntryPortal slotId="delayed-slot" active>{form}</EntryPortal></div></div>);
  act(() => { for (let i = 0; i < 125; i++) frames.shift()?.(i * 16); });
  rerender(<div><div><section id="delayed-slot" data-testid="visible-slot" /></div><div hidden><EntryPortal slotId="delayed-slot" active>{form}</EntryPortal></div></div>);
  const slot = screen.getByTestId("visible-slot");
  await waitFor(() => expect(within(slot).getByRole("textbox", { name: "Payment reference" })).toBeTruthy());
  expect(document.querySelectorAll('input[aria-label="Payment reference"]')).toHaveLength(1);
});

it("reattaches to a replacement slot and disconnects when closed", async () => {
  const body = <button type="button">Existing entry</button>;
  const { rerender, unmount } = render(<div><section key="a" id="replace-slot" data-testid="first-slot" /><EntryPortal slotId="replace-slot" active>{body}</EntryPortal></div>);
  expect(await within(screen.getByTestId("first-slot")).findByRole("button")).toBeTruthy();
  rerender(<div><section key="b" id="replace-slot" data-testid="second-slot" /><EntryPortal slotId="replace-slot" active>{body}</EntryPortal></div>);
  expect(await within(screen.getByTestId("second-slot")).findByRole("button")).toBeTruthy();
  unmount();
  expect(screen.queryByRole("button", { name: "Existing entry" })).toBeNull();
});
