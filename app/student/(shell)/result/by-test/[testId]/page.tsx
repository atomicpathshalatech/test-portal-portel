import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export default async function ResultByTest({ params }: { params: { testId: string } }) {
  const session = getSession();
  if (!session) redirect("/");

  const attempt = await prisma.attempt.findUnique({
    where: { testId_studentId: { testId: params.testId, studentId: session!.id } },
  });

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        You did not attempt this test.
      </div>
    );
  }

  redirect(`/student/result/${attempt.id}`);
}
