// A visitor who clicks "register for this class" before having an account is sent through
// sign-up / login first; the chosen class is remembered here and submitted once they are signed in.

const ENROLL_INTENT_KEY = "mcna_lms_enroll_intent";

export type EnrollIntent = {
  courseId: string;
  sectionId?: string;
  courseTitle?: string;
  sectionCode?: string;
};

export function saveEnrollIntent(intent: EnrollIntent) {
  try {
    sessionStorage.setItem(ENROLL_INTENT_KEY, JSON.stringify(intent));
  } catch {
    // Storage can be unavailable (private mode); the visitor can still register from the catalog after login.
  }
}

export function readEnrollIntent(): EnrollIntent | null {
  try {
    const raw = sessionStorage.getItem(ENROLL_INTENT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.courseId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearEnrollIntent() {
  try {
    sessionStorage.removeItem(ENROLL_INTENT_KEY);
  } catch {
    // ignore
  }
}
