/** Keep sample system accounts from appearing as real instructors to learners. */
export function instructorName(teacher?: { name?: string; email?: string } | null): string {
  if (!teacher?.name || teacher.email?.toLowerCase().endsWith("@mcna.local") || teacher.name === "Prof. Linus Torvalds") {
    return "Giảng viên MCNA";
  }
  return teacher.name;
}
