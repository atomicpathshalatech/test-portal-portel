"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Test = {
  id: string;
  name: string;
  durationMin: number;
  openTime: string;
  closeTime: string;
  status: string;
  sections: { subject: string }[];
};
type SeriesData = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  thumbnailUrl: string | null;
  examType: string | null;
  languageMode?: string;
  tests: Test[];
};

const SUBJECT_STYLE: Record<string, { bg: string; text: string; letter: string }> = {
  Physics: { bg: "bg-blue-100", text: "text-blue-700", letter: "P" },
  Chemistry: { bg: "bg-purple-100", text: "text-purple-700", letter: "C" },
  Botany: { bg: "bg-green-100", text: "text-green-700", letter: "B" },
  Zoology: { bg: "bg-teal-100", text: "text-teal-700", letter: "Z" },
};

export default function StudentSeriesPage() {
  const { id: seriesId } = useParams<{ id: string }>();
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [tab, setTab] = useState<"about" | "schedule" | "syllabus">("about");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/test-series/${seriesId}`)
      .then((r) => r.json())
      .then((d) => {
        setSeries(d);
        setLoading(false);
      });
  }, [seriesId]);

  if (loading || !series) return <div className="text-center text-slate-400 py-10">Loading...</div>;

  const now = new Date();
  const publishedTests = series.tests.filter((t) => t.status === "PUBLISHED");
  const subjects = Array.from(new Set(series.tests.flatMap((t) => t.sections.map((s) => s.subject))));

  return (
    <div className="max-w-3xl">
      {/* Banner */}
      <div className="rounded-2xl overflow-hidden bg-brand-light mb-6 relative">
        {series.thumbnailUrl ? (
          <img src={series.thumbnailUrl} alt="" className="w-full h-40 object-cover" />
        ) : (
          <div className="w-full h-40 flex items-center justify-center text-6xl">📚</div>
        )}
      </div>

      {series.examType && (
        <span className="text-xs font-semibold text-brand uppercase tracking-wide">{series.examType}</span>
      )}
      <h1 className="text-2xl font-bold text-ink mt-1 mb-4">{series.name}</h1>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-surface-highest mb-6">
        {(["about", "schedule", "syllabus"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-medium capitalize transition-colors duration-150 ${
              tab === t ? "border-b-2 border-brand text-brand" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "about" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="card text-center">
              <div className="text-2xl font-bold text-brand">{publishedTests.length}</div>
              <div className="text-xs text-ink-soft mt-1">Tests</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-brand">{subjects.length}</div>
              <div className="text-xs text-ink-soft mt-1">Subjects</div>
            </div>
          </div>
          {series.description && (
            <div className="card">
              <p className="text-sm text-ink-soft leading-relaxed">{series.description}</p>
            </div>
          )}
        </div>
      )}

      {tab === "schedule" && (
        <div className="space-y-3">
          {publishedTests.map((t) => {
            const isLive = new Date(t.openTime) <= now && now <= new Date(t.closeTime);
            const isUpcoming = new Date(t.openTime) > now;
            return (
              <div key={t.id} className="card flex items-center justify-between">
                <div>
                  <div className="font-medium text-ink">{t.name}</div>
                  <div className="text-xs text-ink-soft mt-0.5">
                    {new Date(t.openTime).toLocaleDateString()} · {t.durationMin} min
                  </div>
                </div>
                {isLive ? (
                  <Link href={`/student/exam/${t.id}`} className="btn-primary text-sm">
                    Start
                  </Link>
                ) : isUpcoming ? (
                  <span className="text-xs text-ink-soft bg-surface-container px-3 py-1.5 rounded-full">Upcoming</span>
                ) : (
                  <Link href={`/student/result/by-test/${t.id}`} className="btn-secondary text-sm">
                    Result
                  </Link>
                )}
              </div>
            );
          })}
          {publishedTests.length === 0 && (
            <div className="card text-center text-ink-soft">No published tests yet in this series.</div>
          )}
        </div>
      )}

      {tab === "syllabus" && (
        <div className="grid grid-cols-2 gap-4">
          {subjects.map((subj) => {
            const style = SUBJECT_STYLE[subj] || { bg: "bg-slate-100", text: "text-slate-700", letter: subj[0] };
            return (
              <div key={subj} className="card flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${style.bg} ${style.text} flex items-center justify-center font-bold`}>
                  {style.letter}
                </div>
                <div>
                  <div className="font-medium text-ink text-sm">{subj}</div>
                  <div className="text-xs text-ink-soft">Full Syllabus</div>
                </div>
              </div>
            );
          })}
          {subjects.length === 0 && (
            <div className="card text-center text-ink-soft col-span-2">Syllabus will appear once tests are published.</div>
          )}
        </div>
      )}
    </div>
  );
}
