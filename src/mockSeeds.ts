import { User, Course, LMSDataStore } from "./types";
import { hashPassword } from "./authHash";

const credential = (password: string, salt: string) => hashPassword(password, salt);

/**
 * Fills the seed store with a realistic demo catalogue: 20 teachers, 40 published courses
 * with lessons/quizzes/assignments, 300 learners, one class per course, and a couple of
 * attendance sessions per class. Called once per seed run and idempotent by id.
 */
export function backfillMegaDemoData(storeInput: LMSDataStore) {
  const store: any = storeInput;

  const surnames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
  const middlenames = ["Văn", "Thị", "Quang", "Minh", "Hồng", "Khánh", "Tuấn", "Thanh", "Ngọc", "Hải", "Anh", "Đức", "Công", "Xuân", "Phương"];
  const givennames = ["Hùng", "Hải", "Sơn", "Trung", "Nam", "Bắc", "Trang", "Linh", "Thảo", "Hương", "Anh", "Duy", "Phương", "Cường", "Tuấn", "Vy", "Yến", "Lan", "Phong", "Khoa"];

  const generateName = () => {
    const s = surnames[Math.floor(Math.random() * surnames.length)];
    const m = middlenames[Math.floor(Math.random() * middlenames.length)];
    const g = givennames[Math.floor(Math.random() * givennames.length)];
    return `${s} ${m} ${g}`;
  };

  if (!store.users) store.users = [];
  if (!store.courses) store.courses = [];
  if (!store.lessons) store.lessons = [];
  if (!store.quizzes) store.quizzes = [];
  if (!store.questions) store.questions = [];
  if (!store.assignments) store.assignments = [];
  if (!store.enrollments) store.enrollments = [];
  if (!store.lessonProgress) store.lessonProgress = [];
  if (!store.quizAttempts) store.quizAttempts = [];
  if (!store.submissions) store.submissions = [];
  if (!store.transactions) store.transactions = [];
  if (!store.courseSections) store.courseSections = [];
  if (!store.courseRegistrations) store.courseRegistrations = [];
  if (!store.attendanceSessions) store.attendanceSessions = [];
  if (!store.attendanceRecords) store.attendanceRecords = [];

  // 1. Generate teachers up to 20
  const teachersCountToGen = 20 - store.users.filter((u: User) => u.role === "teacher").length;
  const newTeachers: User[] = [];
  for (let i = 1; i <= teachersCountToGen; i++) {
    newTeachers.push({
      id: `teacher_gen_${i}`,
      email: `teacher_${i}@mcna.local`,
      passwordHash: credential("teachere16", `seed_teacher_gen_${i}`).hash,
      passwordSalt: credential("teachere16", `seed_teacher_gen_${i}`).salt,
      name: "Thầy/Cô " + generateName(),
      role: "teacher",
      isActive: true,
      createdAt: new Date("2026-01-02T00:00:00Z").toISOString()
    });
  }
  store.users.push(...newTeachers);
  const allTeachers = store.users.filter((u: User) => u.role === "teacher");

  // 2. Generate courses up to 40
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

  const coursesCountToGen = 40 - store.courses.length;
  const newCourses: Course[] = [];
  for (let i = 0; i < coursesCountToGen; i++) {
    const teacher = allTeachers[Math.floor(Math.random() * allTeachers.length)];
    const title = courseTitles[i % courseTitles.length];
    const category = categories[Math.floor(Math.random() * categories.length)];
    newCourses.push({
      id: `course_gen_${i}`,
      title,
      description: `Khóa học thực chiến về ${title}: học qua dự án, có lớp trực tuyến và tài liệu từng buổi.`,
      teacherId: teacher.id,
      status: "published",
      category,
      price: 1500000 + Math.floor(Math.random() * 5) * 500000,
      level: levels[Math.floor(Math.random() * levels.length)],
      tags: [category.split(" ")[0] || "General", "MCNA"],
      createdAt: new Date("2026-01-10T00:00:00Z").toISOString(),
      thumbnail: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 900000000)}?w=600&auto=format&fit=crop&q=60`
    });
  }
  store.courses.push(...newCourses);

  // 3. Every course gets lessons, a quiz with questions, and assignments
  store.courses.forEach((course: Course) => {
    if (!store.lessons.some((l: any) => l.courseId === course.id)) {
      store.lessons.push({
        id: `lesson_en_${course.id}_1`,
        courseId: course.id,
        title: "1. Tổng quan khóa học & định vị kiến thức",
        content: `Chào mừng bạn đến với khóa học: ${course.title}. Buổi mở đầu giới thiệu lộ trình và cách học hiệu quả.`,
        order: 1,
        duration: "20 mins"
      });
      store.lessons.push({
        id: `lesson_en_${course.id}_2`,
        courseId: course.id,
        title: "2. Thực hành trực tiếp trên môi trường thật",
        content: "Hướng dẫn từng bước dựng môi trường và triển khai bài thực hành đầu tiên.",
        order: 2,
        duration: "30 mins"
      });
    }

    const quizId = `quiz_${course.id}`;
    if (!store.quizzes.some((q: any) => q.courseId === course.id)) {
      store.quizzes.push({
        id: quizId,
        courseId: course.id,
        title: `Bài kiểm tra: ${course.title}`,
        passingScore: 70,
        timeLimit: 15,
        maxAttempts: 3
      });
      store.questions.push({
        id: `q_${course.id}_1`,
        quizId,
        text: `Điểm mạnh của khóa học ${course.title} là gì?`,
        type: "single",
        options: ["Học qua dự án thực tế của doanh nghiệp", "Học xong không cần làm bài", "Cấp chứng nhận mà không cần học", "Nội dung đã lỗi thời"],
        correctAnswer: "0"
      });
      store.questions.push({
        id: `q_${course.id}_2`,
        quizId,
        text: "Khi gặp lỗi kỹ thuật trong lúc thực hành, bạn nên làm gì?",
        type: "single",
        options: ["Bỏ qua và học tiếp", "Hỏi giảng viên phụ trách lớp", "Tự sửa điểm bài tập", "Nộp bài trống"],
        correctAnswer: "1"
      });
    }

    if (!store.assignments.some((a: any) => a.courseId === course.id)) {
      store.assignments.push({
        id: `assign_${course.id}`,
        courseId: course.id,
        title: `Bài tập lớn cuối khóa: ${course.title}`,
        description: "Hoàn thành dự án cuối khóa, đẩy mã nguồn lên GitHub và mô tả giải pháp khi nộp bài.",
        deadline: new Date("2026-07-15T23:59:59Z").toISOString(),
        maxScore: 100,
        type: "final"
      });
      const courseLessons = store.lessons.filter((l: any) => l.courseId === course.id);
      if (courseLessons.length > 0) {
        store.assignments.push({
          id: `assign_lesson_${course.id}`,
          courseId: course.id,
          title: "Bài tập buổi 1",
          description: "Hoàn thành các bài luyện tập nhỏ trong phần nội dung của buổi học số 1.",
          deadline: new Date("2026-06-30T23:59:59Z").toISOString(),
          maxScore: 100,
          lessonId: courseLessons[0].id,
          type: "lesson"
        });
      }
    }
  });

  // 4. One open class per course
  const daysOfWeek = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const rooms = ["Phòng A101", "Phòng A102", "Phòng B201", "Phòng B202", "Phòng C301", "Phòng C302", "Phòng D401"];

  store.courses.forEach((course: Course, index: number) => {
    const sectionId = `sec_${course.id}_01`;
    if (store.courseSections.some((sec: any) => sec.id === sectionId)) return;
    const firstDayIndex = Math.floor(index / 2) % daysOfWeek.length;
    const timeSlot = index % 2 === 0 ? { start: "08:00", end: "10:00" } : { start: "14:00", end: "16:00" };
    const room = rooms[index % rooms.length];
    store.courseSections.push({
      id: sectionId,
      courseId: course.id,
      teacherId: course.teacherId,
      sectionCode: `${course.id.toUpperCase().replace("COURSE_", "")}-01`,
      maxStudents: 40,
      schedule: [
        { dayOfWeek: daysOfWeek[firstDayIndex], startTime: timeSlot.start, endTime: timeSlot.end, room },
        { dayOfWeek: daysOfWeek[(firstDayIndex + 2) % daysOfWeek.length], startTime: timeSlot.start, endTime: timeSlot.end, room }
      ],
      status: "open"
    });
  });

  // The learner directory is only generated once; later runs keep the existing demo learners.
  if (store.users.filter((u: User) => u.role === "student").length >= 100) return;

  // 5. Generate learners up to 300
  const studentsToGen = 300 - store.users.filter((u: User) => u.role === "student").length;
  const newStudents: User[] = [];
  for (let i = 1; i <= studentsToGen; i++) {
    newStudents.push({
      id: `student_gen_${i}`,
      email: `st_${i}@mcna.local`,
      passwordHash: credential("studente16", `seed_student_gen_${i}`).hash,
      passwordSalt: credential("studente16", `seed_student_gen_${i}`).salt,
      name: generateName(),
      role: "student",
      isActive: true,
      createdAt: new Date("2026-01-03T00:00:00Z").toISOString(),
      phone: "09" + Math.floor(10000000 + Math.random() * 90000000)
    });
  }
  store.users.push(...newStudents);

  // 6. Each generated learner buys two courses, with a payment transaction for the paid ones
  newStudents.forEach((student, index) => {
    const pickedCourses = [...store.courses].sort(() => 0.5 - Math.random()).slice(0, 2);
    pickedCourses.forEach(course => {
      const courseSuffix = course.id.replace("course_", "");
      const enrollId = `enroll_gen_${student.id}_${courseSuffix}`;
      store.enrollments.push({
        id: enrollId,
        courseId: course.id,
        studentId: student.id,
        status: "active",
        enrolledAt: new Date("2026-02-15T09:00:00Z").toISOString()
      });

      store.lessonProgress.push({
        id: `progress_gen_${student.id}_${courseSuffix}_1`,
        enrollmentId: enrollId,
        lessonId: `lesson_en_${course.id}_1`,
        completed: true,
        completedAt: new Date("2026-02-20T10:00:00Z").toISOString()
      });

      const score = Math.floor(65 + Math.random() * 35);
      store.quizAttempts.push({
        id: `attempt_gen_${student.id}_${courseSuffix}`,
        quizId: `quiz_${course.id}`,
        studentId: student.id,
        answers: { [`q_${course.id}_1`]: "0", [`q_${course.id}_2`]: "1" },
        score,
        passed: score >= 70,
        startedAt: new Date("2026-03-01T14:00:00Z").toISOString(),
        submittedAt: new Date("2026-03-01T14:12:00Z").toISOString()
      });

      const isPaid = Math.random() > 0.4;
      const isPending = !isPaid && Math.random() > 0.3;
      if (isPaid) {
        const paidAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString();
        store.transactions.push({
          id: `tx_gen_${student.id}_${courseSuffix}`,
          studentId: student.id,
          courseId: course.id,
          amount: course.price || 2000000,
          status: "approved",
          paymentMethod: "Chuyển khoản ngân hàng",
          createdAt: paidAt,
          processedAt: paidAt,
          processedBy: "user_admin",
          notes: "Giao dịch chuyển khoản đã được xác nhận"
        });
      } else if (isPending) {
        store.transactions.push({
          id: `tx_gen_${student.id}_${courseSuffix}`,
          studentId: student.id,
          courseId: course.id,
          amount: course.price || 2000000,
          status: "pending",
          paymentMethod: "Chuyển khoản ngân hàng",
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1000).toISOString()
        });
      }
    });

    // Place the learner into the classes of the courses they bought
    pickedCourses.forEach(course => {
      const section = store.courseSections.find((sec: any) => sec.courseId === course.id);
      if (!section) return;
      const registrationId = `cr_${student.id}_${section.id}`;
      if (store.courseRegistrations.some((r: any) => r.id === registrationId)) return;
      const placed = store.courseRegistrations.filter((r: any) => r.sectionId === section.id && r.status === "registered").length;
      if (placed >= section.maxStudents) return;
      store.courseRegistrations.push({
        id: registrationId,
        studentId: student.id,
        sectionId: section.id,
        status: "registered",
        registeredAt: new Date("2026-02-16T09:00:00Z").toISOString(),
        credits: 3
      });
    });

    void index;
  });

  // 7. Two attendance sessions per class, with records for the learners placed in it
  store.courseSections.forEach((section: any) => {
    const sessions = [
      { id: `sess_${section.id}_1`, date: "2026-09-15T08:00:00Z", topic: "Buổi 1: Giới thiệu đề cương và lộ trình học" },
      { id: `sess_${section.id}_2`, date: "2026-09-22T08:00:00Z", topic: "Buổi 2: Kiến thức nền tảng và bài thực hành" }
    ];

    sessions.forEach(({ id, date, topic }) => {
      if (store.attendanceSessions.some((s: any) => s.id === id)) return;
      store.attendanceSessions.push({
        id,
        courseId: section.courseId,
        sectionId: section.id,
        teacherId: section.teacherId,
        date,
        topic
      });

      const statuses: Array<"present" | "absent" | "late" | "excused"> = ["present", "present", "present", "late", "absent", "excused"];
      store.courseRegistrations
        .filter((r: any) => r.sectionId === section.id)
        .forEach((registration: any) => {
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          store.attendanceRecords.push({
            id: `att_${id}_${registration.studentId}`,
            sessionId: id,
            studentId: registration.studentId,
            status,
            note: status === "late" ? "Đi muộn 10 phút" : status === "absent" ? "Nghỉ không phép" : ""
          });
        });
    });
  });
}
