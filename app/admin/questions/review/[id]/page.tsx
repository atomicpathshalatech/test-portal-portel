"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import FormulaText from "@/components/FormulaText";

type Translation = {
  language: string;
  statement: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  solution: string | null;
};
type QuestionDetail = {
  id: string;
  questionCode: string | null;
  subject: string;
  chapter: string | null;
  topic: string | null;
  type: string;
  difficulty: string;
  imageUrl: string | null;
  isPublished: boolean;
  translations: Translation[];
};

export default function ReviewQuestionPage() {
  const { id } = useParams<{ id: string }>();
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [lang, setLang] = useState<"hi" | "en">("en");

  useEffect(() => {
    fetch(`/api/questions/${id}`)
      .then((r) => r.json())
      .then((q) => {
        setQuestion(q);
        setLang(q.translations.some((t: Translation) => t.language === "en") ? "en" : "hi");
      });
  }, [id]);

  if (!question) return <div className="text-center text-slate-400 py-10">Loading...</div>;

  const t = question.translations.find((tr) => tr.language === lang) || question.translations[0];
  const isIntegerType = question.type === "INTEGER" || question.type === "NUMERICAL";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <Link
          href={`/admin/questions/${encodeURIComponent(question.subject)}/${encodeURIComponent(question.chapter || "")}`}
          className="text-sm text-brand hover:opacity-70 transition-opacity duration-150"
        >
          ← Back to list
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/admin/questions/new?edit=${question.id}`} className="btn-secondary text-xs">
            Edit
          </Link>
          <Link href={`/admin/questions/versions/${question.id}`} className="btn-secondary text-xs">
            History
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4 text-xs text-slate-400">
        <span className="font-mono text-brand font-semibold">{question.questionCode}</span>
        <span>·</span>
        <span>
          {question.subject} {question.chapter ? `· ${question.chapter}` : ""} {question.topic ? `· ${question.topic}` : ""}
        </span>
        <span>·</span>
        <span>{question.difficulty}</span>
        {question.isPublished && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-success font-medium">Published</span>
        )}
      </div>

      {question.translations.length > 1 && (
        <div className="flex gap-2 mb-4 border-b">
          {question.translations.map((tr) => (
            <button
              key={tr.language}
              onClick={() => setLang(tr.language as "hi" | "en")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-150 ${
                lang === tr.language ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-ink"
              }`}
            >
              {tr.language === "hi" ? "हिंदी" : "English"}
            </button>
          ))}
        </div>
      )}

      {/* Styled to match exactly what a student sees during the exam. */}
      <div className="card">
        {question.imageUrl && (
          <img src={question.imageUrl} alt="Question diagram" className="max-h-72 rounded-lg border border-slate-200 mb-4" />
        )}
        <p className="text-slate-900 mb-4 leading-relaxed">
          <FormulaText text={t?.statement || ""} />
        </p>

        {isIntegerType ? (
          <div className="px-4 py-3 rounded-lg border border-success bg-green-50">
            <span className="text-xs text-slate-500 block mb-1">Correct Answer:</span>
            <span className="font-mono text-lg font-semibold text-success">{t?.correctOptionIds[0]}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {t?.options.map((opt) => {
              const isCorrect = t.correctOptionIds.includes(opt.id);
              return (
                <div
                  key={opt.id}
                  className={`w-full text-left px-4 py-3 rounded-lg border flex items-center gap-3 ${
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
                  {isCorrect && <span className="ml-auto text-xs text-success font-medium flex-shrink-0">Correct</span>}
                </div>
              );
            })}
          </div>
        )}

        {t?.solution && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-400 mb-1">💡 Solution</div>
            <p className="text-sm text-slate-700 leading-relaxed">
              <FormulaText text={t.solution} />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
