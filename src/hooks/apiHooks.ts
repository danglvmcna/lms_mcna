import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { AppStore } from "../store";
import { LMSDataStore } from "../types";

const createEmptyStore = (): LMSDataStore => ({
  users: [],
  courses: [],
  lessons: [],
  enrollments: [],
  lessonProgress: [],
  quizzes: [],
  questions: [],
  quizAttempts: [],
  assignments: [],
  submissions: [],
  certificates: [],
  notifications: [],
  forumPosts: [],
  auditLogs: [],
  transactions: [],
  departments: [],
  programs: [],
  attendanceSessions: [],
  sessionMaterials: [],
  attendanceRecords: [],
  advisorNotes: [],
  courseSections: [],
  courseRegistrations: [],
  systemEvents: [],
  teacherAttendance: []
});

const hydrateStore = (store: LMSDataStore) => {
  AppStore.hydrate(store);
  return store;
};

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) throw new Error("Session expired");
      return response.json() as Promise<{ user: LMSDataStore["users"][number] }>;
    },
    retry: false
  });
}

export function useStoreSnapshot(enabled = true) {
  return useQuery({
    queryKey: ["store"],
    queryFn: async () => {
      if (AppStore.syncPromise) {
        try {
          await AppStore.syncPromise;
        } catch (e) {
          // ignore
        }
      }
      return hydrateStore(await api.getStore());
    },
    enabled,
    staleTime: 20_000
  });
}

export function useCourses() {
  return useQuery({ queryKey: ["courses"], queryFn: api.getCourses, staleTime: 20_000 });
}

export function useEnrollments() {
  return useQuery({ queryKey: ["enrollments"], queryFn: api.getEnrollments, staleTime: 20_000 });
}

export function useWarnings() {
  return useQuery({ queryKey: ["warnings"], queryFn: api.getWarnings, staleTime: 20_000 });
}

export function useTuition() {
  return useQuery({
    queryKey: ["dashboard", "finance"],
    queryFn: api.getFinanceDashboard,
    staleTime: 20_000
  });
}

export function useGradebook() {
  return useQuery({
    queryKey: ["dashboard", "teacher"],
    queryFn: api.getTeacherDashboard,
    staleTime: 20_000
  });
}

export function useApiStore(enabled = true) {
  const query = useStoreSnapshot(enabled);
  const store = query.data ?? (query.isLoading ? createEmptyStore() : AppStore.get());
  return {
    store,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch
  };
}

export function useInvalidateLmsQueries() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}
