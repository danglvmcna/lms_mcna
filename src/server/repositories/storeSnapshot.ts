import { getInitialStore } from "../../store";
import { Course, Enrollment, LessonProgress, User } from "../../types";
import { Queryable } from "../db";
import { assignmentFromRow, courseFromRow, courseSectionFromRow, DbUserRow, enrollmentFromRow, questionFromRow, quizAttemptFromRow, quizFromRow, sessionMaterialFromRow, submissionFromRow, toPublicUser } from "../mappers";

// In-memory cache variables to optimize server performance
let cachedSnapshot: any = null;
let lastCacheTime = 0;
let cacheGeneration = 0;
const CACHE_TTL = 15000; // 15 giây TTL dự phòng an toàn

export function invalidateStoreCache() {
  cachedSnapshot = null;
  lastCacheTime = 0;
  cacheGeneration++;
}

export async function storeSnapshotFromDb(db: Queryable, forceBypassCache = false) {
  const now = Date.now();
  if (!forceBypassCache && cachedSnapshot && (now - lastCacheTime < CACHE_TTL)) {
    return cachedSnapshot;
  }
  const generationAtStart = cacheGeneration;
  const [
    usersRes,
    coursesRes,
    lessonsRes,
    enrollmentsRes,
    lessonProgressRes,
    quizzesRes,
    questionsRes,
    quizAttemptsRes,
    assignmentsRes,
    submissionsRes
  ] = await Promise.all([
    db.query<DbUserRow>("SELECT * FROM users"),
    db.query("SELECT * FROM courses"),
    db.query("SELECT * FROM lessons"),
    db.query("SELECT * FROM enrollments"),
    db.query("SELECT * FROM lesson_progress"),
    db.query("SELECT * FROM quizzes"),
    db.query("SELECT * FROM questions ORDER BY created_at ASC"),
    db.query("SELECT * FROM quiz_attempts"),
    db.query("SELECT * FROM assignments"),
    db.query("SELECT * FROM submissions")
  ]);

  const [
    auditLogsRes,
    attendanceSessionsRes,
    attendanceRecordsRes,
    notificationsRes,
    transactionsRes
  ] = await Promise.all([
    db.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200"),
    db.query("SELECT * FROM attendance_sessions"),
    db.query("SELECT * FROM attendance_records"),
    db.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200"),
    db.query("SELECT * FROM transactions ORDER BY created_at DESC")
  ]);

  const [
    courseSectionsRes,
    courseRegistrationsRes,
    certificatesRes,
    forumRepliesRes,
    forumPostsRes,
    teacherAttendanceRes,
    sessionMaterialsRes
  ] = await Promise.all([
    db.query("SELECT * FROM course_sections"),
    db.query("SELECT * FROM course_registrations"),
    db.query("SELECT * FROM certificates"),
    db.query("SELECT * FROM forum_replies"),
    db.query("SELECT * FROM forum_posts"),
    db.query("SELECT * FROM teacher_attendance"),
    db.query("SELECT * FROM session_materials ORDER BY session_id, sort_order, created_at")
  ]);

  const users = usersRes.rows.map(toPublicUser);
  const courses = coursesRes.rows.map(courseFromRow);
  const lessons = lessonsRes.rows.map(row => ({ id: row.id, courseId: row.course_id, title: row.title, content: row.content, videoUrl: row.video_url || undefined, order: row.lesson_order, duration: row.duration }));
  const enrollments = enrollmentsRes.rows.map(enrollmentFromRow);
  const lessonProgress = lessonProgressRes.rows.map(row => ({ id: row.id, enrollmentId: row.enrollment_id, lessonId: row.lesson_id, completed: Boolean(row.completed), completedAt: row.completed_at || undefined }));
  const quizzes = quizzesRes.rows.map(quizFromRow);
  const questions = questionsRes.rows.map(questionFromRow);
  const quizAttempts = quizAttemptsRes.rows.map(quizAttemptFromRow);
  const assignments = assignmentsRes.rows.map(assignmentFromRow);
  const submissions = submissionsRes.rows.map(submissionFromRow);
  const auditLogs = auditLogsRes.rows.map(row => ({ id: row.id, userId: row.user_id, action: row.action, target: row.target, detail: row.detail || "", createdAt: row.created_at }));

  const attendanceSessions = attendanceSessionsRes.rows.map(row => ({
    id: row.id,
    courseId: row.course_id,
    sectionId: row.section_id || undefined,
    teacherId: row.teacher_id,
    date: row.date || row.session_date,
    topic: row.topic,
    videoUrl: row.video_url || undefined,
    recordingUrl: row.recording_url || undefined,
    content: row.content || undefined,
    code: row.code || undefined,
    expiresAt: row.expires_at || undefined
  }));
  const attendanceRecords = attendanceRecordsRes.rows.map(row => ({ id: row.id, sessionId: row.session_id, studentId: row.student_id, status: row.status, note: row.note || undefined, checkedInAt: row.checked_in_at || undefined, checkinMethod: row.checkin_method || undefined }));
  const sessionMaterials = sessionMaterialsRes.rows.map(sessionMaterialFromRow);
  const notifications = notificationsRes.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    relatedEntityType: row.related_entity_type || undefined,
    relatedEntityId: row.related_entity_id || undefined
  }));
  const transactions = transactionsRes.rows.map(row => ({ id: row.id, studentId: row.student_id, courseId: row.course_id || "", amount: Number(row.amount), status: row.status, paymentMethod: row.payment_method, createdAt: row.created_at, processedAt: row.processed_at || undefined, processedBy: row.processed_by || undefined, notes: row.notes || undefined }));

  const courseSections = courseSectionsRes.rows.map(courseSectionFromRow);
  const courseRegistrations = courseRegistrationsRes.rows.map(row => ({ id: row.id, studentId: row.student_id, sectionId: row.section_id, status: row.status, registeredAt: row.registered_at, droppedAt: row.dropped_at || undefined, grade: row.grade || undefined, letterGrade: row.letter_grade || undefined, gradePoint: row.grade_point === null ? undefined : Number(row.grade_point), credits: row.credits, isRetake: Boolean(row.is_retake) }));
  const certificates = certificatesRes.rows.map(row => ({ id: row.id, enrollmentId: row.enrollment_id, studentId: row.student_id, courseId: row.course_id, issuedAt: row.issued_at, certificateCode: row.certificate_code }));

  const forumReplies = forumRepliesRes.rows.map(row => ({ id: row.id, postId: row.post_id, authorId: row.author_id, content: row.content, createdAt: row.created_at }));
  const forumPosts = forumPostsRes.rows.map(row => {
    const postReplies = forumReplies.filter(r => r.postId === row.id);
    return { id: row.id, courseId: row.course_id, sectionId: row.section_id || undefined, authorId: row.author_id, title: row.title, content: row.content, replies: postReplies, createdAt: row.created_at };
  });

  const teacherAttendance = teacherAttendanceRes.rows.map(row => ({
    id: row.id,
    teacherId: row.teacher_id,
    courseId: row.course_id,
    sectionId: row.section_id,
    classDate: row.class_date,
    slotTime: row.slot_time,
    status: row.status,
    checkedInAt: row.checked_in_at
  }));

  const snapshot = {
    ...getInitialStore(),
    users,
    courses,
    lessons,
    enrollments,
    lessonProgress,
    quizzes,
    questions,
    quizAttempts,
    assignments,
    submissions,
    auditLogs,
    attendanceSessions,
    attendanceRecords,
    notifications,
    transactions,
    courseSections,
    courseRegistrations,
    certificates,
    forumPosts,
    teacherAttendance,
    sessionMaterials
  };

  if (generationAtStart === cacheGeneration) {
    cachedSnapshot = snapshot;
    lastCacheTime = Date.now();
  }
  return snapshot;
}

export function limitStoreForRole(store: any, user: User) {
  const safeUser = (item: User) => ({ ...item, passwordHash: "" });
  const sanitizeQuestion = (item: any) => ({ ...item, correctAnswer: "" });
  const sanitizeLessonPreview = (item: any) => ({ ...item, content: "", videoUrl: undefined });
  const sanitizeAttendanceSession = (item: any) => ({ ...item, code: undefined });
  const baseScopedStore = () => ({
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
    attendanceSessions: [],
    attendanceRecords: [],
    courseSections: [],
    courseRegistrations: [],
    systemEvents: [],
    teacherAttendance: [],
    sessionMaterials: []
  });

  if (user.role === "admin") {
    return {
      ...store,
      users: store.users.map(safeUser)
    };
  }

  if (user.role === "teacher") {
    const teacherCourseIds = new Set(store.courses.filter((course: Course) => course.teacherId === user.id).map((course: Course) => course.id));
    const visibleEnrollments = store.enrollments.filter((item: Enrollment) => teacherCourseIds.has(item.courseId));
    const visibleStudentIds = new Set(visibleEnrollments.map((item: Enrollment) => item.studentId));
    const mySections = new Set((store.courseSections || [])
      .filter((cs: any) => cs.teacherId === user.id)
      .map((cs: any) => cs.id)
    );
    const visibleQuizIds = new Set(store.quizzes.filter((quiz: any) => teacherCourseIds.has(quiz.courseId)).map((quiz: any) => quiz.id));
    const visibleAssignmentIds = new Set(store.assignments.filter((assignment: any) => teacherCourseIds.has(assignment.courseId)).map((assignment: any) => assignment.id));
    const visibleSessionIds = new Set((store.attendanceSessions || [])
      .filter((session: any) => teacherCourseIds.has(session.courseId) || mySections.has(session.sectionId))
      .map((session: any) => session.id));
    const visibleUserIds = new Set<string>([user.id]);
    visibleStudentIds.forEach((studentId: any) => visibleUserIds.add(studentId));
    return {
      ...baseScopedStore(),
      users: store.users.filter((item: User) => visibleUserIds.has(item.id)).map(safeUser),
      courses: store.courses.filter((course: Course) => teacherCourseIds.has(course.id)),
      lessons: store.lessons.filter((lesson: any) => teacherCourseIds.has(lesson.courseId)),
      enrollments: visibleEnrollments,
      lessonProgress: store.lessonProgress.filter((item: LessonProgress) => visibleEnrollments.some((enroll: Enrollment) => enroll.id === item.enrollmentId)),
      quizzes: store.quizzes.filter((quiz: any) => teacherCourseIds.has(quiz.courseId)),
      questions: store.questions.filter((question: any) => visibleQuizIds.has(question.quizId)),
      quizAttempts: store.quizAttempts.filter((attempt: any) => visibleStudentIds.has(attempt.studentId) && visibleQuizIds.has(attempt.quizId)),
      assignments: store.assignments.filter((assignment: any) => teacherCourseIds.has(assignment.courseId)),
      submissions: store.submissions.filter((submission: any) => visibleStudentIds.has(submission.studentId) && visibleAssignmentIds.has(submission.assignmentId)),
      attendanceSessions: (store.attendanceSessions || []).filter((session: any) => visibleSessionIds.has(session.id)),
      sessionMaterials: (store.sessionMaterials || []).filter((material: any) => visibleSessionIds.has(material.sessionId)),
      attendanceRecords: (store.attendanceRecords || []).filter((record: any) => visibleSessionIds.has(record.sessionId) && visibleStudentIds.has(record.studentId)),
      notifications: (store.notifications || []).filter((item: any) => item.userId === user.id),
      courseSections: (store.courseSections || []).filter((section: any) => mySections.has(section.id)),
      courseRegistrations: (store.courseRegistrations || []).filter((registration: any) => visibleStudentIds.has(registration.studentId) || mySections.has(registration.sectionId)),
      teacherAttendance: (store.teacherAttendance || []).filter((ta: any) => ta.teacherId === user.id),
      certificates: (store.certificates || []).filter((cert: any) => teacherCourseIds.has(cert.courseId)),
      forumPosts: (store.forumPosts || []).filter((post: any) => teacherCourseIds.has(post.courseId) && (!post.sectionId || mySections.has(post.sectionId)))
    };
  }

  if (user.role === "student") {
    const myEnrollments = store.enrollments.filter((item: Enrollment) => item.studentId === user.id);
    const myCourseIds = new Set(myEnrollments.map((item: Enrollment) => item.courseId));
    const activeCourseIds = new Set(myEnrollments
      .filter((item: Enrollment) => item.status === "active" || item.status === "completed")
      .map((item: Enrollment) => item.courseId));
    const publicCourseIds = new Set(store.courses
      .filter((course: Course) => course.status === "published")
      .map((course: Course) => course.id));
    const visibleCourseIds = new Set([...publicCourseIds, ...myCourseIds]);
    const visibleQuizzes = store.quizzes.filter((quiz: any) => activeCourseIds.has(quiz.courseId));
    const visibleQuizIds = new Set(visibleQuizzes.map((quiz: any) => quiz.id));
    const visibleAssignmentIds = new Set(store.assignments
      .filter((assignment: any) => activeCourseIds.has(assignment.courseId))
      .map((assignment: any) => assignment.id));
    const myRegisteredSections = new Set((store.courseRegistrations || [])
      .filter((cr: any) => cr.studentId === user.id && cr.status === "registered")
      .map((cr: any) => cr.sectionId)
    );
    const visibleSessionIds = new Set((store.attendanceSessions || [])
      .filter((session: any) => activeCourseIds.has(session.courseId) && (!session.sectionId || myRegisteredSections.has(session.sectionId)))
      .map((session: any) => session.id));
    const visibleTeacherIds = new Set(store.courses
      .filter((course: Course) => visibleCourseIds.has(course.id))
      .map((course: Course) => course.teacherId));
    return {
      ...baseScopedStore(),
      users: store.users.filter((item: User) => item.id === user.id || visibleTeacherIds.has(item.id)).map(safeUser),
      courses: store.courses.filter((course: Course) => visibleCourseIds.has(course.id)),
      lessons: store.lessons
        .filter((lesson: any) => visibleCourseIds.has(lesson.courseId))
        .map((lesson: any) => activeCourseIds.has(lesson.courseId) ? lesson : sanitizeLessonPreview(lesson)),
      enrollments: myEnrollments,
      lessonProgress: store.lessonProgress.filter((item: LessonProgress) => myEnrollments.some((enroll: Enrollment) => enroll.id === item.enrollmentId)),
      quizzes: visibleQuizzes,
      questions: store.questions.filter((question: any) => visibleQuizIds.has(question.quizId)).map(sanitizeQuestion),
      quizAttempts: store.quizAttempts.filter((item: any) => item.studentId === user.id),
      submissions: store.submissions.filter((item: any) => item.studentId === user.id),
      assignments: store.assignments.filter((item: any) => visibleAssignmentIds.has(item.id)),
      attendanceSessions: (store.attendanceSessions || []).filter((session: any) => visibleSessionIds.has(session.id)).map(sanitizeAttendanceSession),
      sessionMaterials: (store.sessionMaterials || []).filter((material: any) => visibleSessionIds.has(material.sessionId)),
      attendanceRecords: (store.attendanceRecords || []).filter((record: any) => record.studentId === user.id),
      notifications: store.notifications.filter((item: any) => item.userId === user.id),
      transactions: (store.transactions || []).filter((item: any) => item.studentId === user.id),
      // Every open class is listed for registration, but meeting/group links only reach learners placed in that class.
      courseSections: (store.courseSections || [])
        .filter((section: any) => visibleCourseIds.has(section.courseId) || myRegisteredSections.has(section.id))
        .map((section: any) => myRegisteredSections.has(section.id) ? section : { ...section, meetingUrl: undefined, groupChatUrl: undefined }),
      courseRegistrations: (store.courseRegistrations || []).filter((item: any) => item.studentId === user.id),
      teacherAttendance: (store.teacherAttendance || []).filter((item: any) => activeCourseIds.has(item.courseId) && (!item.sectionId || myRegisteredSections.has(item.sectionId))),
      certificates: (store.certificates || []).filter((cert: any) => cert.studentId === user.id),
      forumPosts: (store.forumPosts || []).filter((post: any) => myCourseIds.has(post.courseId) && (!post.sectionId || myRegisteredSections.has(post.sectionId)))
    };
  }

  return {
    ...baseScopedStore(),
    users: store.users.filter((item: User) => item.id === user.id).map(safeUser)
  };
}
