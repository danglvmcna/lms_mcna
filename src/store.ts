import { 
  LMSDataStore, User, Course, Lesson, Enrollment, LessonProgress, Quiz, Question, QuizAttempt, 
  Assignment, Submission, Certificate, Notification, ForumPost, AuditLog, AcademicYear, Semester, 
  Department, Program, ProgramCourse, StudentProfile, AttendanceSession, AttendanceRecord, TuitionFee, 
  AcademicWarning, OfficialTranscript, AdvisorNote, CourseSection, RegistrationPeriod, CourseRegistration, 
  Scholarship, ScholarshipApplication, GradeAppeal, AdvisorAssignment, LeaveRequest, GraduationApplication, 
  SystemEvent 
} from "./types";
import { generateId } from "./utils";
import { hashPassword } from "./authHash";
import { backfillMegaDemoData } from "./mockSeeds";
import {
  calculateCourseGradePercent,
  collectCourseGradeInputs
} from "./gradeUtils";

const STORAGE_KEY = "e16_lms_data";

const credential = (password: string, salt: string) => hashPassword(password, salt);

// Helper salted password hashes
const ADMIN_CREDENTIAL = credential("admine16", "seed_admin");
const TEACHER_CREDENTIAL = credential("teachere16", "seed_teacher");
const STUDENT_CREDENTIAL = credential("studente16", "seed_student");
const FINANCE_CREDENTIAL = credential("finance16", "seed_finance");
const LETAN_CREDENTIAL = credential("letane16", "seed_letan");
const ACADEMIC_CREDENTIAL = credential("academice16", "seed_academic");
const ADVISOR_CREDENTIAL = credential("advisor16", "seed_advisor");

function normalizeLegacyRoles(store: LMSDataStore): void {
  store.users = store.users.map(user => {
    const legacyRole = user.role as string;
    if (legacyRole === "ke_toan" || legacyRole === "finance" || legacyRole === "le_tan" || legacyRole === "sale" || legacyRole === "quan_ly_hoc_vu" || legacyRole === "academic" || legacyRole === "academic_admin" || legacyRole === "manager" || legacyRole === "super_admin") {
      return { ...user, role: "admin" };
    }
    if (legacyRole === "advisor") {
      return { ...user, role: "teacher" };
    }
    if (legacyRole === "parent") {
      return { ...user, role: "student" };
    }
    return user;
  });
}

function stripCredentialFields(store: LMSDataStore): LMSDataStore {
  return {
    ...store,
    users: []
  };
}

export function getInitialStore(): LMSDataStore {
  const adminId = "user_admin";
  const teacherId = "user_teacher";
  const studentId = "user_student";
  const financeId = "user_finance";
  const letanId = "user_le_tan";
  const academicId = "user_academic";

  const course1Id = "course_fsweb";
  const course2Id = "course_python";
  const course3Id = "course_clean_code";

  const quiz1Id = "quiz_fsweb_end";
  const quiz2Id = "quiz_python_mid";

  const assignment1Id = "assign_calc";

  return {
    users: [
      {
        id: adminId,
        email: "admin@mcna.local",
        passwordHash: ADMIN_CREDENTIAL.hash,
        passwordSalt: ADMIN_CREDENTIAL.salt,
        name: "Arthur Pendragon",
        role: "admin",
        isActive: true,
        createdAt: new Date("2026-01-01T08:00:00Z").toISOString()
      },
      {
        id: teacherId,
        email: "teacher@mcna.local",
        passwordHash: TEACHER_CREDENTIAL.hash,
        passwordSalt: TEACHER_CREDENTIAL.salt,
        name: "Prof. Linus Torvalds",
        role: "teacher",
        isActive: true,
        createdAt: new Date("2026-01-02T09:00:00Z").toISOString()
      },
      {
        id: studentId,
        email: "student@mcna.local",
        passwordHash: STUDENT_CREDENTIAL.hash,
        passwordSalt: STUDENT_CREDENTIAL.salt,
        name: "Ada Lovelace",
        role: "student",
        isActive: true,
        createdAt: new Date("2026-01-03T10:00:00Z").toISOString()
      },
      {
        id: financeId,
        email: "finance@mcna.local",
        passwordHash: FINANCE_CREDENTIAL.hash,
        passwordSalt: FINANCE_CREDENTIAL.salt,
        name: "Nguyễn Văn Thanh Toán",
        role: "admin",
        isActive: true,
        createdAt: new Date("2026-01-04T11:00:00Z").toISOString()
      },
      {
        id: letanId,
        email: "le_tan@mcna.local",
        passwordHash: LETAN_CREDENTIAL.hash,
        passwordSalt: LETAN_CREDENTIAL.salt,
        name: "Lê Thị Lễ Tân",
        role: "admin",
        isActive: true,
        createdAt: new Date("2026-01-05T12:00:00Z").toISOString()
      },
      {
        id: academicId,
        email: "academic@mcna.local",
        passwordHash: ACADEMIC_CREDENTIAL.hash,
        passwordSalt: ACADEMIC_CREDENTIAL.salt,
        name: "Trần Văn Học Vụ",
        role: "admin",
        isActive: true,
        createdAt: new Date("2026-01-06T13:00:00Z").toISOString()
      },
      {
        id: "user_advisor",
        email: "advisor@mcna.local",
        passwordHash: ADVISOR_CREDENTIAL.hash,
        passwordSalt: ADVISOR_CREDENTIAL.salt,
        name: "Phạm Cố Vấn (Cố vấn Học tập)",
        role: "teacher",
        isActive: true,
        createdAt: new Date("2026-01-08T15:00:00Z").toISOString()
      }
    ],
    courses: [
      {
        id: course1Id,
        title: "Full-Stack Web Development Bootcamp",
        description: "Learn building highly responsive full-stack applications with Express, Vite, and database persistence. Includes production architectures.",
        teacherId: teacherId,
        status: "published",
        category: "Web Development",
        price: 2500000,
        level: "Nâng cao",
        tags: ["React", "Express", "Vite", "Full-Stack"],
        thumbnail: "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=600&auto=format&fit=crop&q=60",
        createdAt: new Date("2026-01-10T12:00:00Z").toISOString()
      },
      {
        id: course2Id,
        title: "Introduction to Python Analytics",
        description: "Learn pandas, NumPy, and data visualizing. We will step into practical micro-analytics, data science pipelines, and database tracking.",
        teacherId: teacherId,
        status: "published",
        category: "Data Science",
        price: 1800000,
        level: "Cơ bản",
        tags: ["Python", "Pandas", "Analytics"],
        thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=60",
        createdAt: new Date("2026-01-15T12:00:00Z").toISOString()
      },
      {
        id: course3Id,
        title: "Advanced System Design & Clean Architecture",
        description: "Deep dive into solid principles, microservice patterns, and message broker backbones. Explore scale-ready structures.",
        teacherId: teacherId,
        status: "published",
        category: "Software Engineering",
        price: 3500000,
        level: "Nâng cao",
        tags: ["System Design", "Microservices", "Clean Code"],
        thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=60",
        createdAt: new Date("2026-05-20T10:00:00Z").toISOString()
      },
      {
        id: "course_microservices",
        title: "Advanced Microservices & Cloud Native",
        description: "Learn building scale-ready system design using Docker, Kubernetes, gRPC, and Kafka. Essential for DevOps and modern software engineers.",
        teacherId: teacherId,
        status: "published",
        category: "DevOps & Infrastructure",
        price: 4200000,
        level: "Nâng cao",
        tags: ["Microservices", "Kubernetes", "gRPC", "Kafka"],
        thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=600&auto=format&fit=crop&q=60",
        createdAt: new Date("2026-05-30T10:00:00Z").toISOString()
      },
      {
        id: "course_dataengineering",
        title: "Data Engineering & Real-Time Analytics Pipeline",
        description: "Master Spark streaming, Kafka events processing, and data warehouse patterns. Build high throughput data pipelines.",
        teacherId: teacherId,
        status: "published",
        category: "Data Science",
        price: 2900000,
        level: "Trung cấp",
        tags: ["Data Engineering", "Spark", "Kafka", "Data Warehouse"],
        thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=60",
        createdAt: new Date("2026-05-31T10:00:00Z").toISOString()
      }
    ],
    lessons: [
      // Lessons for Full-Stack
      {
        id: "lesson_fs1",
        courseId: course1Id,
        title: "1. Core HTTP architecture & network boundaries",
        content: "We will demystify standard TCP/IP binding interfaces, reverse proxy configurations, and why host address '0.0.0.0' matters in cloud infrastructure.\n\n### Ingress Configuration\nAll requests traverse a virtual network dispatcher. Ensure you design port structures intelligently to support modern reverse proxy layers correctly.",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        order: 1,
        duration: "15 mins"
      },
      {
        id: "lesson_fs2",
        courseId: course1Id,
        title: "2. Structuring RESTful APIs clean architecture",
        content: "We will establish structured API namespaces under `/api/*` proxies. Never leak standard backend authorization keys to browser frontends.",
        videoUrl: "",
        order: 2,
        duration: "20 mins"
      },
      {
        id: "lesson_fs3",
        courseId: course1Id,
        title: "3. Local Orchestration & state systems",
        content: "Learn state tracking techniques like localStorage caching, optimistic visual updates, and transaction journaling.",
        videoUrl: "",
        order: 3,
        duration: "25 mins"
      },
      // Lessons for Python
      {
        id: "lesson_py1",
        courseId: course2Id,
        title: "1. Setting up python analysis environments",
        content: "Discover virtual environment controls, parsing raw values dynamically, and querying structured dataset formats easily.",
        videoUrl: "",
        order: 1,
        duration: "10 mins"
      }
    ],
    enrollments: [
      {
        id: "enroll_student1",
        courseId: course1Id,
        studentId: studentId,
        status: "active",
        enrolledAt: new Date("2026-05-10T14:00:00Z").toISOString()
      }
    ],
    lessonProgress: [
      {
        id: "prog_1",
        enrollmentId: "enroll_student1",
        lessonId: "lesson_fs1",
        completed: true,
        completedAt: new Date("2026-05-11T10:00:00Z").toISOString()
      },
      {
        id: "prog_2",
        enrollmentId: "enroll_student1",
        lessonId: "lesson_fs2",
        completed: true,
        completedAt: new Date("2026-05-12T11:00:00Z").toISOString()
      }
      // Note: lesson_fs3 left uncompleted so student has 2/3 completed! Actionable progress!
    ],
    quizzes: [
      {
        id: quiz1Id,
        courseId: course1Id,
        lessonId: undefined,
        title: "Full-Stack Final Graduation Quiz",
        passingScore: 70,
        timeLimit: 10,
        maxAttempts: 3
      },
      {
        id: quiz2Id,
        courseId: course2Id,
        title: "Python Midway Assessment",
        passingScore: 50,
        timeLimit: 5,
        maxAttempts: 2
      }
    ],
    questions: [
      // For Quiz 1
      {
        id: "q_fs1",
        quizId: quiz1Id,
        text: "What internal host address mapping exposes a microservice container universally to all incoming reverse proxies?",
        type: "single",
        options: ["127.0.0.1 (Loopback)", "localhost", "0.0.0.0 (Global IP)", "192.168.1.1"],
        correctAnswer: "2" // index 2 corresponds to 0.0.0.0
      },
      {
        id: "q_fs2",
        quizId: quiz1Id,
        text: "Where must secret environment keys (such as custom service API keys) reside in clean full-stack platforms?",
        type: "single",
        options: ["Embedded in client scripts", "Exclusively server-side variables accessed via proxies", "Written directly in public HTML comments", "Saved in standard localStorage data keychains"],
        correctAnswer: "1" // Server-side proxies
      },
      {
        id: "q_fs3",
        quizId: quiz1Id,
        text: "Select all items that constitute high-performance characteristics in a full-stack SPA setup (Choose all standard options).",
        type: "multiple",
        options: [
          "Bundling static files cleanly via bundlers",
          "Optimistic client states with instant responsiveness",
          "Rendering empty pages and freezing standard browser rendering context",
          "Lazy loading large resources dynamically on-demand"
        ],
        correctAnswer: "0,1,3" // Multi answers
      },
      {
        id: "q_fs4",
        quizId: quiz1Id,
        text: "Briefly explain why we should separate backend storage mutations from general client views.",
        type: "text",
        options: [],
        correctAnswer: "security, architecture, separation of concerns"
      }
    ],
    quizAttempts: [
      {
        id: "attempt_old",
        quizId: quiz1Id,
        studentId: studentId,
        answers: { "q_fs1": "0", "q_fs2": "0" }, // failed mock attempt
        score: 0,
        passed: false,
        startedAt: new Date("2026-05-14T09:00:00Z").toISOString(),
        submittedAt: new Date("2026-05-14T09:05:00Z").toISOString()
      }
    ],
    assignments: [
      {
        id: assignment1Id,
        courseId: course1Id,
        title: "Complete REST API Routing Code block",
        description: "Create a modular assignment submission outlining how standard JSON router handles errors properly during storage failures.",
        deadline: new Date("2026-06-30T23:59:59Z").toISOString(),
        maxScore: 100
      }
    ],
    submissions: [
      {
        id: "submit_lov",
        assignmentId: assignment1Id,
        studentId: studentId,
        content: "My submission introduces an async express route with a clean try-catch wrapper loading status payloads, guarding dynamic values cleanly and logging server errors. This prevents workspace crashes during server startup.",
        submittedAt: new Date("2026-05-18T14:30:00Z").toISOString()
        // Gradable by teacher! Shown as pending grade.
      }
    ],
    certificates: [],
    notifications: [
      {
        id: "note_welcome_admin",
        userId: adminId,
        type: "success",
        message: "Chào mừng bạn đến với Cổng điều hành của Arthur. Các dấu hiệu kiểm tra hệ thống cho thấy trạng thái hoạt động ổn định 100%.",
        isRead: false,
        createdAt: new Date("2026-05-25T08:00:00Z").toISOString()
      },
      {
        id: "note_welcome_student",
        userId: studentId,
        type: "info",
        message: "Bạn hiện đang tham gia lớp học: Full-Stack Web Development Bootcamp.",
        isRead: false,
        createdAt: new Date("2026-05-25T08:10:00Z").toISOString()
      },
      {
        id: "note_welcome_academic",
        userId: academicId,
        type: "success",
        message: "Chào mừng cán bộ học vụ. Hệ thống quản trị học học phần SIS-LMS đã sẵn sàng hoạt động để theo dõi điểm danh, lịch học, kết quả học tập và cảnh báo học thuật.",
        isRead: false,
        createdAt: new Date("2026-05-25T08:15:00Z").toISOString()
      },
      {
        id: "note_welcome_finance",
        userId: financeId,
        type: "success",
        message: "Chào mừng nhân viên vận hành thanh toán. Hồ sơ học phí, biểu phí học phần và trạng thái giao dịch trực tuyến của sinh viên đã sẵn sàng.",
        isRead: false,
        createdAt: new Date("2026-05-25T08:20:00Z").toISOString()
      },
      {
        id: "note_welcome_letan",
        userId: letanId,
        type: "success",
        message: "Chào mừng bộ phận lễ tân. Cổng thông tin hỗ trợ sinh viên nhanh, reset mật khẩu khẩn cấp và tra cứu lý lịch học vụ đã trực tuyến.",
        isRead: false,
        createdAt: new Date("2026-05-25T08:25:00Z").toISOString()
      },
      {
        id: "note_welcome_teacher",
        userId: teacherId,
        type: "info",
        message: "Chào mừng giảng viên Linus Torvalds. Lớp học phần, giáo án bài học, ngân hàng câu hỏi đề thi trắc nghiệm (Quizzes) và chấm bài tập đã sẵn sàng.",
        isRead: false,
        createdAt: new Date("2026-05-25T08:30:00Z").toISOString()
      },
      {
        id: "note_welcome_advisor",
        userId: "user_advisor",
        type: "info",
        message: "Chào mừng Cố vấn học tập. Danh sách sinh viên được phân công cố vấn, sổ nhật ký tư vấn và phê duyệt lộ trình đăng ký lớp tháng mới đã sẵn sàng.",
        isRead: false,
        createdAt: new Date("2026-05-25T08:35:00Z").toISOString()
      }
    ],
    forumPosts: [
      {
        id: "post_welcome",
        courseId: course1Id,
        authorId: teacherId,
        title: "Welcome to the Full-Stack Developer Forum!",
        content: "Use this space to discuss architecture guidelines, clean models, and optimization recipes. Post any query and let's optimize collaboratively!",
        replies: [
          {
            id: "reply_ada1",
            postId: "post_welcome",
            authorId: studentId,
            content: "Prof. Linus, thank you! I am really looking forward to the routing challenges and clean architectures.",
            createdAt: new Date("2026-05-25T08:12:00Z").toISOString()
          }
        ],
        createdAt: new Date("2026-05-24T10:00:00Z").toISOString()
      }
    ],
    auditLogs: [
      {
        id: "log_seed",
        userId: "system",
        action: "initialize_system",
        target: "database",
        detail: "E16 LMS seeded initial records successfully.",
        createdAt: new Date("2026-05-25T08:16:00Z").toISOString()
      }
    ],
    transactions: [
      {
        id: "tx_first_approved",
        studentId: studentId,
        courseId: course1Id,
        amount: 2500000,
        status: "approved",
        paymentMethod: "Chuyển khoản ngân hàng",
        createdAt: new Date("2026-05-10T11:00:00Z").toISOString(),
        processedAt: new Date("2026-05-10T14:00:00Z").toISOString(),
        processedBy: financeId,
        notes: "Giao dịch chuyển khoản hợp lệ, đã được xác nhận"
      },
      {
        id: "tx_second_pending",
        studentId: studentId,
        courseId: course2Id,
        amount: 1800000,
        status: "pending",
        paymentMethod: "Quét QR MoMo/VNPAY",
        createdAt: new Date("2026-05-25T08:00:00Z").toISOString()
      }
    ],
    academicYears: [
      {
        id: "ay_2024_2025",
        name: "2024–2025",
        startDate: "2024-09-01",
        endDate: "2025-06-30",
        isCurrent: true
      }
    ],
    semesters: [
      {
        id: "sem_fall24",
        academicYearId: "ay_2024_2025",
        name: "Fall 2024",
        type: "fall",
        startDate: "2024-09-01",
        endDate: "2025-01-15",
        registrationOpen: "2024-08-01",
        registrationClose: "2024-08-31",
        isCurrent: false
      },
      {
        id: "sem_spring25",
        academicYearId: "ay_2024_2025",
        name: "Spring 2025",
        type: "spring",
        startDate: "2025-02-01",
        endDate: "2025-06-30",
        registrationOpen: "2025-01-01",
        registrationClose: "2025-01-31",
        isCurrent: true
      }
    ],
    departments: [
      {
        id: "dept_cs",
        name: "Computer Science",
        code: "CS",
        headTeacherId: teacherId,
        description: "Khoa Khoa học Máy tính"
      },
      {
        id: "dept_ba",
        name: "Business Administration",
        code: "BA",
        headTeacherId: teacherId,
        description: "Khoa Quản trị Kinh doanh"
      }
    ],
    programs: [
      {
        id: "prog_se",
        departmentId: "dept_cs",
        name: "Software Engineering",
        code: "SE",
        type: "degree",
        totalCredits: 120,
        description: "Nhánh đào tạo Kỹ sư Phần mềm ứng dụng chuyên sâu."
      },
      {
        id: "prog_bm",
        departmentId: "dept_ba",
        name: "Business Management",
        code: "BM",
        type: "degree",
        totalCredits: 120,
        description: "Đào tạo kỹ năng quản trị, khởi nghiệp và điều hành doanh nghiệp."
      }
    ],
    programCourses: [
      {
        id: "pc_1",
        programId: "prog_se",
        courseId: course1Id,
        credits: 4,
        isRequired: true,
        semester: 1
      },
      {
        id: "pc_2",
        programId: "prog_se",
        courseId: course2Id,
        credits: 3,
        isRequired: false,
        semester: 2
      }
    ],
    studentProfiles: [
      {
        id: "profile_student",
        userId: studentId,
        studentCode: "SV2024001",
        programId: "prog_se",
        departmentId: "dept_cs",
        academicYear: 2,
        enrollmentDate: "2024-09-01",
        expectedGraduation: "2028-06-30",
        status: "active",
        gpa: 3.2,
        totalCreditsEarned: 45,
        address: "Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
        phone: "0912345678",
        dateOfBirth: "2002-03-15",
        gender: "Nữ",
        guardianName: undefined,
        guardianPhone: undefined,
        guardianEmail: undefined,
        notes: "Sinh viên tiêu biểu lớp Kỹ thuật Phần mềm."
      }
    ],
    attendanceSessions: [
      {
        id: "session_cs1",
        courseId: "course_fsweb",
        semesterId: "sem_spring25",
        teacherId: "user_teacher",
        date: "2025-02-15",
        topic: "Core HTTP and network boundaries"
      },
      {
        id: "session_cs2",
        courseId: "course_fsweb",
        semesterId: "sem_spring25",
        teacherId: "user_teacher",
        date: "2025-02-22",
        topic: "RESTful API routes"
      },
      {
        id: "session_cs3",
        courseId: "course_fsweb",
        semesterId: "sem_spring25",
        teacherId: "user_teacher",
        date: "2025-03-01",
        topic: "State systems"
      }
    ],
    attendanceRecords: [
      { id: "ar_1", sessionId: "session_cs1", studentId: "user_student", status: "present" },
      { id: "ar_2", sessionId: "session_cs2", studentId: "user_student", status: "absent" },
      { id: "ar_3", sessionId: "session_cs3", studentId: "user_student", status: "absent" }
    ],
    tuitionFees: [
      {
        id: "fee_spring25_student",
        studentId: studentId,
        semesterId: "sem_spring25",
        amount: 15000000,
        dueDate: "2025-03-31",
        status: "unpaid",
        paidAmount: 0
      }
    ],
    academicWarnings: [
      {
        id: "warning_attendance",
        studentId: "user_student",
        type: "low_attendance",
        message: "Cảnh báo chuyên cần: Tỉ lệ chuyên cần môn Full-Stack của bạn hiện tại là 33% (dưới mốc tối thiểu 80%).",
        isResolved: false,
        createdAt: "2026-05-18T10:00:00Z"
      }
    ],
    officialTranscripts: [],
    advisorNotes: [
      {
        id: "note_1",
        advisorId: "user_advisor",
        studentId: "user_student",
        content: "Cần cải thiện tỉ lệ chuyên cần lớp Full-Stack để tránh bị cấm thi cuối khóa.",
        type: "academic",
        createdAt: "2026-05-20T11:00:00Z"
      }
    ],
    courseSections: [
      {
        id: "section_cs101_01",
        courseId: "course_fsweb",
        semesterId: "sem_spring25",
        teacherId: "user_teacher",
        sectionCode: "CS101-01",
        maxStudents: 30,
        schedule: [
          { dayOfWeek: "Thứ Hai", startTime: "08:00", endTime: "10:00", room: "Phòng A101" },
          { dayOfWeek: "Thứ Tư", startTime: "08:00", endTime: "10:00", room: "Phòng A101" }
        ],
        status: "open"
      },
      {
        id: "section_bus201_01",
        courseId: "course_python",
        semesterId: "sem_spring25",
        teacherId: "user_teacher",
        sectionCode: "BUS201-01",
        maxStudents: 40,
        schedule: [
          { dayOfWeek: "Thứ Ba", startTime: "10:00", endTime: "12:00", room: "Phòng B202" },
          { dayOfWeek: "Thứ Sáu", startTime: "10:00", endTime: "12:00", room: "Phòng B202" }
        ],
        status: "open"
      }
    ],
    registrationPeriods: [
      {
        id: "rp_spring25",
        semesterId: "sem_spring25",
        name: "Đăng ký tháng Mùa Xuân 2025",
        startDate: "2024-12-01",
        endDate: "2026-12-31",
        allowedYears: [1, 2, 3, 4],
        isOpen: true
      }
    ],
    courseRegistrations: [
      {
        id: "cr_fsweb",
        studentId: "user_student",
        sectionId: "section_cs101_01",
        semesterId: "sem_spring25",
        status: "registered",
        registeredAt: "2025-01-05T09:00:00Z",
        credits: 3
      }
    ],
    scholarships: [
      {
        id: "sch_merit_2025",
        name: "Học bổng Khuyến khích Học tập 2025",
        type: "merit",
        discountPercent: 30,
        semesterId: "sem_spring25",
        conditions: "Điểm trung bình tích lũy GPA tối thiểu đạt từ 3.2 trở lên"
      }
    ],
    scholarshipApplications: [],
    gradeAppeals: [
      {
        id: "appeal_cs101",
        studentId: "user_student",
        courseRegistrationId: "cr_fsweb",
        reason: "Bài nộp của em đầy đủ chức năng nhưng điểm chưa chính xác, mong thầy xem xét lại.",
        status: "pending",
        originalGrade: 60,
        submittedAt: "2026-05-20T10:00:00Z"
      }
    ],
    advisorAssignments: [
      {
        id: "aa_student",
        advisorId: "user_advisor",
        studentId: "user_student",
        semesterId: "sem_spring25",
        assignedAt: "2025-02-01T08:00:00Z"
      }
    ],
    leaveRequests: [],
    graduationApplications: [],
    systemEvents: [],
    teacherAttendance: []
  };
}

export function calculateStudentGpa(store: LMSDataStore, studentId: string): { gpa: number; earnedCredits: number } {
  const studentEnrollments = store.enrollments.filter(e => e.studentId === studentId && e.status !== "cancelled");
  const enrollmentsByCourse = studentEnrollments.reduce((groups, enrollment) => {
    if (!groups.has(enrollment.courseId)) groups.set(enrollment.courseId, []);
    groups.get(enrollment.courseId)!.push(enrollment);
    return groups;
  }, new Map<string, typeof studentEnrollments>());

  let totalGradeWeightedPoints = 0;
  let totalCreditsForGpa = 0;
  let totalCreditsEarned = 0;

  enrollmentsByCourse.forEach((courseEnrollments, courseId) => {
    const programCourse = store.programCourses.find(pc => pc.courseId === courseId);
    const credits = programCourse ? programCourse.credits : 3;
    const grade = calculateCourseGradePercent(collectCourseGradeInputs(store, studentId, courseId));

    if (grade.hasGrades && grade.gradePoint !== null) {
      totalGradeWeightedPoints += grade.gradePoint * credits;
      totalCreditsForGpa += credits;
      if (grade.countsForGpa) {
        totalCreditsEarned += credits;
      }
    } else {
      const totalLessons = store.lessons.filter(l => l.courseId === courseId).length;
      const hasCompletedEnrollment = courseEnrollments.some(enrollment => {
        const progressCount = store.lessonProgress.filter(p => p.enrollmentId === enrollment.id && p.completed).length;
        return enrollment.status === "completed" || (totalLessons > 0 && progressCount === totalLessons);
      });
      if (hasCompletedEnrollment) {
        totalCreditsEarned += credits;
      }
    }
  });

  const gpa = totalCreditsForGpa > 0 ? Number((totalGradeWeightedPoints / totalCreditsForGpa).toFixed(2)) : 0.0;
  return { gpa, earnedCredits: totalCreditsEarned };
}

export function recomputeAndPersistAllGpas(store: LMSDataStore) {
  if (!store.studentProfiles) {
    store.studentProfiles = [];
  }
  
  store.studentProfiles = store.studentProfiles.map(profile => {
    const { gpa, earnedCredits } = calculateStudentGpa(store, profile.userId);
    
    // Check graduation: does the student complete all Program Course requirements?
    const progCourses = store.programCourses.filter(pc => pc.programId === profile.programId);
    let allCompletedAndPassed = progCourses.length > 0;
    
    if (progCourses.length > 0) {
      for (const pc of progCourses) {
        const enrollment = store.enrollments.find(e => e.studentId === profile.userId && e.courseId === pc.courseId && e.status !== "cancelled");
        if (!enrollment) {
          allCompletedAndPassed = false;
          break;
        }
        
        const grade = calculateCourseGradePercent(collectCourseGradeInputs(store, profile.userId, pc.courseId));
        if (!grade.hasGrades || !grade.countsForGpa) {
          allCompletedAndPassed = false;
          break;
        }
      }
    } else {
      allCompletedAndPassed = false;
    }

    let status = profile.status;
    if (allCompletedAndPassed && profile.status === "active") {
      status = "graduated";
    }

    return {
      ...profile,
      gpa,
      totalCreditsEarned: earnedCredits,
      status
    };
  });
}

export class AppStore {
  private static storeInstance: LMSDataStore | null = null;
  public static syncPromise: Promise<any> | null = null;

  public static hydrate(store: LMSDataStore): void {
    normalizeLegacyRoles(store);
    this.storeInstance = store;
    localStorage.removeItem(STORAGE_KEY);
  }

  public static get(): LMSDataStore {
    if (!this.storeInstance) {
      localStorage.removeItem(STORAGE_KEY);
      const raw = null;
      if (raw) {
        try {
          this.storeInstance = JSON.parse(raw);
          
          // Safety backfills for production migration
          if (!this.storeInstance.transactions) {
            this.storeInstance.transactions = [];
          }
          
          const initial = getInitialStore();
          if (!this.storeInstance.users || this.storeInstance.users.length === 0) {
            this.storeInstance.users = initial.users.map(user => ({
              ...user,
              passwordHash: "",
              passwordSalt: undefined
            }));
          }
          normalizeLegacyRoles(this.storeInstance);

          // Ensure all system-level collection tables are initialized
          if (!this.storeInstance.academicYears) this.storeInstance.academicYears = initial.academicYears;
          if (!this.storeInstance.semesters) this.storeInstance.semesters = initial.semesters;
          if (!this.storeInstance.departments) this.storeInstance.departments = initial.departments;
          if (!this.storeInstance.programs) this.storeInstance.programs = initial.programs;
          if (!this.storeInstance.programCourses) this.storeInstance.programCourses = initial.programCourses;
          if (!this.storeInstance.studentProfiles) this.storeInstance.studentProfiles = initial.studentProfiles;
          if (!this.storeInstance.attendanceSessions) this.storeInstance.attendanceSessions = initial.attendanceSessions || [];
          if (!this.storeInstance.attendanceRecords) this.storeInstance.attendanceRecords = initial.attendanceRecords || [];
          if (!this.storeInstance.tuitionFees) this.storeInstance.tuitionFees = initial.tuitionFees || [];
          if (!this.storeInstance.academicWarnings) this.storeInstance.academicWarnings = initial.academicWarnings || [];
          if (!this.storeInstance.officialTranscripts) this.storeInstance.officialTranscripts = initial.officialTranscripts || [];
          if (!this.storeInstance.advisorNotes) this.storeInstance.advisorNotes = initial.advisorNotes || [];
          if (!this.storeInstance.courseSections) this.storeInstance.courseSections = initial.courseSections || [];
          if (!this.storeInstance.registrationPeriods) this.storeInstance.registrationPeriods = initial.registrationPeriods || [];
          if (!this.storeInstance.courseRegistrations) this.storeInstance.courseRegistrations = initial.courseRegistrations || [];
          if (!this.storeInstance.scholarships) this.storeInstance.scholarships = initial.scholarships || [];
          if (!this.storeInstance.scholarshipApplications) this.storeInstance.scholarshipApplications = initial.scholarshipApplications || [];
          if (!this.storeInstance.gradeAppeals) this.storeInstance.gradeAppeals = initial.gradeAppeals || [];
          if (!this.storeInstance.advisorAssignments) this.storeInstance.advisorAssignments = initial.advisorAssignments || [];
          if (!this.storeInstance.leaveRequests) this.storeInstance.leaveRequests = initial.leaveRequests || [];
          if (!this.storeInstance.graduationApplications) this.storeInstance.graduationApplications = initial.graduationApplications || [];
          if (!this.storeInstance.systemEvents) this.storeInstance.systemEvents = initial.systemEvents || [];
          if (!this.storeInstance.teacherAttendance) this.storeInstance.teacherAttendance = initial.teacherAttendance || [];

          // Ensure new seeded roles are present
          const rolesToBackfill = ["admin", "parent"];
          const hasAllRoles = rolesToBackfill.every(r => this.storeInstance!.users.some(u => u.role === r));
          if (!hasAllRoles) {
            // Append missing users
            initial.users.forEach(u => {
              if (!this.storeInstance!.users.some(ex => ex.email === u.email)) {
                this.storeInstance!.users.push(u);
              }
            });
            // Append course initial price/level/tags if missing
            this.storeInstance.courses.forEach(c => {
              const matchedTemplate = initial.courses.find(ic => ic.id === c.id);
              if (matchedTemplate) {
                if (c.price === undefined) c.price = matchedTemplate.price;
                if (!c.level) c.level = matchedTemplate.level;
                if (!c.tags) c.tags = matchedTemplate.tags;
              }
            });
            // Fill initial transactions if empty
            if (!this.storeInstance.transactions.length) {
              this.storeInstance.transactions = initial.transactions;
            }
          }
          
          backfillMegaDemoData(this.storeInstance);
        } catch (e) {
          console.error("Failed to parse datastore. Seeding clean database.");
          this.storeInstance = getInitialStore();
          normalizeLegacyRoles(this.storeInstance);
          backfillMegaDemoData(this.storeInstance);
        }
      } else {
        this.storeInstance = getInitialStore();
        normalizeLegacyRoles(this.storeInstance);
        backfillMegaDemoData(this.storeInstance);
      }
    }
    return this.storeInstance!;
  }

  public static save(store: LMSDataStore, skipSync: boolean = false): Promise<any> {
    this.storeInstance = store;
    localStorage.removeItem(STORAGE_KEY);

    if (skipSync) return Promise.resolve();

    if (typeof sessionStorage !== "undefined") {
      const role = sessionStorage.getItem("e16_lms_role");
      if (role && !["manager", "super_admin", "admin"].includes(role)) {
        // Skip calling /api/store/sync as this role does not have permission
        return Promise.resolve();
      }
    }

    if (typeof fetch !== "undefined") {
      const csrfToken = sessionStorage.getItem("mcna_lms_csrf") || sessionStorage.getItem("e16_lms_csrf");
      this.syncPromise = fetch("/api/store/sync", {
        method: "POST",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {})
        },
        body: JSON.stringify(store)
      })
      .then(async (res) => {
        this.syncPromise = null;
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Đồng bộ thất bại: status ${res.status}`);
        }
        return res.json();
      })
      .catch((err) => {
        this.syncPromise = null;
        throw err;
      });
      return this.syncPromise;
    }
    return Promise.resolve();
  }

  public static log(userId: string, action: string, target: string, detail: string): void {
    const store = this.get();
    const logItem: AuditLog = {
      id: generateId("log"),
      userId,
      action,
      target,
      detail,
      createdAt: new Date().toISOString()
    };
    if (!store.auditLogs) store.auditLogs = [];
    store.auditLogs.unshift(logItem); // Add to beginning of log
    this.save(store, true);
  }

  public static notify(userId: string, type: string, message: string): void {
    const store = this.get();
    const notification: Notification = {
      id: generateId("note"),
      userId,
      type,
      message,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    if (!store.notifications) store.notifications = [];
    store.notifications.unshift(notification);
    this.save(store, true);
  }
}
