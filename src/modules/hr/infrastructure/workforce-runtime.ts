import "server-only";
import { randomUUID } from "node:crypto";

export const workforceRuntime = { now: () => new Date().toISOString(), today: employeeToday, createId: () => randomUUID(), timestamp: createTimestampForBangkokDate, nextTimestamp: (createdAt: string) => new Date(Math.max(Date.now(), new Date(createdAt).getTime() + 1)).toISOString() };

function employeeToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

function createTimestampForBangkokDate(
  date: string,
  now = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Bangkok",
  }).formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "00";
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");
  return new Date(
    `${date}T${getPart("hour")}:${getPart("minute")}:${getPart(
      "second",
    )}.${milliseconds}+07:00`,
  ).toISOString();
}

