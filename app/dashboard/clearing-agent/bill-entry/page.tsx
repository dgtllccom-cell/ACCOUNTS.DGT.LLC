import { BlEntryView } from "@/features/shipping/components/bl-entry-view";

export const metadata = { title: "Clearing Agent — Bill Entry" };


export default function ClearingBillEntryPage() {
  return <BlEntryView context="shipping" />;
}
