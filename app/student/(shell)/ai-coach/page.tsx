import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildTopicStats } from "@/lib/aiCoach";

export default async function AiCoachPage() {
  const session = getSession();
  if (!session || session.role !== "STUDENT") redirect("/");

  const answers = await prisma.attemptAnswer.findMany({
    where: {
      attempt: {
        studentId: session!.id,
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      },
    },
    include: {
      question: {
        select: {
          subject: true,
          topic: true,
          translations: { select: { language: true, correctOptionIds: true } },
        },
      },
    },
  });

  const stats = buildTopicStats(answers as any);
  const weak = stats.filter((s) => s.band === "WEAK");
  const moderate = stats.filter((s) => s.band === "MODERATE");
  const strong = stats.filter((s) => s.band === "STRONG");
  const insufficient = stats.filter((s) => s.band === "INSUFFICIENT_DATA");

  const lowestAccuracy = weak.length > 0 ? Math.min(...weak.map((s) => s.accuracy)) : null;
  const highestAccuracy = strong.length > 0 ? Math.max(...strong.map((s) => s.accuracy)) : null;

  return (
    <div className="flex flex-col w-full gap-8">
      <div>
        <h1 className="text-3xl font-bold text-ink">🤖 AI Coach — Skill Zones</h1>
        <p className="text-ink-soft mt-2">
          Topic-wise breakdown across all your submitted tests. Focus your effort where it yields the most gain.
        </p>
      </div>

      {answers.length === 0 ? (
        <div className="card text-center text-ink-soft">
          Attempt and submit at least one test to see your personalized topic analysis here.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weak Zones column */}
            <div className="flex flex-col gap-4">
              <div className="p-6 rounded-2xl bg-red-50 border border-danger/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-danger">warning</span>
                  </div>
                  <h2 className="text-lg font-bold text-danger">Weak Zones</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-danger/70 uppercase tracking-wider mb-1">Lowest Accuracy</div>
                    <div className="text-2xl font-bold text-danger">{lowestAccuracy ?? "—"}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-danger/70 uppercase tracking-wider mb-1">Topics Flagged</div>
                    <div className="text-2xl font-bold text-danger">{weak.length}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {weak.length === 0 && (
                  <div className="card text-center text-ink-soft text-sm">No weak topics detected — nice work!</div>
                )}
                {weak.map((s) => (
                  <TopicCard key={s.key} stat={s} tone="danger" />
                ))}
              </div>
            </div>

            {/* Strong Zones column */}
            <div className="flex flex-col gap-4">
              <div className="p-6 rounded-2xl bg-green-50 border border-success/10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-success">workspace_premium</span>
                  </div>
                  <h2 className="text-lg font-bold text-success">Strong Zones</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-success/70 uppercase tracking-wider mb-1">Highest Accuracy</div>
                    <div className="text-2xl font-bold text-success">{highestAccuracy ?? "—"}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-success/70 uppercase tracking-wider mb-1">Topics Mastered</div>
                    <div className="text-2xl font-bold text-success">{strong.length}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {strong.length === 0 && (
                  <div className="card text-center text-ink-soft text-sm">
                    Keep attempting tests — mastered topics will show up here.
                  </div>
                )}
                {strong.map((s) => (
                  <TopicCard key={s.key} stat={s} tone="success" />
                ))}
              </div>
            </div>
          </div>

          {moderate.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-warning mb-2">🟡 Moderate — Needs Practice</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {moderate.map((s) => (
                  <TopicCard key={s.key} stat={s} tone="warning" />
                ))}
              </div>
            </section>
          )}

          {insufficient.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-ink-soft mb-2">More data needed</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {insufficient.map((s) => (
                  <TopicCard key={s.key} stat={s} tone="neutral" />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

const toneStyles: Record<string, { badge: string; border: string }> = {
  danger: { badge: "bg-red-100 text-danger", border: "border-l-4 border-danger" },
  warning: { badge: "bg-amber-100 text-warning", border: "border-l-4 border-warning" },
  success: { badge: "bg-green-100 text-success", border: "border-l-4 border-success" },
  neutral: { badge: "bg-slate-100 text-slate-500", border: "border-l-4 border-slate-200" },
};

function TopicCard({ stat, tone }: { stat: ReturnType<typeof buildTopicStats>[number]; tone: string }) {
  const style = toneStyles[tone];
  return (
    <div className={`card ${style.border} py-3`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-ink">{stat.topic}</div>
          <div className="text-xs text-ink-soft">{stat.subject}</div>
        </div>
        <div className="text-right">
          {stat.attempted > 0 && (
            <div className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block ${style.badge}`}>
              {stat.accuracy}% · {stat.correct}/{stat.attempted}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-ink-soft mt-2">{stat.tip}</p>
    </div>
  );
}
