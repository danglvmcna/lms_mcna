import { Enrollment, LMSDataStore, Transaction, User } from "../../types";

export type StudentTab = "home" | "catalog" | "learning" | "orders" | "notifications";

/** What every student screen receives from StudentPanel. */
export interface StudentViewProps {
  store: LMSDataStore;
  currentUser: User;
  myEnrollments: Enrollment[];
  onRefreshData: () => Promise<void> | void;
  toast: (message: string, tone?: "success" | "error" | "info" | "warning") => void;
  go: (tab: StudentTab) => void;
  /** Open a course page in Explore. */
  openCourse: (courseId: string) => void;
  /** Open a course's classroom, optionally at a specific session. */
  openClassroom: (courseId: string, sessionNumber?: number) => void;
  openPayment: (transaction: Transaction) => void;
}
