"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import FormulaText from "@/components/FormulaText";

type OptionRow = { id: string; text: string };
type Translation = { language: string; statement: string; options: OptionRow[]; correctOptionIds: string[]; solution: string | null };
type QuestionFull = {
  id: string;
  questionCode: string | null;
  difficulty: string;
  imageUrl: string | null;
  translations: Translation[];
};
type SectionQuestionLink = { id: string; questionId: string; reviewStatus: string; question: QuestionFull };
type SectionData = { id: string; name: string; subject: string; targetCount: number; questions: SectionQuestionLink[] };
type TestData = {
  id: string;
  name: string;
  status: string;
  languageMode: "HINDI" | "ENGLISH" | "BOTH";
  durationMin: number;
  sections: SectionData[];
};

type Device = "mobile" | "tablet" | "desktop";
const DEVICE_WIDTH: Record<Device, string> = { mobile: "max-w-sm", tablet: "max-w-2xl", desktop: "max-w-none" };

export default function ReviewModePage() {
  const { id: testId } = useParams<{ id: string }>();
  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [flatIdx, setFlatIdx] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [lang, setLang] = useState<"hi" | "en">("en");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/tests/${testId}`);
    const data: TestData = await res.json();
    setTest(data);
    setLoading(false);
    setLang(data.languageMode === "HINDI" ? "hi" : "en");
  }

  useEffect(() => {
    load();
  }, [testId]);

  const flatQuestions = useMemo(() => {
    if (!test) return [];
    return test.sections.flatMap((sec) => sec.questions.map((sq) => ({ ...sq, sectionName: sec.name, sectionId: sec.id })));
  }, [test]);

  const current = flatQuestions[flatIdx];
  const t = current?.question.translations.find((tr) => tr.language === lang) || current?.question.translations[0];

  const approvedCount = flatQuestions.filter((q) => q.reviewStatus === "APPROVED").length;
  const rejectedCount = flatQuestions.filter((q) => q.reviewStatus === "REJECTED").length;

  async function setReview(status: "APPROVED" | "REJECTED") {
    if (!current) return;
    setSaving(true);
    await fetch(`/api/sections/${current.sectionId}/questions/${current.questionId}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus: status }),
    });
    await load();
    setSaving(false);
    if (flatIdx < flatQuestions.length - 1) setFlatIdx(flatIdx + 1);
  }

  if (loading || !test) return <div className="text-center text-slate-400 py-10">Loading...</div>;
  if (flatQuestions.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-slate-500">No questions to review yet.</p>
        <Link href="/admin/tests" className="text-brand text-sm underline mt-2 inline-block">
          ← Back to Manage Tests
        </Link>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    PENDING: "bg-slate-200 text-slate-600",
    APPROVED: "bg-success text-white",
    REJECTED: "bg-danger text-white",
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-100 z-[100]">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/admin/tests" className="text-sm text-brand">← Back</Link>
          <span className="font-semibold text-slate-800">{test.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium uppercase">Review Mode</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-500">
            <span className="text-success font-semibold">{approvedCount}</span> approved ·{" "}
            <span className="text-danger font-semibold">{rejectedCount}</span> rejected ·{" "}
            {flatQuestions.length - approvedCount - rejectedCount} pending
          </div>
          {test.languageMode === "BOTH" && (
            <select className="border rounded px-2 py-1 text-xs" value={lang} onChange={(e) => setLang(e.target.value as "hi" | "en")}>
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          )}
          <div className="flex bg-slate-100 rounded-full p-0.5 text-xs">
            {(["mobile", "tablet", "desktop"] as Device[]).map((d) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className={`px-3 py-1.5 rounded-full font-medium ${device === d ? "bg-white shadow-sm text-brand" : "text-slate-500"}`}
              >
                {d === "mobile" ? "📱" : d === "tablet" ? "💻" : "🖥"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body: palette + preview */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-56 bg-white border-r overflow-y-auto p-3 flex-shrink-0">
          <div className="text-xs font-semibold text-slate-500 mb-2 px-1">Question Palette</div>
          <div className="grid grid-cols-5 gap-1.5">
            {flatQuestions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setFlatIdx(idx)}
                className={`w-9 h-9 rounded text-xs font-semibold ${statusColor[q.reviewStatus]} ${
                  idx === flatIdx ? "ring-2 ring-brand-dark" : ""
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto p-8 flex justify-center">
          <div className={`w-full ${DEVICE_WIDTH[device]} transition-all`}>
            {/* Simulated student exam header */}
            <div className="bg-white rounded-t-xl border px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">{test.name}</span>
              <span className="font-mono text-sm text-danger">{String(test.durationMin).padStart(2, "0")}:00:00</span>
            </div>

            <div className="bg-white border-x border-b rounded-b-xl p-6">
              <div className="text-xs text-slate-400 mb-2">
                {current.sectionName} · Question {flatIdx + 1} of {flatQuestions.length} · [{current.question.difficulty}]
              </div>
              {current.question.imageUrl && (
                <img src={current.question.imageUrl} alt="" className="max-h-56 rounded-lg border mb-3" />
              )}
              <p className="text-slate-900 mb-4">
                <FormulaText text={t?.statement || ""} />
              </p>
              <div className="space-y-2">
                {t?.options.map((opt) => {
                  const isCorrect = t.correctOptionIds.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      className={`px-4 py-3 rounded-lg border flex items-center gap-3 ${
                        isCorrect ? "border-success bg-green-50" : "border-slate-200"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                          isCorrect ? "bg-success text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {opt.id}
                      </span>
                      <FormulaText text={opt.text} />
                      {isCorrect && <span className="material-symbols-outlined text-success text-sm ml-auto">check_circle</span>}
                    </div>
                  );
                })}
                {t?.options.length === 0 && (
                  <div className="px-4 py-3 rounded-lg border border-success bg-green-50 text-success font-medium">
                    Correct Value: {t?.correctOptionIds[0]}
                  </div>
                )}
              </div>
              {t?.solution && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-xs text-slate-400 mb-1">Solution ({lang === "hi" ? "हिंदी" : "English"})</div>
                  <p className="text-sm text-slate-700">
                    <FormulaText text={t.solution} />
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom review controls */}
      <div className="bg-white border-t px-6 py-3 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => setFlatIdx(Math.max(0, flatIdx - 1))}
          disabled={flatIdx === 0}
          className="btn-secondary text-sm disabled:opacity-40"
        >
          ← Previous
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setReview("REJECTED")} disabled={saving} className="bg-danger text-white px-4 py-2 rounded-lg text-sm">
            ✗ Reject Question
          </button>
          <Link
            href={`/admin/tests/${testId}/add-questions?section=${current.sectionId}&slot=${
              test.sections.find((s) => s.id === current.sectionId)!.questions.findIndex((q) => q.id === current.id) + 1
            }`}
            className="btn-secondary text-sm"
          >
            ✎ Edit Question
          </Link>
          <button onClick={() => setReview("APPROVED")} disabled={saving} className="bg-success text-white px-4 py-2 rounded-lg text-sm">
            ✓ Approve Question
          </button>
        </div>
        <button
          onClick={() => setFlatIdx(Math.min(flatQuestions.length - 1, flatIdx + 1))}
          disabled={flatIdx === flatQuestions.length - 1}
          className="btn-secondary text-sm disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
