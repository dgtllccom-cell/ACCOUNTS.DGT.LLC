import { requireErpSession } from "@/lib/auth/session";
import { HrLeaveAttendanceView } from "@/features/hrm/components/hr-leave-attendance-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Leave & Attendance — HRM" };

export default async function LeaveAttendancePage() {
  const session = await requireErpSession();
  return <HrLeaveAttendanceView lang={session.preferredLanguage ?? "en"} />;
}
