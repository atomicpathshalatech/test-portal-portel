import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import StudentShellClient from "./StudentShellClient";

export default async function StudentShellLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session || session.role !== "STUDENT") redirect("/");

  return <StudentShellClient studentName={session.name}>{children}</StudentShellClient>;
}
