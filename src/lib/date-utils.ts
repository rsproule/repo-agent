import {
  formatDistanceToNow,
  format,
  formatDistance,
  type FormatDistanceOptions,
} from "date-fns";

export function formatDateWithGranularity(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInMonths =
    (now.getFullYear() - dateObj.getFullYear()) * 12 +
    (now.getMonth() - dateObj.getMonth());

  // For dates less than a year ago, use formatDistanceToNow
  if (diffInMonths < 1) {
    return `${formatDistanceToNow(dateObj)} ago`;
  }

  return `on ${format(dateObj, "MMM d, yyyy")}`;
}

export function compactDateDistance(
  fromDate: Date,
  toDate: Date,
  options?: FormatDistanceOptions,
): string {
  return formatDistance(fromDate, toDate, options)
    .replace(/about /, "~")
    .replace(/over /, ">")
    .replace(/almost /, "~")
    .replace(" months", "mo")
    .replace(" month", "mo")
    .replace(" years", "yr")
    .replace(" year", "yr")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" seconds", "s")
    .replace(" second", "s");
}

// Helper functions to work with ISO strings consistently
export const startOfDayISO = (date: Date): string => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

export const endOfDayISO = (date: Date): string => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
};

export const parseISOToDate = (isoString: string): Date => {
  return new Date(isoString);
};