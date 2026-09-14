import { User, Course, StudentProfile, LMSDataStore } from "./types";
import { hashPassword } from "./authHash";
import { recomputeAndPersistAllGpas } from "./store";

const credential = (password: string, salt: string) => hashPassword(password, salt);

export function backfillMegaDemoData(store: LMSDataStore) {
  // 0. Generate specific students with distinct statuses for explicit business logic testing
  const specificStudentsData = [
    {
      id: "user_student_active",
      email: "student_active@mcna.local",
      name: "Nguyễn Văn Chủ Động (Active)",
      status: "active" as const,
      gpa: 3.2,
      credits: 45,
      notes: "Sinh viên đang học bình thường."
    },
    {
      id: "user_student_on_leave",
      email: "student_on_leave@mcna.local",
      name: "Trần Thị Bảo Lưu (On Leave)",
      status: "on-leave" as const,
      gpa: 2.8,
      credits: 30,
      notes: "Sinh viên xin bảo lưu tháng này."
    },
    {
      id: "user_student_suspended",
      email: "student_suspended@mcna.local",
      name: "Lê Văn Đình Chỉ (Suspended)",
      status: "suspended" as const,
      gpa: 1.8,
      credits: 24,
      notes: "Sinh viên bị đình chỉ học tập."
    },
    {
      id: "user_student_graduated",
      email: "student_graduated@mcna.local",
      name: "Phạm Minh Tốt Nghiệp (Graduated)",
      status: "graduated" as const,
      gpa: 3.6,
      credits: 120,
      notes: "Sinh viên tốt nghiệp xuất sắc."
    },
    {
      id: "user_student_withdrawn",
      email: "student_withdrawn@mcna.local",
      name: "Hoàng An Thôi Học (Withdrawn)",
      status: "withdrawn" as const,
      gpa: 1.5,
      credits: 10,
      notes: "Sinh viên đã thôi học tự nguyện."
    }
  ];

  specificStudentsData.forEach((s, idx) => {
    if (!store.users.some(u => u.id === s.id)) {
      store.users.push({
        id: s.id,
        email: s.email,
        passwordHash: credential("studente16", `seed_${s.id}`).hash,
        passwordSalt: credential("studente16", `seed_${s.id}`).salt,
        name: s.name,
        role: "student",
        isActive: s.status !== "suspended",
        createdAt: new Date("2026-01-03T00:00:00Z").toISOString(),
        phone: "09" + Math.floor(10000000 + Math.random() * 90000000)
      });

      if (!store.studentProfiles) store.studentProfiles = [];
      store.studentProfiles.push({
        id: `profile_${s.id}`,
        userId: s.id,
        studentCode: `SV202410${idx + 1}`,
        programId: "prog_se",
        departmentId: "dept_cs",
        academicYear: s.status === "graduated" ? 4 : 2,
        enrollmentDate: "2024-09-01",
        expectedGraduation: "2028-06-30",
        status: s.status,
        gpa: s.gpa,
        totalCreditsEarned: s.credits,
        address: "Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
        phone: "091234567" + idx,
        dateOfBirth: "2004-03-15",
        gender: idx % 2 === 0 ? "Nam" : "Nữ",
        notes: s.notes
      });

      if (!store.advisorAssignments) store.advisorAssignments = [];
      if (!store.advisorAssignments.some(aa => aa.studentId === s.id)) {
        store.advisorAssignments.push({
          id: `aa_${s.id}`,
          advisorId: "user_advisor",
          studentId: s.id,
          semesterId: "sem_spring25",
          assignedAt: new Date("2026-02-01T00:00:00Z").toISOString()
        });
      }

      if (!store.academicWarnings) store.academicWarnings = [];
      if (s.gpa < 2.0) {
        store.academicWarnings.push({
          id: `warn_${s.id}_low_gpa`,
          studentId: s.id,
          type: "low_gpa",
          message: `Cảnh báo học tập: Điểm trung bình GPA tích lũy (${s.gpa}) ở dưới ngưỡng quy định.`,
          isResolved: false,
          createdAt: new Date("2026-05-15T09:00:00Z").toISOString()
        });
      }

      // Seeding detailed scores, grades, lesson progress, quiz attempts and submissions
      if (!store.enrollments) store.enrollments = [];
      if (!store.lessonProgress) store.lessonProgress = [];
      if (!store.quizzes) store.quizzes = [];
      if (!store.quizAttempts) store.quizAttempts = [];
      if (!store.submissions) store.submissions = [];
      if (!store.courseRegistrations) store.courseRegistrations = [];
      if (!store.attendanceRecords) store.attendanceRecords = [];

      if (s.id === "user_student_active") {
        store.enrollments.push({
          id: "enroll_student_active_fsweb",
          courseId: "course_fsweb",
          studentId: s.id,
          status: "active",
          enrolledAt: new Date("2026-02-15T09:00:00Z").toISOString()
        });
        store.lessonProgress.push(
          { id: "progress_student_active_fs1", enrollmentId: "enroll_student_active_fsweb", lessonId: "lesson_fs1", completed: true, completedAt: new Date("2026-02-20T10:00:00Z").toISOString() },
          { id: "progress_student_active_fs2", enrollmentId: "enroll_student_active_fsweb", lessonId: "lesson_fs2", completed: true, completedAt: new Date("2026-02-22T11:00:00Z").toISOString() }
        );
        store.quizAttempts.push({
          id: "attempt_student_active_fsweb_end",
          quizId: "quiz_fsweb",
          studentId: s.id,
          answers: { "q_fs1": "2", "q_fs2": "1" },
          score: 85,
          passed: true,
          startedAt: new Date("2026-03-01T14:00:00Z").toISOString(),
          submittedAt: new Date("2026-03-01T14:12:00Z").toISOString()
        });
        store.submissions.push({
          id: "submit_student_active_assign_calc",
          assignmentId: "assign_calc",
          studentId: s.id,
          content: "Bài làm thực hành của sinh viên Active. Đầy đủ chức năng, xử lý lỗi tốt.",
          score: 90,
          feedback: "Bài nộp rất xuất sắc, mã nguồn sạch đẹp.",
          submittedAt: new Date("2026-03-05T15:00:00Z").toISOString(),
          gradedAt: new Date("2026-03-07T10:00:00Z").toISOString()
        });
        store.courseRegistrations.push({
          id: "cr_student_active_fsweb",
          studentId: s.id,
          sectionId: "section_cs101_01",
          semesterId: "sem_spring25",
          status: "registered",
          registeredAt: "2025-01-05T09:00:00Z",
          credits: 4
        });
        store.attendanceRecords.push(
          { id: "ar_student_active_session_cs1", sessionId: "session_cs1", studentId: s.id, status: "present", note: "Tham gia đầy đủ" },
          { id: "ar_student_active_session_cs2", sessionId: "session_cs2", studentId: s.id, status: "present", note: "Tham gia đầy đủ" },
          { id: "ar_student_active_session_cs3", sessionId: "session_cs3", studentId: s.id, status: "present", note: "Tham gia đầy đủ" }
        );
      }

      if (s.id === "user_student_on_leave") {
        store.enrollments.push({
          id: "enroll_student_on_leave_fsweb",
          courseId: "course_fsweb",
          studentId: s.id,
          status: "active",
          enrolledAt: new Date("2026-02-15T09:00:00Z").toISOString()
        });
        store.courseRegistrations.push({
          id: "cr_student_on_leave_fsweb",
          studentId: s.id,
          sectionId: "section_cs101_01",
          semesterId: "sem_spring25",
          status: "dropped",
          registeredAt: "2025-01-05T09:00:00Z",
          droppedAt: "2026-02-28T10:00:00Z",
          credits: 4
        });
        store.attendanceRecords.push(
          { id: "ar_student_on_leave_session_cs1", sessionId: "session_cs1", studentId: s.id, status: "excused", note: "Bảo lưu có phép" },
          { id: "ar_student_on_leave_session_cs2", sessionId: "session_cs2", studentId: s.id, status: "excused", note: "Bảo lưu có phép" },
          { id: "ar_student_on_leave_session_cs3", sessionId: "session_cs3", studentId: s.id, status: "excused", note: "Bảo lưu có phép" }
        );
      }

      if (s.id === "user_student_suspended") {
        store.enrollments.push({
          id: "enroll_student_suspended_fsweb",
          courseId: "course_fsweb",
          studentId: s.id,
          status: "active",
          enrolledAt: new Date("2026-02-15T09:00:00Z").toISOString()
        });
        store.quizAttempts.push({
          id: "attempt_student_suspended_fsweb_end",
          quizId: "quiz_fsweb",
          studentId: s.id,
          answers: { "q_fs1": "0", "q_fs2": "0" },
          score: 45,
          passed: false,
          startedAt: new Date("2026-03-01T14:00:00Z").toISOString(),
          submittedAt: new Date("2026-03-01T14:12:00Z").toISOString()
        });
        store.submissions.push({
          id: "submit_student_suspended_assign_calc",
          assignmentId: "assign_calc",
          studentId: s.id,
          content: "Nộp bài sơ sài, thiếu nhiều thành phần cốt lõi.",
          score: 35,
          feedback: "Mã nguồn bị lỗi crash, chưa đáp ứng yêu cầu tối thiểu.",
          submittedAt: new Date("2026-03-05T15:00:00Z").toISOString(),
          gradedAt: new Date("2026-03-07T10:00:00Z").toISOString()
        });
        store.courseRegistrations.push({
          id: "cr_student_suspended_fsweb",
          studentId: s.id,
          sectionId: "section_cs101_01",
          semesterId: "sem_spring25",
          status: "failed",
          registeredAt: "2025-01-05T09:00:00Z",
          credits: 4,
          grade: "35",
          letterGrade: "F",
          gradePoint: 0.0,
          gradePostedAt: "2026-03-07T10:00:00Z"
        });
        store.attendanceRecords.push(
          { id: "ar_student_suspended_session_cs1", sessionId: "session_cs1", studentId: s.id, status: "absent", note: "Vắng không lý do" },
          { id: "ar_student_suspended_session_cs2", sessionId: "session_cs2", studentId: s.id, status: "absent", note: "Vắng không lý do" },
          { id: "ar_student_suspended_session_cs3", sessionId: "session_cs3", studentId: s.id, status: "late", note: "Đi muộn 30 phút" }
        );
        store.academicWarnings.push({
          id: `warn_${s.id}_low_attendance`,
          studentId: s.id,
          type: "low_attendance",
          message: "Cảnh báo chuyên cần: Tỉ lệ chuyên cần môn Full-Stack của bạn hiện tại là 33% (dưới mốc tối thiểu 80%).",
          isResolved: false,
          createdAt: new Date("2026-05-18T10:00:00Z").toISOString()
        });
      }

      if (s.id === "user_student_graduated") {
        store.enrollments.push(
          { id: "enroll_student_graduated_fsweb", courseId: "course_fsweb", studentId: s.id, status: "completed", enrolledAt: new Date("2025-09-01T09:00:00Z").toISOString(), completedAt: new Date("2026-01-15T15:00:00Z").toISOString() },
          { id: "enroll_student_graduated_python", courseId: "course_python", studentId: s.id, status: "completed", enrolledAt: new Date("2025-09-01T09:00:00Z").toISOString(), completedAt: new Date("2026-01-15T15:00:00Z").toISOString() }
        );
        store.lessonProgress.push(
          { id: "progress_student_graduated_fs1", enrollmentId: "enroll_student_graduated_fsweb", lessonId: "lesson_fs1", completed: true, completedAt: new Date("2025-09-10T10:00:00Z").toISOString() },
          { id: "progress_student_graduated_fs2", enrollmentId: "enroll_student_graduated_fsweb", lessonId: "lesson_fs2", completed: true, completedAt: new Date("2025-09-12T11:00:00Z").toISOString() },
          { id: "progress_student_graduated_fs3", enrollmentId: "enroll_student_graduated_fsweb", lessonId: "lesson_fs3", completed: true, completedAt: new Date("2025-09-15T12:00:00Z").toISOString() },
          { id: "progress_student_graduated_py1", enrollmentId: "enroll_student_graduated_python", lessonId: "lesson_py1", completed: true, completedAt: new Date("2025-09-20T10:00:00Z").toISOString() }
        );
        store.quizAttempts.push(
          { id: "attempt_student_graduated_fsweb", quizId: "quiz_fsweb", studentId: s.id, answers: { "q_fs1": "2", "q_fs2": "1" }, score: 95, passed: true, startedAt: new Date("2025-10-01T14:00:00Z").toISOString(), submittedAt: new Date("2025-10-01T14:12:00Z").toISOString() },
          { id: "attempt_student_graduated_python", quizId: "quiz_course_python", studentId: s.id, answers: {}, score: 90, passed: true, startedAt: new Date("2025-10-05T14:00:00Z").toISOString(), submittedAt: new Date("2025-10-05T14:12:00Z").toISOString() }
        );
        store.submissions.push({
          id: "submit_student_graduated_assign_calc",
          assignmentId: "assign_calc",
          studentId: s.id,
          content: "Mã nguồn đồ án tốt nghiệp xuất sắc.",
          score: 98,
          feedback: "Mã nguồn tuyệt vời, đạt điểm tối đa.",
          submittedAt: new Date("2025-10-10T15:00:00Z").toISOString(),
          gradedAt: new Date("2025-10-12T10:00:00Z").toISOString()
        });
        store.courseRegistrations.push(
          { id: "cr_student_graduated_fsweb", studentId: s.id, sectionId: "section_cs101_01", semesterId: "sem_spring25", status: "completed", registeredAt: "2025-01-05T09:00:00Z", credits: 4, grade: "95", letterGrade: "A", gradePoint: 4.0, gradePostedAt: "2025-10-12T10:00:00Z" },
          { id: "cr_student_graduated_python", studentId: s.id, sectionId: "section_bus201_01", semesterId: "sem_spring25", status: "completed", registeredAt: "2025-01-05T09:00:00Z", credits: 3, grade: "90", letterGrade: "A", gradePoint: 4.0, gradePostedAt: "2025-10-12T10:00:00Z" }
        );
        store.attendanceRecords.push(
          { id: "ar_student_graduated_session_cs1", sessionId: "session_cs1", studentId: s.id, status: "present" },
          { id: "ar_student_graduated_session_cs2", sessionId: "session_cs2", studentId: s.id, status: "present" },
          { id: "ar_student_graduated_session_cs3", sessionId: "session_cs3", studentId: s.id, status: "present" }
        );
        
        if (!store.officialTranscripts) store.officialTranscripts = [];
        store.officialTranscripts.push({
          id: "transcript_student_graduated",
          studentId: s.id,
          cumulativeGpa: 3.6,
          totalCredits: 120,
          generatedAt: new Date().toISOString(),
          entries: [
            { courseId: "course_fsweb", courseName: "Full-Stack Web Development Bootcamp", credits: 4, grade: 95, letterGrade: "A", semesterId: "sem_spring25" },
            { courseId: "course_python", courseName: "Introduction to Python Analytics", credits: 3, grade: 90, letterGrade: "A", semesterId: "sem_spring25" }
          ]
        });
      }

      if (s.id === "user_student_withdrawn") {
        store.enrollments.push({
          id: "enroll_student_withdrawn_fsweb",
          courseId: "course_fsweb",
          studentId: s.id,
          status: "cancelled",
          enrolledAt: new Date("2026-02-15T09:00:00Z").toISOString()
        });
        store.courseRegistrations.push({
          id: "cr_student_withdrawn_fsweb",
          studentId: s.id,
          sectionId: "section_cs101_01",
          semesterId: "sem_spring25",
          status: "withdrawn",
          registeredAt: "2025-01-05T09:00:00Z",
          droppedAt: "2026-02-28T10:00:00Z",
          credits: 4
        });
        store.attendanceRecords.push(
          { id: "ar_student_withdrawn_session_cs1", sessionId: "session_cs1", studentId: s.id, status: "absent" },
          { id: "ar_student_withdrawn_session_cs2", sessionId: "session_cs2", studentId: s.id, status: "absent" },
          { id: "ar_student_withdrawn_session_cs3", sessionId: "session_cs3", studentId: s.id, status: "absent" }
        );
      }
    }
  });

  const currentStudentsCount = store.users.filter(u => u.role === "student").length;
  // If the directory of students is already fully seeded, do not regenerate
  if (currentStudentsCount >= 100) {
    return;
  }

  // Surnames, middles, and givennames in Vietnamese for authentic mock records
  const surnames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
  const middlenames = ["Văn", "Thị", "Quang", "Minh", "Hồng", "Khánh", "Tuấn", "Thanh", "Ngọc", "Hải", "Anh", "Đức", "Công", "Xuân", "Phương"];
  const givennames = ["Hùng", "Hải", "Sơn", "Trung", "Nam", "Bắc", "Trang", "Linh", "Thảo", "Hương", "Anh", "Duy", "Phương", "Cường", "Tuấn", "Vy", "Yến", "Lan", "Phong", "Khoa"];

  const generateName = () => {
    const s = surnames[Math.floor(Math.random() * surnames.length)];
    const m = middlenames[Math.floor(Math.random() * middlenames.length)];
    const g = givennames[Math.floor(Math.random() * givennames.length)];
    return `${s} ${m} ${g}`;
  };

  // 1. Double check Admin presence
  const hasAdmin = store.users.some(u => u.role === "admin");
  if (!hasAdmin) {
    store.users.push({
      id: "user_super_admin",
      email: "superadmin@e16.local",
      passwordHash: credential("superadmin16", "seed_super_admin").hash,
      passwordSalt: credential("superadmin16", "seed_super_admin").salt,
      name: "Trần Anh Khoa (Quản Trị Viên)",
      role: "admin",
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00Z").toISOString()
    });
  }

  // 2. Generate 19 more Teachers to make 20 total
  const teachersCountToGen = 20 - store.users.filter(u => u.role === "teacher").length;
  const newTeachers: User[] = [];
  for (let i = 1; i <= teachersCountToGen; i++) {
    const name = "Thầy/Cô " + generateName();
    const tId = `teacher_gen_${i}`;
    newTeachers.push({
      id: tId,
      email: `teacher_${i}@e16.local`,
      passwordHash: credential("teachere16", `seed_teacher_gen_${i}`).hash,
      passwordSalt: credential("teachere16", `seed_teacher_gen_${i}`).salt,
      name,
      role: "teacher",
      isActive: true,
      createdAt: new Date("2026-01-02T00:00:00Z").toISOString()
    });
  }
  store.users.push(...newTeachers);

  const allTeachers = store.users.filter(u => u.role === "teacher");

  // 3. Generate 37 more Courses to make 40 total
  const coursesCountToGen = 40 - store.courses.length;
  const courseTitles = [
    "Cấu trúc dữ liệu và giải thuật áp dụng",
    "Lập trình hướng đối tượng chuyên sâu",
    "Cơ sở dữ liệu NoSQL & Distributed Cache",
    "Kỹ thuật kiểm thử & Jenkins CI/CD pipeline",
    "Phát triển ứng dụng đám mây AWS",
    "Trí tuệ nhân tạo và ứng dụng NLP",
    "An toàn mạng máy tính và mã hóa đầu cuối",
    "Phân tích tài chính doanh nghiệp nâng cao",
    "Lập trình ứng dụng di động React Native",
    "Xây dựng và tối ưu hóa truy vấn SQL",
    "Thiết kế kiến trúc hệ thống Microservices",
    "Hành vi người dùng & Thiết kế UI/UX",
    "Giải pháp Blockchain & Ethereum Smart Contract",
    "Khai thác và phân tích Big Data",
    "Kỹ thuật lập trình sạch Clean Code",
    "Hệ thống điều hành phân tán",
    "Lập trình trò chơi Unity 3D cơ bản",
    "Điện toán đám mây Docker & Kubernetes",
    "Kế toán quản trị và Thuế chuyên sâu",
    "Hệ thống thông tin quản lý kinh tế",
    "Phân tích rủi ro & Bảo hiểm tài chính",
    "Khởi nghiệp đổi mới sáng tạo số",
    "Thương mại điện tử & Phễu tối ưu Marketing",
    "Quản lý chuỗi cung ứng Logistics toàn cầu",
    "Kỹ năng mềm cho kỹ sư phần mềm",
    "Lập trình ứng dụng Web với NestJS",
    "Đại số tuyến tính hướng ứng dụng Máy học",
    "Lý thuyết mật mã học và bảo mật",
    "Phát triển ứng dụng Web Frontend với Vue.js 3",
    "Lập trình Python Core & Cơ bản",
    "Trải nghiệm trò chơi & Kỹ thuật Shader",
    "Phác thảo đồ họa và hoạt cảnh 2D",
    "Tối ưu hiệu suất Server Node.js",
    "Ngôn ngữ Go cho phát triển Network Service",
    "Phát triển ứng dụng Cross-platform với Flutter",
    "Công nghệ IoT & Lập trình nhúng Arduino",
    "Kiểm toán độc lập và Quản trị doanh nghiệp"
  ];

  const categories = ["Web Development", "Software Engineering", "Data Science", "System Administration", "Artificial Intelligence", "Business Management", "Finance"];
  const levels = ["Cơ bản", "Trung cấp", "Nâng cao"] as const;

  const newCourses: Course[] = [];
  for (let i = 0; i < coursesCountToGen; i++) {
    const cId = `course_gen_${i}`;
    const t = allTeachers[Math.floor(Math.random() * allTeachers.length)];
    const title = courseTitles[i % courseTitles.length];
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const level = levels[Math.floor(Math.random() * levels.length)];
    
    newCourses.push({
      id: cId,
      title,
      description: `Khóa học toàn diện về ${title}, trang bị kỹ năng chuyên ngành và thực hành qua hệ thống Lab SIS hiện đại. Thích hợp cho cả sinh viên học lại và nghiên cứu nâng cao.`,
      teacherId: t.id,
      status: "published",
      category: cat,
      price: 1500000 + Math.floor(Math.random() * 5) * 500000,
      level,
      tags: [cat.split(" ")[0] || "General", "E16", "SIS"],
      createdAt: new Date("2026-01-10T00:00:00Z").toISOString(),
      thumbnail: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 900000000)}?w=600&auto=format&fit=crop&q=60`
    });
  }
  store.courses.push(...newCourses);

  const allCourses = store.courses;

  // Make sure each course has custom lessons, quizzes, and questions
  allCourses.forEach((course) => {
    const hasLesson = store.lessons.some(l => l.courseId === course.id);
    if (!hasLesson) {
      store.lessons.push({
        id: `lesson_en_${course.id}_1`,
        courseId: course.id,
        title: "1. Tổng quan lý thuyết & Định vị kiến thức",
        content: `Chào mừng các bạn đến với khóa học: ${course.title}. Đây là chương đệm sơ bộ về các ranh giới kiến thức cốt lõi. Hãy làm bài tập đầy đủ để được cấp chứng nhận.`,
        order: 1,
        duration: "20 mins"
      });
      store.lessons.push({
        id: `lesson_en_${course.id}_2`,
        courseId: course.id,
        title: "2. Thực hành cấu hình trực tiếp phòng Lab",
        content: "Nội dung nâng cao hướng dẫn từng bước cấu tạo hệ thống cục bộ, triển khai qua Docker container.",
        order: 2,
        duration: "30 mins"
      });
    }

    const hasQuiz = store.quizzes.some(q => q.courseId === course.id);
    const quizId = `quiz_${course.id}`;
    if (!hasQuiz) {
      store.quizzes.push({
        id: quizId,
        courseId: course.id,
        title: `Đề thi trắc nghiệm học phần: ${course.title}`,
        passingScore: 70,
        timeLimit: 15,
        maxAttempts: 3
      });
      
      store.questions.push({
        id: `q_${course.id}_1`,
        quizId: quizId,
        text: `Nêu ưu điểm tối thượng của chương trình đào tạo học phần ${course.title}?`,
        type: "single",
        options: ["Đào tạo bám sát thực tế phát triển doanh nghiệp", "Thời gian học ngắn và không phải thi cử", "Cấp chứng chỉ miễn phí mà không cần học", "Chương trình lỗi thời không áp dụng thực tiễn"],
        correctAnswer: "0"
      });
      store.questions.push({
        id: `q_${course.id}_2`,
        quizId: quizId,
        text: "Các rào cản kỹ thuật hay lỗi hệ thống cần được xử lý như thế nào?",
        type: "single",
        options: ["Bỏ qua và không học tiếp", "Liên hệ cố vấn học tập & thầy giáo phụ trách để trợ giúp", "Tự ý thay đổi điểm số học bạ", "Gửi bài tập trống"],
        correctAnswer: "1"
      });
    }

    const hasAssignment = store.assignments.some(a => a.courseId === course.id);
    if (!hasAssignment) {
      // 1. Final term assignment
      store.assignments.push({
        id: `assign_${course.id}`,
        courseId: course.id,
        title: `Bài tập lớn thực hành cuối kỳ: ${course.title}`,
        description: "Sinh viên hoàn thành báo cáo mã nguồn, đẩy lên GitHub cá nhân và viết mô tả giải pháp chi tiết vào ô nộp bài.",
        deadline: new Date("2026-07-15T23:59:59Z").toISOString(),
        maxScore: 100,
        type: "final"
      });

      // 2. Lesson specific assignment if lessons exist
      const courseLessons = store.lessons.filter(l => l.courseId === course.id);
      if (courseLessons.length > 0) {
        store.assignments.push({
          id: `assign_lesson_${course.id}`,
          courseId: course.id,
          title: `Bài tập tự luận: Luyện tập buổi học số 1`,
          description: "Hoàn thành các bài tập thực hành nhỏ đã nêu trong phần nội dung lý thuyết của Buổi học số 1.",
          deadline: new Date("2026-06-30T23:59:59Z").toISOString(),
          maxScore: 100,
          lessonId: courseLessons[0].id,
          type: "lesson"
        });
      }
    }
  });

  // 4. Generate remaining students to satisfy requested 300 student demo state
  const studentsToGen = 300 - store.users.filter(u => u.role === "student").length;
  if (studentsToGen <= 0) return;

  const newStudents: User[] = [];
  const newProfiles: StudentProfile[] = [];

  const addresses = [
    "Số 1 Đại Cồ Việt, Bách Khoa, Hai Bà Trưng, Hà Nội",
    "227 Nguyễn Văn Cừ, Quận 5, TP. Hồ Chí Minh",
    "Khu phố 6, Linh Trung, Thủ Đức, TP. Hồ Chí Minh",
    "144 Xuân Thủy, Dịch Vọng Hậu, Cầu Giấy, Hà Nội",
    "Số 2 Trường Sa, Ngũ Hành Sơn, Đà Nẵng",
    "Lộ Vòng Cung, An Khánh, Ninh Kiều, Cần Thơ",
    "Số 1 Tô Hiệu, Lê Chân, Hải Phòng",
    "54 Nguyễn Lương Bằng, Hòa Khánh Bắc, Liên Chiểu, Đà Nẵng",
    "Phường Phú Hòa, Thủ Dầu Một, Bình Dương",
    "180 Cao Lỗ, Phường 4, Quận 8, TP. Hồ Chí Minh"
  ];

  for (let i = 1; i <= studentsToGen; i++) {
    const sId = `student_gen_${i}`;
    const name = generateName();
    
    newStudents.push({
      id: sId,
      email: `st_${i}@e16.local`,
      passwordHash: credential("studente16", `seed_student_gen_${i}`).hash,
      passwordSalt: credential("studente16", `seed_student_gen_${i}`).salt,
      name,
      role: "student",
      isActive: true,
      createdAt: new Date("2026-01-03T00:00:00Z").toISOString(),
      phone: "09" + Math.floor(10000000 + Math.random() * 90000000)
    });

    const isSeorBm = Math.random() > 0.5 ? "prog_se" : "prog_bm";
    const dep = isSeorBm === "prog_se" ? "dept_cs" : "dept_ba";
    const year = Math.floor(Math.random() * 4) + 1;
    const gpaVal = 2.0 + Math.random() * 1.95; 
    const credits = 15 + (year * 30) - Math.floor(Math.random() * 12);

    newProfiles.push({
      id: `profile_gen_${i}`,
      userId: sId,
      studentCode: `SV202${5 - year}00${String(1000 + i).slice(1)}`,
      programId: isSeorBm,
      departmentId: dep,
      academicYear: year,
      enrollmentDate: `202${5 - year}-09-01`,
      expectedGraduation: `202${9 - year}-06-30`,
      status: Math.random() > 0.08 ? "active" : Math.random() > 0.5 ? "suspended" : "on-leave",
      gpa: Number(gpaVal.toFixed(2)),
      totalCreditsEarned: credits,
      address: addresses[Math.floor(Math.random() * addresses.length)],
      phone: "09" + Math.floor(10000000 + Math.random() * 90000000),
      dateOfBirth: `200${5 - year}-04-12`,
      gender: Math.random() > 0.45 ? "Nam" : "Nữ",
      notes: "Lý lịch học sinh sinh viên chính thức."
    });
  }

  store.users.push(...newStudents);
  store.studentProfiles.push(...newProfiles);

  const activeStudentIds = store.studentProfiles
    .filter(p => p.userId.startsWith("student_gen_"))
    .map(p => p.userId);

  activeStudentIds.forEach((sId, index) => {
    store.advisorAssignments.push({
      id: `aa_gen_${index}`,
      advisorId: "user_advisor",
      studentId: sId,
      semesterId: "sem_spring25",
      assignedAt: new Date("2026-02-01T00:00:00Z").toISOString()
    });

    if (index < 30) {
      store.advisorNotes.push({
        id: `adv_note_gen_${index}`,
        advisorId: "user_advisor",
        studentId: sId,
        content: `Đã trao đổi cập nhật với gia đình tình hình rèn luyện kỳ này. Sinh viên có nỗ lực nâng điểm GPA tích lũy.`,
        type: Math.random() > 0.35 ? "academic" : "behavioral",
        createdAt: new Date("2026-05-10T12:00:00Z").toISOString()
      });
    }

    const profile = store.studentProfiles.find(pf => pf.userId === sId);
    if (profile && profile.gpa < 2.3) {
      store.academicWarnings.push({
        id: `warn_gen_${index}`,
        studentId: sId,
        type: "low_gpa",
        message: `Cảnh báo học tập: Điểm trung bình GPA hiện tại của học viên là ${profile.gpa} (dưới ngưỡng an toàn 2.50). Đề xuất trao đổi với Cố vấn học tập sớm nhất.`,
        isResolved: false,
        createdAt: new Date("2026-05-15T09:00:00Z").toISOString()
      });
    }

    const randomCourses = [...store.courses].sort(() => 0.5 - Math.random()).slice(0, 2);
    randomCourses.forEach((crs) => {
      const crsSuffix = crs.id.replace("course_", "");
      const enrollId = `enroll_gen_${sId}_${crsSuffix}`;
      store.enrollments.push({
        id: enrollId,
        courseId: crs.id,
        studentId: sId,
        status: "active",
        enrolledAt: new Date("2026-02-15T09:00:00Z").toISOString()
      });

      store.lessonProgress.push({
        id: `progress_gen_${sId}_${crsSuffix}_1`,
        enrollmentId: enrollId,
        lessonId: `lesson_en_${crs.id}_1`,
        completed: true,
        completedAt: new Date("2026-02-20T10:00:00Z").toISOString()
      });

      const score = Math.floor(65 + Math.random() * 35); 
      store.quizAttempts.push({
        id: `attempt_gen_${sId}_${crsSuffix}`,
        quizId: `quiz_${crs.id}`,
        studentId: sId,
        answers: { [`q_${crs.id}_1`]: "0", [`q_${crs.id}_2`]: "1" },
        score,
        passed: score >= 70,
        startedAt: new Date("2026-03-01T14:00:00Z").toISOString(),
        submittedAt: new Date("2026-03-01T14:12:00Z").toISOString()
      });

      const isPaid = Math.random() > 0.4;
      const isPending = !isPaid && Math.random() > 0.3; // 30% of unpaid fees are pending bank transfers

      let feeStatus: "paid" | "unpaid" = "unpaid";
      let paidAmount = 0;
      let paidAt: string | undefined = undefined;
      let receiptCode: string | undefined = undefined;

      if (isPaid) {
        feeStatus = "paid";
        paidAmount = crs.price || 2000000;
        paidAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(); // random past date
        receiptCode = `RC${222340 + index}`;

        if (!store.transactions) store.transactions = [];
        store.transactions.push({
          id: `tx_gen_${sId}_${crsSuffix}`,
          studentId: sId,
          courseId: crs.id,
          amount: paidAmount,
          status: "approved",
          paymentMethod: "Chuyển khoản ngân hàng",
          createdAt: paidAt,
          processedAt: paidAt,
          processedBy: "user_finance",
          notes: "Giao dịch chuyển khoản đã được xác nhận"
        });
      } else if (isPending) {
        const pendingAt = new Date(Date.now() - Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1000).toISOString();
        if (!store.transactions) store.transactions = [];
        store.transactions.push({
          id: `tx_gen_${sId}_${crsSuffix}`,
          studentId: sId,
          courseId: crs.id,
          amount: crs.price || 2000000,
          status: "pending",
          paymentMethod: "Chuyển khoản ngân hàng",
          createdAt: pendingAt
        });
      }
    });

    // Consolidate tuition fee for Spring 2025 per student
    const feeId = `fee_gen_${sId}_spring25`;
    const totalAmount = randomCourses.reduce((sum, crs) => sum + (crs.price || 2000000), 0);
    const hasPaid = store.transactions?.some(t => t.studentId === sId && t.status === "approved" && t.id.startsWith("tx_gen_"));
    const hasPending = !hasPaid && store.transactions?.some(t => t.studentId === sId && t.status === "pending" && t.id.startsWith("tx_gen_"));

    let feeStatus: "paid" | "unpaid" = "unpaid";
    let paidAmount = 0;
    let paidAtDate: string | undefined = undefined;
    let receiptCode: string | undefined = undefined;

    if (hasPaid) {
      feeStatus = "paid";
      paidAmount = totalAmount;
      const tx = store.transactions?.find(t => t.studentId === sId && t.status === "approved");
      paidAtDate = tx?.createdAt;
      receiptCode = `RC${222340 + index}`;
    }

    store.tuitionFees.push({
      id: feeId,
      studentId: sId,
      semesterId: "sem_spring25",
      amount: totalAmount,
      dueDate: "2026-06-30",
      status: feeStatus,
      paidAmount,
      paidAt: paidAtDate,
      receiptCode
    });
  });


  // -------------------------------------------------------------
  // SEED DATA FOR KỲ 2026.1 (Fall 2026 / Academic Year 2026-2027)
  // -------------------------------------------------------------
  
  // 1. Mark older academic years and semesters as not current
  store.academicYears.forEach(y => y.isCurrent = false);
  store.semesters.forEach(s => s.isCurrent = false);

  // 2. Add Academic Year 2026-2027
  if (!store.academicYears.some(y => y.id === "ay_2026_2027")) {
    store.academicYears.push({
      id: "ay_2026_2027",
      name: "2026–2027",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      isCurrent: true
    });
  } else {
    const ay = store.academicYears.find(y => y.id === "ay_2026_2027");
    if (ay) ay.isCurrent = true;
  }

  // 3. Add Semester Fall 2026 (Kỳ 2026.1)
  if (!store.semesters.some(s => s.id === "sem_fall26")) {
    store.semesters.push({
      id: "sem_fall26",
      academicYearId: "ay_2026_2027",
      name: "Kỳ 2026.1",
      type: "fall",
      startDate: "2026-09-01",
      endDate: "2027-01-15",
      registrationOpen: "2026-08-01",
      registrationClose: "2026-08-31",
      isCurrent: true
    });
  } else {
    const sem = store.semesters.find(s => s.id === "sem_fall26");
    if (sem) sem.isCurrent = true;
  }

  // 4. Add Registration Period for Kỳ 2026.1
  if (!store.registrationPeriods) store.registrationPeriods = [];
  if (!store.registrationPeriods.some(rp => rp.semesterId === "sem_fall26")) {
    store.registrationPeriods.push({
      id: "rp_fall26",
      semesterId: "sem_fall26",
      name: "Đăng ký học Kỳ 2026.1",
      startDate: "2026-08-01",
      endDate: "2026-12-31",
      allowedYears: [1, 2, 3, 4],
      isOpen: true
    });
  }

  // 5. Create dynamic courseSections for Kỳ 2026.1
  if (!store.courseSections) store.courseSections = [];
  const daysOfWeek = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const rooms = ["Phòng A101", "Phòng A102", "Phòng B201", "Phòng B202", "Phòng C301", "Phòng C302", "Phòng D401"];
  
  store.courses.forEach((crs, index) => {
    const sectionId = `sec_${crs.id}_01`;
    if (!store.courseSections.some(sec => sec.id === sectionId)) {
      const day1Index = Math.floor(index / 2) % daysOfWeek.length;
      const day1 = daysOfWeek[day1Index];
      const day2 = daysOfWeek[(day1Index + 2) % daysOfWeek.length];
      const timeSlot = index % 2 === 0 
        ? { start: "08:00", end: "10:00" } 
        : { start: "14:00", end: "16:00" };
      const room = rooms[index % rooms.length];

      store.courseSections.push({
        id: sectionId,
        courseId: crs.id,
        semesterId: "sem_fall26",
        teacherId: crs.teacherId,
        sectionCode: `${crs.id.toUpperCase().replace("COURSE_", "")}-01`,
        maxStudents: 40,
        schedule: [
          { dayOfWeek: day1, startTime: timeSlot.start, endTime: timeSlot.end, room },
          { dayOfWeek: day2, startTime: timeSlot.start, endTime: timeSlot.end, room }
        ],
        status: "open"
      });
    }
  });

  // 6. Register student users to Kỳ 2026.1 sections
  if (!store.courseRegistrations) store.courseRegistrations = [];
  const studentsForFall26 = store.users.filter(u => u.role === "student");
  const sectionsForFall26 = store.courseSections.filter(sec => sec.semesterId === "sem_fall26");

  const sectionCounts = new Map<string, number>();
  sectionsForFall26.forEach(sec => {
    const count = store.courseRegistrations.filter(r => r.sectionId === sec.id && r.status === "registered").length;
    sectionCounts.set(sec.id, count);
  });

  const seedTimeToMinutes = (timeStr: string): number => {
    const [hrs, mins] = timeStr.split(":").map(Number);
    return hrs * 60 + mins;
  };

  const seedHasConflict = (sec1: any, sec2: any): boolean => {
    if (!sec1.schedule || !sec2.schedule) return false;
    for (const slot1 of sec1.schedule) {
      const day1 = String(slot1.dayOfWeek || "").trim().toLowerCase();
      const start1 = seedTimeToMinutes(slot1.startTime);
      const end1 = seedTimeToMinutes(slot1.endTime);

      for (const slot2 of sec2.schedule) {
        const day2 = String(slot2.dayOfWeek || "").trim().toLowerCase();
        const start2 = seedTimeToMinutes(slot2.startTime);
        const end2 = seedTimeToMinutes(slot2.endTime);

        if (day1 === day2) {
          if (Math.max(start1, start2) < Math.min(end1, end2)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  studentsForFall26.forEach((student, studIdx) => {
    const hasReg = store.courseRegistrations.some(r => r.studentId === student.id && r.semesterId === "sem_fall26");
    if (!hasReg && sectionsForFall26.length > 0) {
      // Select sections that are not yet full
      const availableSections = sectionsForFall26.filter(sec => {
        const count = sectionCounts.get(sec.id) || 0;
        return count < sec.maxStudents;
      });

      // Select up to 3 random sections that do not conflict with each other
      const selectedSections: typeof sectionsForFall26 = [];
      const shuffledAvailable = [...availableSections].sort(() => 0.5 - Math.random());

      for (const sec of shuffledAvailable) {
        if (selectedSections.length >= 3) break;
        const isConflicting = selectedSections.some(selSec => seedHasConflict(sec, selSec));
        if (!isConflicting) {
          selectedSections.push(sec);
        }
      }

      selectedSections.forEach((sec, secIdx) => {
        store.courseRegistrations.push({
          id: `cr_${student.id}_${sec.id}`,
          studentId: student.id,
          sectionId: sec.id,
          semesterId: "sem_fall26",
          status: "registered",
          registeredAt: new Date("2026-08-15T09:00:00Z").toISOString(),
          credits: 3
        });

        sectionCounts.set(sec.id, (sectionCounts.get(sec.id) || 0) + 1);

        const alreadyEnrolled = store.enrollments.some(e => e.studentId === student.id && e.courseId === sec.courseId);
        if (!alreadyEnrolled) {
          const enrollId = `enroll_fall26_${student.id}_${sec.courseId}`;
          store.enrollments.push({
            id: enrollId,
            courseId: sec.courseId,
            studentId: student.id,
            status: "active",
            enrolledAt: new Date("2026-08-15T09:00:00Z").toISOString()
          });
        }
      });
    }
  });

  // 7. Pre-generate Attendance Sessions and Attendance Records for Kỳ 2026.1
  if (!store.attendanceSessions) store.attendanceSessions = [];
  if (!store.attendanceRecords) store.attendanceRecords = [];

  sectionsForFall26.forEach((sec, secIdx) => {
    // Session 1
    const sess1Id = `sess_${sec.id}_1`;
    if (!store.attendanceSessions.some(s => s.id === sess1Id)) {
      store.attendanceSessions.push({
        id: sess1Id,
        courseId: sec.courseId,
        semesterId: "sem_fall26",
        teacherId: sec.teacherId,
        date: "2026-09-15T08:00:00Z",
        topic: "Bài học mở đầu: Giới thiệu đề cương môn học"
      });

      const regs = store.courseRegistrations.filter(r => r.sectionId === sec.id);
      regs.forEach(reg => {
        const statuses: Array<"present" | "absent" | "late" | "excused"> = ["present", "present", "present", "late", "absent"];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        store.attendanceRecords.push({
          id: `att_${sess1Id}_${reg.studentId}`,
          sessionId: sess1Id,
          studentId: reg.studentId,
          status,
          note: status === "late" ? "Đi muộn 10 phút" : status === "absent" ? "Nghỉ không phép" : ""
        });
      });
    }

    // Session 2
    const sess2Id = `sess_${sec.id}_2`;
    if (!store.attendanceSessions.some(s => s.id === sess2Id)) {
      store.attendanceSessions.push({
        id: sess2Id,
        courseId: sec.courseId,
        semesterId: "sem_fall26",
        teacherId: sec.teacherId,
        date: "2026-09-22T08:00:00Z",
        topic: "Buổi 2: Kiến thức nền tảng và bài tập thực hành"
      });

      const regs = store.courseRegistrations.filter(r => r.sectionId === sec.id);
      regs.forEach(reg => {
        const statuses: Array<"present" | "absent" | "late" | "excused"> = ["present", "absent", "late", "excused"] as any;
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        store.attendanceRecords.push({
          id: `att_${sess2Id}_${reg.studentId}`,
          sessionId: sess2Id,
          studentId: reg.studentId,
          status,
          note: status === "late" ? "Đi muộn 5 phút" : ""
        });
      });
    }
  });

  // 8. Advisor assignments for Kỳ 2026.1
  if (!store.advisorAssignments) store.advisorAssignments = [];
  studentsForFall26.forEach((student, index) => {
    const hasAdv = store.advisorAssignments.some(aa => aa.studentId === student.id && aa.semesterId === "sem_fall26");
    if (!hasAdv) {
      store.advisorAssignments.push({
        id: `aa_fall26_${index}`,
        advisorId: "user_advisor",
        studentId: student.id,
        semesterId: "sem_fall26",
        assignedAt: new Date("2026-08-01T00:00:00Z").toISOString()
      });
    }
  });

  // 9. Generate Tuition Fees and Transactions for Kỳ 2026.1
  if (!store.tuitionFees) store.tuitionFees = [];
  if (!store.transactions) store.transactions = [];

  const fall26Registrations = store.courseRegistrations.filter(r => r.semesterId === "sem_fall26");
  
  // Group registrations by student
  const regsByStudent = new Map<string, typeof fall26Registrations>();
  fall26Registrations.forEach(reg => {
    const list = regsByStudent.get(reg.studentId) || [];
    list.push(reg);
    regsByStudent.set(reg.studentId, list);
  });

  let feeIndex = 0;
  regsByStudent.forEach((regs, studentId) => {
    const feeId = `fee_fall26_${studentId}`;
    if (!store.tuitionFees.some(f => f.id === feeId)) {
      const isPaid = Math.random() > 0.4;
      const isPending = !isPaid && Math.random() > 0.3;

      let feeStatus: "paid" | "unpaid" = "unpaid";
      let paidAmount = 0;
      let paidAtDate: string | undefined = undefined;
      let receiptCode: string | undefined = undefined;

      let totalFee = 0;
      const txRows: any[] = [];

      regs.forEach((reg, regIdx) => {
        const section = store.courseSections.find(s => s.id === reg.sectionId);
        const course = section ? store.courses.find(c => c.id === section.courseId) : undefined;
        const coursePrice = course?.price || 2000000;
        totalFee += coursePrice;

        if (isPaid) {
          paidAtDate = new Date("2026-08-20T10:00:00Z").toISOString();
          txRows.push({
            id: `tx_fall26_${studentId}_${reg.id}`,
            studentId,
            courseId: course?.id,
            amount: coursePrice,
            status: "approved",
            paymentMethod: "Chuyển khoản ngân hàng",
            createdAt: paidAtDate,
            processedAt: paidAtDate,
            processedBy: "user_finance",
            notes: `Học phí Kỳ 2026.1 - Môn ${course?.title || ""}`
          });
        } else if (isPending) {
          const pendingAt = new Date("2026-08-25T11:00:00Z").toISOString();
          txRows.push({
            id: `tx_fall26_${studentId}_${reg.id}`,
            studentId,
            courseId: course?.id,
            amount: coursePrice,
            status: "pending",
            paymentMethod: "Chuyển khoản ngân hàng",
            createdAt: pendingAt
          });
        }
      });

      if (isPaid) {
        feeStatus = "paid";
        paidAmount = totalFee;
        receiptCode = `RC_F26_${feeIndex++}`;
        store.transactions.push(...txRows);
      } else if (isPending) {
        store.transactions.push(...txRows);
      }

      store.tuitionFees.push({
        id: feeId,
        studentId,
        semesterId: "sem_fall26",
        amount: totalFee,
        dueDate: "2026-09-30",
        status: feeStatus,
        paidAmount,
        paidAt: paidAtDate,
        receiptCode
      });
    }
  });

  recomputeAndPersistAllGpas(store);
}
