import { describe, expect, it } from "vitest";
import { analyzeConversation, findDate, parseWhatsAppExport } from "@/lib/customer-inquiry/conversation-intel";

const REF = "2026-09-29"; // a Tuesday

describe("dates", () => {
  it("reads absolute and relative dates", () => {
    expect(findDate("deliver on 2026-10-15", REF)).toBe("2026-10-15");
    expect(findDate("payment by 05/11/2026", REF)).toBe("2026-11-05");
    expect(findDate("meeting 12 Oct", REF)).toBe("2026-10-12");
    expect(findDate("send it tomorrow", REF)).toBe("2026-09-30");
    expect(findDate("in 10 days", REF)).toBe("2026-10-09");
    expect(findDate("by Friday", REF)).toBe("2026-10-02");
    expect(findDate("no date here", REF)).toBeNull();
    expect(findDate("31/02/2026", REF)).toBeNull();
  });
});

describe("WhatsApp export", () => {
  it("parses Android and iOS lines and continuation lines", () => {
    const m = parseWhatsAppExport([
      "12/09/2026, 10:15 - Ahmed Khan: Salam, we need 500 bags of cement",
      "second line of the same message",
      "[12/09/2026, 10:16:02] Sales Desk: Noted. We will send the quotation by Friday.",
      "12/09/2026, 10:17 - Ahmed Khan: <Media omitted>",
    ].join("\n"));
    expect(m).toHaveLength(2);
    expect(m[0].sender).toBe("Ahmed Khan");
    expect(m[0].text).toContain("second line");
    expect(m[1].sender).toBe("Sales Desk");
  });
});

describe("analysis", () => {
  it("finds decisions, requirements, actions with owners and due dates", () => {
    const a = analyzeConversation({
      channel: "meeting", refDate: REF, lang: "en", authorName: "Sales",
      text: "Met Mr Ahmed Khan from Khan Trading LLC. They need 500 tons of steel rebar. We agreed on a price of AED 2,450 per ton. We will send the quotation by Friday. Ahmed will confirm the delivery address tomorrow. Payment due on 15/10/2026.",
    });
    expect(a.decisions.some((d) => /agreed on a price/.test(d))).toBe(true);
    expect(a.requirements.some((r) => /500 tons/.test(r))).toBe(true);
    const ours = a.actions.find((x) => /send the quotation/.test(x.text));
    expect(ours?.ownerSide).toBe("us");
    expect(ours?.dueDate).toBe("2026-10-02");
    const theirs = a.actions.find((x) => /confirm the delivery address/.test(x.text));
    expect(theirs?.owner).toBe("Ahmed");
    expect(theirs?.dueDate).toBe("2026-09-30");
    expect(a.dates.some((d) => d.date === "2026-10-15" && d.kind === "payment")).toBe(true);
    expect(a.replies.email.body).toContain("Next steps");
    expect(a.draft.company_name).toContain("Khan Trading");
  });
});
