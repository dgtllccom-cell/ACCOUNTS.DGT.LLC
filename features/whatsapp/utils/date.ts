// features/whatsapp/utils/date.ts
// Pure JS/TS helper functions to format dates, avoiding external dependencies like date-fns.

export function formatDistanceToNow(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function formatDateTime(
  date: Date | string,
  formatStr: "dd MMM yyyy, HH:mm" | "dd MMM, HH:mm" | "MMMM d, yyyy" | "HH:mm"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const pad = (num: number) => String(num).padStart(2, "0");
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  
  const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthsLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const day = d.getDate();
  const monthShort = monthsShort[d.getMonth()];
  const monthLong = monthsLong[d.getMonth()];
  const year = d.getFullYear();
  
  if (formatStr === "HH:mm") {
    return `${hh}:${mm}`;
  }
  if (formatStr === "MMMM d, yyyy") {
    return `${monthLong} ${day}, ${year}`;
  }
  if (formatStr === "dd MMM, HH:mm") {
    return `${pad(day)} ${monthShort}, ${hh}:${mm}`;
  }
  if (formatStr === "dd MMM yyyy, HH:mm") {
    return `${pad(day)} ${monthShort} ${year}, ${hh}:${mm}`;
  }
  
  return d.toLocaleString();
}
