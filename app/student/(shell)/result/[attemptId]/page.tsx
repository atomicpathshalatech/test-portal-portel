"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import FormulaText from "@/components/FormulaText";
import ReportQuestionButton from "@/components/ReportQuestionButton";

type Bucket = { correct: number; incorrect: number; unattempted: number };
type QuestionReview = {
  questionId: string;
  questionCode: string | null;
  subject: string;
  imageUrl: string | null;
  selectedOptionIds: string[];
  isCorrect: boolean | null;
  translations: {
    language: string;
    statement: string;
    options: { id: string; text: string }[];
    correctOptionIds: string[];
    solution: string | null;
  }[];
};
type ResultData = {
  status: string;
  score: number | null;
  rank: number | null;
  totalStudents: number;
  isDpp: boolean;
  testId: string | null;
  dppId: string | null;
  testName: string;
  bySubject: Record<string, Bucket>;
  byDifficulty: Record<string, Bucket>;
  questions: QuestionReview[];
};

function Bar({ label, bucket }: { label: string; bucket: Bucket }) {
  const total = bucket.correct + bucket.incorrect + bucket.unattempted || 1;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">
          {bucket.correct}✓ {bucket.incorrect}✗ {bucket.unattempted}—
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
        <div className="bg-success h-full" style={{ width: `${(bucket.correct / total) * 100}%` }} />
        <div className="bg-danger h-full" style={{ width: `${(bucket.incorrect / total) * 100}%` }} />
        <div className="bg-slate-300 h-full" style={{ width: `${(bucket.unattempted / total) * 100}%` }} />
      </div>
    </div>
  );
}

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [data, setData] = useState<ResultData | null>(null);
  const [showSolutions, setShowSolutions] = useState(false);
  const [langChoice, setLangChoice] = useState<Record<string, "hi" | "en">>({});

  useEffect(() => {
    fetch(`/api/attempts/${attemptId}`)
      .then((r) => r.json())
      .then(setData);
  }, [attemptId]);

  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading result...</div>;

  return (
    <div className="w-full">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card text-center">
          <div className="text-sm text-slate-500 flex items-center justify-center gap-2">
            {data.isDpp && <span className="text-xs px-2 py-0.5 rounded-full bg-brand-light text-brand font-semibold">DPP</span>}
            {data.testName}
          </div>
          <div className="text-4xl font-bold text-brand mt-2">{data.score ?? "—"}</div>
          <div className="text-slate-500 text-sm">Score</div>
          {!data.isDpp && (
            <div className="flex justify-center gap-8 mt-4">
              <div>
                <div className="text-xl font-semibold text-slate-900">
                  {data.rank ?? "—"} / {data.totalStudents}
                </div>
                <div className="text-xs text-slate-500">Rank</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-3 mt-4">
            {!data.isDpp && (
              <>
                <Link
                  href={`/student/leaderboard/${data.testId}`}
                  className="btn-secondary inline-block text-sm"
                >
                  🏆 View Leaderboard
                </Link>
                <a
                  href={`/api/attempts/${attemptId}/certificate`}
                  className="btn-secondary inline-block text-sm"
                >
                  🎓 Download Certificate
                </a>
              </>
            )}
            {data.isDpp && (
              <Link href="/student/dpp" className="btn-secondary inline-block text-sm">
                ← Back to DPPs
              </Link>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-4">Subject-wise Performance</h2>
          {Object.entries(data.bySubject).map(([subject, bucket]) => (
            <Bar key={subject} label={subject} bucket={bucket} />
          ))}
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-4">Difficulty-wise Performance</h2>
          {["EASY", "MEDIUM", "HARD"].map((d) => (
            <Bar key={d} label={d} bucket={data.byDifficulty[d] || { correct: 0, incorrect: 0, unattempted: 0 }} />
          ))}
        </div>

        {data.questions.length > 0 && (
          <div className="card">
            <button
              onClick={() => setShowSolutions((s) => !s)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="font-semibold text-slate-900">Solutions Review</h2>
              <span className="text-brand text-sm">{showSolutions ? "Hide ▲" : "View Solutions ▼"}</span>
            </button>

            {showSolutions && (
              <div className="mt-4 space-y-4">
                {data.questions.map((q, idx) => {
                  const preferredLang = langChoice[q.questionId] || "en";
                  const t = q.translations.find((tr) => tr.language === preferredLang) || q.translations[0];
                  const isIntegerType = t && t.options.length === 0;
                  return (
                    <div key={q.questionId} className="border-t pt-4 first:border-t-0 first:pt-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs text-slate-400 font-mono">
                          Q{idx + 1} · {q.questionCode || q.subject}
                        </span>
                        <div className="flex items-center gap-2">
                          {q.translations.length > 1 && (
                            <div className="flex text-xs rounded-full bg-slate-100 p-0.5">
                              {q.translations.map((tr) => (
                                <button
                                  key={tr.language}
                                  onClick={() => setLangChoice((prev) => ({ ...prev, [q.questionId]: tr.language as "hi" | "en" }))}
                                  className={`px-2 py-0.5 rounded-full font-medium transition-all duration-150 ${
                                    preferredLang === tr.language ? "bg-white shadow-sm text-brand" : "text-slate-500"
                                  }`}
                                >
                                  {tr.language === "hi" ? "हिं" : "EN"}
                                </button>
                              ))}
                            </div>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              q.isCorrect === true
                                ? "bg-green-100 text-success"
                                : q.isCorrect === false
                                ? "bg-red-100 text-danger"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {q.isCorrect === true ? "Correct" : q.isCorrect === false ? "Incorrect" : "Unattempted"}
                          </span>
                        </div>
                      </div>
                      {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-40 rounded-lg border mb-2" />}
                      <p className="text-sm text-slate-800 mb-2">
                        <FormulaText text={t?.statement || ""} />
                      </p>
                      {isIntegerType ? (
                        <div className="text-sm space-y-1">
                          <div className="text-slate-500">
                            Your answer: <span className="font-medium text-slate-800">{q.selectedOptionIds[0] ?? "—"}</span>
                          </div>
                          <div className="text-success font-medium">Correct answer: {t?.correctOptionIds[0]}</div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {t?.options.map((opt) => {
                            const isCorrectOpt = t.correctOptionIds.includes(opt.id);
                            const wasSelected = q.selectedOptionIds.includes(opt.id);
                            return (
                              <div
                                key={opt.id}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                                  isCorrectOpt
                                    ? "bg-green-50 text-success font-medium"
                                    : wasSelected
                                    ? "bg-red-50 text-danger"
                                    : "bg-slate-50 text-slate-700"
                                }`}
                              >
                                <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs flex-shrink-0 border">
                                  {opt.id}
                                </span>
                                <FormulaText text={opt.text} />
                                {wasSelected && <span className="ml-auto text-xs flex-shrink-0">Your answer</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {t?.solution && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <div className="text-xs text-slate-400 mb-1">💡 Solution</div>
                          <p className="text-sm text-slate-600">
                            <FormulaText text={t.solution} />
                          </p>
                        </div>
                      )}
                      <div className="mt-2">
                        <ReportQuestionButton questionId={q.questionId} testId={data.testId || undefined} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
