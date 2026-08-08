"use client";
import { useEffect, useState } from "react";
import FormulaText from "@/components/FormulaText";
import ReportQuestionButton from "@/components/ReportQuestionButton";

type Bookmark = {
  id: string;
  question: {
    id: string;
    subject: string;
    topic: string | null;
    difficulty: string;
    imageUrl: string | null;
    translations: { language: string; statement: string; options: { id: string; text: string }[]; correctOptionIds: string[]; solution: string | null }[];
  };
};

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealAnswer, setRevealAnswer] = useState<Record<string, boolean>>({});
  const [langChoice, setLangChoice] = useState<Record<string, "hi" | "en">>({});

  function load() {
    setLoading(true);
    fetch("/api/bookmarks")
      .then((r) => r.json())
      .then((d) => {
        setBookmarks(d);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function removeBookmark(questionId: string) {
    setBookmarks((prev) => prev.filter((b) => b.question.id !== questionId));
    await fetch(`/api/bookmarks?questionId=${questionId}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col w-full gap-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">🔖 Bookmarked Questions</h1>
        <p className="text-ink-soft mt-2">
          Questions you saved during exams for later revision. {bookmarks.length} saved.
        </p>
      </div>

      {loading ? (
        <div className="card text-center text-ink-soft">Loading...</div>
      ) : bookmarks.length === 0 ? (
        <div className="card text-center text-ink-soft">
          No bookmarks yet — tap the ☆ icon next to any question during an exam to save it here.
        </div>
      ) : (
        <div className="space-y-4">
          {bookmarks.map((b) => {
            const preferredLang = langChoice[b.question.id] || "en";
            const t =
              b.question.translations.find((tr) => tr.language === preferredLang) || b.question.translations[0];
            const revealed = revealAnswer[b.question.id];
            const hasBoth = b.question.translations.length > 1;
            return (
              <div key={b.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-ink-soft">
                    <span className="px-2 py-0.5 rounded-full bg-surface-container">{b.question.subject}</span>
                    {b.question.topic && <span>{b.question.topic}</span>}
                    <span className="px-2 py-0.5 rounded-full bg-surface-container">{b.question.difficulty}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasBoth && (
                      <div className="flex bg-surface-container rounded-full p-0.5 text-xs">
                        {(["hi", "en"] as const).map((l) => (
                          <button
                            key={l}
                            onClick={() => setLangChoice((prev) => ({ ...prev, [b.question.id]: l }))}
                            className={`px-2 py-0.5 rounded-full font-medium ${
                              preferredLang === l ? "bg-white shadow-sm text-brand" : "text-ink-soft"
                            }`}
                          >
                            {l === "hi" ? "हिं" : "EN"}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => removeBookmark(b.question.id)}
                      className="text-amber-500 text-lg"
                      title="Remove bookmark"
                    >
                      ★
                    </button>
                  </div>
                </div>
                {b.question.imageUrl && (
                  <img src={b.question.imageUrl} alt="" className="max-h-40 rounded-lg border mb-3" />
                )}
                <p className="text-ink mb-3">
                  <FormulaText text={t?.statement || ""} />
                </p>
                <div className="space-y-1.5">
                  {t && t.options.length === 0 ? (
                    revealed && (
                      <div className="px-3 py-2 rounded-lg text-sm bg-green-50 text-success font-medium">
                        Correct Answer: {t.correctOptionIds[0]}
                      </div>
                    )
                  ) : (
                    t?.options.map((opt) => {
                      const isCorrect = revealed && t.correctOptionIds.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                            isCorrect ? "bg-green-50 text-success font-medium" : "bg-surface"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-surface-high flex items-center justify-center text-xs flex-shrink-0">
                            {opt.id}
                          </span>
                          <FormulaText text={opt.text} />
                        </div>
                      );
                    })
                  )}
                </div>
                {revealed && t?.solution && (
                  <div className="mt-3 pt-3 border-t border-surface-highest/60">
                    <div className="text-xs text-ink-soft mb-1">💡 Solution ({preferredLang === "hi" ? "हिंदी" : "English"})</div>
                    <p className="text-sm text-ink-soft">
                      <FormulaText text={t.solution} />
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => setRevealAnswer((prev) => ({ ...prev, [b.question.id]: !prev[b.question.id] }))}
                    className="text-brand text-xs font-medium"
                  >
                    {revealed ? "Hide Answer" : "Show Answer"}
                  </button>
                  <ReportQuestionButton questionId={b.question.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
