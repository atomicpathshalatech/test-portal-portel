import { prisma } from "@/lib/prisma";
import Link from "next/link";

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { day: number; inMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - (startWeekday + daysInMonth) + 1, inMonth: false });
  }
  return cells;
}

export default async function SchedulePage() {
  const now = new Date();
  const tests = await prisma.test.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { openTime: "asc" },
    include: { testSeries: true },
  });

  const upcoming = tests.filter((t) => t.closeTime > now);

  const year = now.getFullYear();
  const month = now.getMonth();
  const cells = buildMonthGrid(year, month);
  const testDaysInMonth = new Set(
    tests
      .filter((t) => t.openTime.getFullYear() === year && t.openTime.getMonth() === month)
      .map((t) => t.openTime.getDate())
  );
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="flex flex-col w-full gap-8">
      <div>
        <h1 className="text-3xl font-bold text-ink">Exam Schedule</h1>
        <p className="text-ink-soft mt-2 max-w-2xl">
          View your upcoming assessments. Stay on top of your preparation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-6">
          <h2 className="text-lg font-bold text-ink">Upcoming Assessments</h2>
          {upcoming.map((t) => {
            const isLive = now >= t.openTime && now <= t.closeTime;
            return (
              <div key={t.id} className="card relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${isLive ? "bg-brand" : "bg-surface-highest"}`} />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-6">
                    <div
                      className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl flex-shrink-0 ${
                        isLive ? "bg-brand-light text-brand" : "bg-surface-high text-ink-soft"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase leading-none mb-1">
                        {t.openTime.toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="text-xl font-bold leading-none">{t.openTime.getDate()}</span>
                    </div>
                    <div>
                      <span className="text-xs text-brand uppercase tracking-wider font-semibold">
                        {t.testSeries.name}
                      </span>
                      <h3 className="font-bold text-ink mt-1 mb-1">{t.name}</h3>
                      <div className="flex items-center gap-4 text-xs text-ink-soft">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">schedule</span>
                          {t.openTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                          {t.durationMin} min
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">language</span>
                          {t.languageMode}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isLive ? (
                    <Link href={`/student/exam/${t.id}`} className="btn-primary text-sm flex-shrink-0">
                      Start
                    </Link>
                  ) : (
                    <span className="text-xs text-ink-soft bg-surface-container px-3 py-1.5 rounded-full flex-shrink-0">
                      Upcoming
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {upcoming.length === 0 && (
            <div className="card text-center text-ink-soft">No upcoming tests scheduled.</div>
          )}
        </div>

        <div className="lg:col-span-4">
          <div className="card">
            <h3 className="font-bold text-ink mb-4">{monthLabel}</h3>
            <div className="grid grid-cols-7 gap-y-3 text-center text-xs text-ink-soft mb-2">
              {weekdayLabels.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-2 text-center text-sm">
              {cells.map((c, idx) => {
                const isToday = c.inMonth && c.day === now.getDate();
                const hasTest = c.inMonth && testDaysInMonth.has(c.day);
                return (
                  <div key={idx} className="relative aspect-square flex items-center justify-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isToday
                          ? "bg-brand text-white font-bold"
                          : hasTest
                          ? "border-2 border-brand text-brand font-semibold"
                          : c.inMonth
                          ? "text-ink"
                          : "text-surface-highest"
                      }`}
                    >
                      {c.day}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-surface-highest/60 flex gap-4 text-xs text-ink-soft">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand" /> Today
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-brand" /> Test Day
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
