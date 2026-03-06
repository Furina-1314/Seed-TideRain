import { useEffect, useMemo, useState } from "react";

function formatLunarDate(date: Date) {
  const lunarFormatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
    month: "long",
    day: "numeric",
  });

  const parts = lunarFormatter.formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";

  return `${month}${day}`;
}

export default function SystemClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timeText = useMemo(
    () =>
      now.toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
    [now]
  );

  const dateText = useMemo(
    () =>
      now.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [now]
  );

  const weekText = useMemo(
    () =>
      now.toLocaleDateString("zh-CN", {
        weekday: "long",
      }),
    [now]
  );

  const lunarText = useMemo(() => formatLunarDate(now), [now]);

  return (
    <div className="h-full rounded-2xl px-4 py-3 bg-transparent text-gray-700 flex flex-col justify-center">
      <div className="text-3xl font-semibold tracking-wide leading-tight" style={{ fontFamily: "var(--font-mono)" }}>
        {timeText}
      </div>
      <div className="text-xs mt-2">{dateText}</div>
      <div className="text-xs mt-1">{weekText}</div>
      <div className="text-xs mt-1">{lunarText}</div>
    </div>
  );
}
