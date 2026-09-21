// server.ts
import express from "express";
import path5 from "path";
import multer from "multer";
import { ZipArchive } from "archiver";
import fs5 from "fs";
import os3 from "os";
import crypto4 from "crypto";
import dotenv2 from "dotenv";

// src/utils.ts
function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}
var MAX_UPLOAD_FILE_BYTES = 10 * 1024 * 1024 * 1024;
var YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
function extractYoutubeVideoId(input) {
  const value = String(input || "").trim();
  if (YOUTUBE_VIDEO_ID.test(value)) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  let id = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] || null;
  } else if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v");
    } else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      id = match ? match[1] : null;
    }
  }
  return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
}
var youtubeWatchUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

// src/authHash.ts
function sha256(ascii) {
  function rightRotate(value, amount) {
    return value >>> amount | value << 32 - amount;
  }
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = [
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ];
  const k = [
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ];
  const wordsCount = (asciiBitLength + 64 >>> 9 << 4) + 16;
  for (let idx = 0; idx < wordsCount; idx++) words[idx] = 0;
  for (let idx = 0; idx < ascii.length; idx++) {
    words[idx >>> 2] |= (ascii.charCodeAt(idx) & 255) << 24 - idx % 4 * 8;
  }
  words[asciiBitLength >>> 5] |= 128 << 24 - asciiBitLength % 32;
  words[wordsCount - 1] = asciiBitLength;
  for (let i = 0; i < wordsCount; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = hash.slice(0);
    for (let j = 0; j < 64; j++) {
      if (j >= 16) {
        const w15 = w[j - 15], w2 = w[j - 2], w16 = w[j - 16], w7 = w[j - 7];
        const s02 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ w15 >>> 3;
        const s12 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ w2 >>> 10;
        w[j] = w16 + s02 + w7 + s12 | 0;
      }
      const a = hash[0], b = hash[1], c = hash[2], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = e & f ^ ~e & g;
      const temp1 = h + s1 + ch + k[j] + (w[j] || 0) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const temp2 = s0 + maj | 0;
      hash = [temp1 + temp2 | 0].concat(hash);
      hash[4] = hash[4] + temp1 | 0;
      hash.length = 8;
    }
    for (let j = 0; j < 8; j++) {
      hash[j] = hash[j] + oldHash[j] | 0;
    }
  }
  let result = "";
  for (let i = 0; i < 8; i++) {
    const hex = (hash[i] >>> 0).toString(16);
    result += "00000000".substring(hex.length) + hex;
  }
  return result;
}
function generateSalt(length = 16) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomValues = new Uint8Array(length);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < length; i++) randomValues[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join("");
}
function hashPassword(password, salt = generateSalt()) {
  return {
    salt,
    hash: sha256(`${salt}:${password}`)
  };
}
function verifyPassword(password, passwordHash, salt) {
  if (salt) {
    return hashPassword(password, salt).hash === passwordHash;
  }
  return sha256(password) === passwordHash;
}

// src/store.ts
var STORAGE_KEY = "mcna_lms_data";
var credential = (password, salt) => hashPassword(password, salt);
var ADMIN_CREDENTIAL = credential("admine16", "seed_admin");
var TEACHER_CREDENTIAL = credential("teachere16", "seed_teacher");
var STUDENT_CREDENTIAL = credential("studente16", "seed_student");
function normalizeLegacyRoles(store) {
  store.users = store.users.map((user) => {
    const legacyRole = user.role;
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
function getInitialStore() {
  const adminId = "user_admin";
  const teacherId = "user_teacher";
  const studentId = "user_student";
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
        createdAt: (/* @__PURE__ */ new Date("2026-01-01T08:00:00Z")).toISOString()
      },
      {
        id: teacherId,
        email: "teacher@mcna.local",
        passwordHash: TEACHER_CREDENTIAL.hash,
        passwordSalt: TEACHER_CREDENTIAL.salt,
        name: "Prof. Linus Torvalds",
        role: "teacher",
        isActive: true,
        createdAt: (/* @__PURE__ */ new Date("2026-01-02T09:00:00Z")).toISOString()
      },
      {
        id: studentId,
        email: "student@mcna.local",
        passwordHash: STUDENT_CREDENTIAL.hash,
        passwordSalt: STUDENT_CREDENTIAL.salt,
        name: "Ada Lovelace",
        role: "student",
        isActive: true,
        createdAt: (/* @__PURE__ */ new Date("2026-01-03T10:00:00Z")).toISOString()
      }
    ],
    courses: [
      {
        id: course1Id,
        title: "Full-Stack Web Development Bootcamp",
        description: "Learn building highly responsive full-stack applications with Express, Vite, and database persistence. Includes production architectures.",
        teacherId,
        status: "published",
        category: "Web Development",
        price: 25e5,
        level: "N\xE2ng cao",
        tags: ["React", "Express", "Vite", "Full-Stack"],
        thumbnail: "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=600&auto=format&fit=crop&q=60",
        createdAt: (/* @__PURE__ */ new Date("2026-01-10T12:00:00Z")).toISOString()
      },
      {
        id: course2Id,
        title: "Introduction to Python Analytics",
        description: "Learn pandas, NumPy, and data visualizing. We will step into practical micro-analytics, data science pipelines, and database tracking.",
        teacherId,
        status: "published",
        category: "Data Science",
        price: 18e5,
        level: "C\u01A1 b\u1EA3n",
        tags: ["Python", "Pandas", "Analytics"],
        thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=60",
        createdAt: (/* @__PURE__ */ new Date("2026-01-15T12:00:00Z")).toISOString()
      },
      {
        id: course3Id,
        title: "Advanced System Design & Clean Architecture",
        description: "Deep dive into solid principles, microservice patterns, and message broker backbones. Explore scale-ready structures.",
        teacherId,
        status: "published",
        category: "Software Engineering",
        price: 35e5,
        level: "N\xE2ng cao",
        tags: ["System Design", "Microservices", "Clean Code"],
        thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=60",
        createdAt: (/* @__PURE__ */ new Date("2026-05-20T10:00:00Z")).toISOString()
      },
      {
        id: "course_microservices",
        title: "Advanced Microservices & Cloud Native",
        description: "Learn building scale-ready system design using Docker, Kubernetes, gRPC, and Kafka. Essential for DevOps and modern software engineers.",
        teacherId,
        status: "published",
        category: "DevOps & Infrastructure",
        price: 42e5,
        level: "N\xE2ng cao",
        tags: ["Microservices", "Kubernetes", "gRPC", "Kafka"],
        thumbnail: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=600&auto=format&fit=crop&q=60",
        createdAt: (/* @__PURE__ */ new Date("2026-05-30T10:00:00Z")).toISOString()
      },
      {
        id: "course_dataengineering",
        title: "Data Engineering & Real-Time Analytics Pipeline",
        description: "Master Spark streaming, Kafka events processing, and data warehouse patterns. Build high throughput data pipelines.",
        teacherId,
        status: "published",
        category: "Data Science",
        price: 29e5,
        level: "Trung c\u1EA5p",
        tags: ["Data Engineering", "Spark", "Kafka", "Data Warehouse"],
        thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=60",
        createdAt: (/* @__PURE__ */ new Date("2026-05-31T10:00:00Z")).toISOString()
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
        studentId,
        status: "active",
        enrolledAt: (/* @__PURE__ */ new Date("2026-05-10T14:00:00Z")).toISOString()
      }
    ],
    lessonProgress: [
      {
        id: "prog_1",
        enrollmentId: "enroll_student1",
        lessonId: "lesson_fs1",
        completed: true,
        completedAt: (/* @__PURE__ */ new Date("2026-05-11T10:00:00Z")).toISOString()
      },
      {
        id: "prog_2",
        enrollmentId: "enroll_student1",
        lessonId: "lesson_fs2",
        completed: true,
        completedAt: (/* @__PURE__ */ new Date("2026-05-12T11:00:00Z")).toISOString()
      }
      // Note: lesson_fs3 left uncompleted so student has 2/3 completed! Actionable progress!
    ],
    quizzes: [
      {
        id: quiz1Id,
        courseId: course1Id,
        lessonId: void 0,
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
        correctAnswer: "2"
        // index 2 corresponds to 0.0.0.0
      },
      {
        id: "q_fs2",
        quizId: quiz1Id,
        text: "Where must secret environment keys (such as custom service API keys) reside in clean full-stack platforms?",
        type: "single",
        options: ["Embedded in client scripts", "Exclusively server-side variables accessed via proxies", "Written directly in public HTML comments", "Saved in standard localStorage data keychains"],
        correctAnswer: "1"
        // Server-side proxies
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
        correctAnswer: "0,1,3"
        // Multi answers
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
        studentId,
        answers: { "q_fs1": "0", "q_fs2": "0" },
        // failed mock attempt
        score: 0,
        passed: false,
        startedAt: (/* @__PURE__ */ new Date("2026-05-14T09:00:00Z")).toISOString(),
        submittedAt: (/* @__PURE__ */ new Date("2026-05-14T09:05:00Z")).toISOString()
      }
    ],
    assignments: [
      {
        id: assignment1Id,
        courseId: course1Id,
        title: "Complete REST API Routing Code block",
        description: "Create a modular assignment submission outlining how standard JSON router handles errors properly during storage failures.",
        deadline: (/* @__PURE__ */ new Date("2026-06-30T23:59:59Z")).toISOString(),
        maxScore: 100
      }
    ],
    submissions: [
      {
        id: "submit_lov",
        assignmentId: assignment1Id,
        studentId,
        content: "My submission introduces an async express route with a clean try-catch wrapper loading status payloads, guarding dynamic values cleanly and logging server errors. This prevents workspace crashes during server startup.",
        submittedAt: (/* @__PURE__ */ new Date("2026-05-18T14:30:00Z")).toISOString()
        // Gradable by teacher! Shown as pending grade.
      }
    ],
    certificates: [],
    notifications: [
      {
        id: "note_welcome_admin",
        userId: adminId,
        type: "success",
        message: "Ch\xE0o m\u1EEBng b\u1EA1n \u0111\u1EBFn v\u1EDBi C\u1ED5ng \u0111i\u1EC1u h\xE0nh c\u1EE7a Arthur. C\xE1c d\u1EA5u hi\u1EC7u ki\u1EC3m tra h\u1EC7 th\u1ED1ng cho th\u1EA5y tr\u1EA1ng th\xE1i ho\u1EA1t \u0111\u1ED9ng \u1ED5n \u0111\u1ECBnh 100%.",
        isRead: false,
        createdAt: (/* @__PURE__ */ new Date("2026-05-25T08:00:00Z")).toISOString()
      },
      {
        id: "note_welcome_student",
        userId: studentId,
        type: "info",
        message: "B\u1EA1n hi\u1EC7n \u0111ang tham gia l\u1EDBp h\u1ECDc: Full-Stack Web Development Bootcamp.",
        isRead: false,
        createdAt: (/* @__PURE__ */ new Date("2026-05-25T08:10:00Z")).toISOString()
      },
      {
        id: "note_welcome_teacher",
        userId: teacherId,
        type: "info",
        message: "Ch\xE0o m\u1EEBng gi\u1EA3ng vi\xEAn Linus Torvalds. L\u1EDBp h\u1ECDc ph\u1EA7n, gi\xE1o \xE1n b\xE0i h\u1ECDc, ng\xE2n h\xE0ng c\xE2u h\u1ECFi \u0111\u1EC1 thi tr\u1EAFc nghi\u1EC7m (Quizzes) v\xE0 ch\u1EA5m b\xE0i t\u1EADp \u0111\xE3 s\u1EB5n s\xE0ng.",
        isRead: false,
        createdAt: (/* @__PURE__ */ new Date("2026-05-25T08:30:00Z")).toISOString()
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
            createdAt: (/* @__PURE__ */ new Date("2026-05-25T08:12:00Z")).toISOString()
          }
        ],
        createdAt: (/* @__PURE__ */ new Date("2026-05-24T10:00:00Z")).toISOString()
      }
    ],
    auditLogs: [
      {
        id: "log_seed",
        userId: "system",
        action: "initialize_system",
        target: "database",
        detail: "E16 LMS seeded initial records successfully.",
        createdAt: (/* @__PURE__ */ new Date("2026-05-25T08:16:00Z")).toISOString()
      }
    ],
    transactions: [
      {
        id: "tx_first_approved",
        studentId,
        courseId: course1Id,
        amount: 25e5,
        status: "approved",
        paymentMethod: "Chuy\u1EC3n kho\u1EA3n ng\xE2n h\xE0ng",
        createdAt: (/* @__PURE__ */ new Date("2026-05-10T11:00:00Z")).toISOString(),
        processedAt: (/* @__PURE__ */ new Date("2026-05-10T14:00:00Z")).toISOString(),
        processedBy: adminId,
        notes: "Giao d\u1ECBch chuy\u1EC3n kho\u1EA3n h\u1EE3p l\u1EC7, \u0111\xE3 \u0111\u01B0\u1EE3c x\xE1c nh\u1EADn"
      },
      {
        id: "tx_second_pending",
        studentId,
        courseId: course2Id,
        amount: 18e5,
        status: "pending",
        paymentMethod: "Qu\xE9t QR MoMo/VNPAY",
        createdAt: (/* @__PURE__ */ new Date("2026-05-25T08:00:00Z")).toISOString()
      }
    ],
    attendanceSessions: [
      {
        id: "session_cs1",
        courseId: "course_fsweb",
        teacherId: "user_teacher",
        date: "2025-02-15",
        topic: "Core HTTP and network boundaries"
      },
      {
        id: "session_cs2",
        courseId: "course_fsweb",
        teacherId: "user_teacher",
        date: "2025-02-22",
        topic: "RESTful API routes"
      },
      {
        id: "session_cs3",
        courseId: "course_fsweb",
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
    courseSections: [
      {
        id: "section_cs101_01",
        courseId: "course_fsweb",
        teacherId: "user_teacher",
        sectionCode: "CS101-01",
        maxStudents: 30,
        schedule: [
          { dayOfWeek: "Th\u1EE9 Hai", startTime: "08:00", endTime: "10:00", room: "Ph\xF2ng A101" },
          { dayOfWeek: "Th\u1EE9 T\u01B0", startTime: "08:00", endTime: "10:00", room: "Ph\xF2ng A101" }
        ],
        status: "open"
      },
      {
        id: "section_bus201_01",
        courseId: "course_python",
        teacherId: "user_teacher",
        sectionCode: "BUS201-01",
        maxStudents: 40,
        schedule: [
          { dayOfWeek: "Th\u1EE9 Ba", startTime: "10:00", endTime: "12:00", room: "Ph\xF2ng B202" },
          { dayOfWeek: "Th\u1EE9 S\xE1u", startTime: "10:00", endTime: "12:00", room: "Ph\xF2ng B202" }
        ],
        status: "open"
      }
    ],
    courseRegistrations: [
      {
        id: "cr_fsweb",
        studentId: "user_student",
        sectionId: "section_cs101_01",
        status: "registered",
        registeredAt: "2025-01-05T09:00:00Z",
        credits: 3
      }
    ],
    systemEvents: [],
    teacherAttendance: []
  };
}
var AppStore = class {
  static {
    this.storeInstance = null;
  }
  static {
    this.syncPromise = null;
  }
  static hydrate(store) {
    normalizeLegacyRoles(store);
    this.storeInstance = store;
    localStorage.removeItem(STORAGE_KEY);
  }
  static get() {
    if (!this.storeInstance) {
      localStorage.removeItem(STORAGE_KEY);
      const raw = null;
      if (raw) {
        try {
          this.storeInstance = JSON.parse(raw);
          if (!this.storeInstance.transactions) {
            this.storeInstance.transactions = [];
          }
          const initial = getInitialStore();
          if (!this.storeInstance.users || this.storeInstance.users.length === 0) {
            this.storeInstance.users = initial.users.map((user) => ({
              ...user,
              passwordHash: "",
              passwordSalt: void 0
            }));
          }
          normalizeLegacyRoles(this.storeInstance);
          if (!this.storeInstance.attendanceSessions) this.storeInstance.attendanceSessions = initial.attendanceSessions || [];
          if (!this.storeInstance.attendanceRecords) this.storeInstance.attendanceRecords = initial.attendanceRecords || [];
          if (!this.storeInstance.courseSections) this.storeInstance.courseSections = initial.courseSections || [];
          if (!this.storeInstance.courseRegistrations) this.storeInstance.courseRegistrations = initial.courseRegistrations || [];
          if (!this.storeInstance.systemEvents) this.storeInstance.systemEvents = initial.systemEvents || [];
          if (!this.storeInstance.teacherAttendance) this.storeInstance.teacherAttendance = initial.teacherAttendance || [];
          const rolesToBackfill = ["admin"];
          const hasAllRoles = rolesToBackfill.every((r) => this.storeInstance.users.some((u) => u.role === r));
          if (!hasAllRoles) {
            initial.users.forEach((u) => {
              if (!this.storeInstance.users.some((ex) => ex.email === u.email)) {
                this.storeInstance.users.push(u);
              }
            });
            this.storeInstance.courses.forEach((c) => {
              const matchedTemplate = initial.courses.find((ic) => ic.id === c.id);
              if (matchedTemplate) {
                if (c.price === void 0) c.price = matchedTemplate.price;
                if (!c.level) c.level = matchedTemplate.level;
                if (!c.tags) c.tags = matchedTemplate.tags;
              }
            });
            if (!this.storeInstance.transactions.length) {
              this.storeInstance.transactions = initial.transactions;
            }
          }
        } catch (e) {
          console.error("Failed to parse datastore. Seeding clean database.");
          this.storeInstance = getInitialStore();
          normalizeLegacyRoles(this.storeInstance);
        }
      } else {
        this.storeInstance = getInitialStore();
        normalizeLegacyRoles(this.storeInstance);
      }
    }
    return this.storeInstance;
  }
  static save(store, skipSync = false) {
    this.storeInstance = store;
    localStorage.removeItem(STORAGE_KEY);
    if (skipSync) return Promise.resolve();
    if (typeof sessionStorage !== "undefined") {
      const role = sessionStorage.getItem("mcna_lms_role") || sessionStorage.getItem("e16_lms_role");
      if (role && !["manager", "admin"].includes(role)) {
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
          ...csrfToken ? { "X-CSRF-Token": csrfToken } : {}
        },
        body: JSON.stringify(store)
      }).then(async (res) => {
        this.syncPromise = null;
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `\u0110\u1ED3ng b\u1ED9 th\u1EA5t b\u1EA1i: status ${res.status}`);
        }
        return res.json();
      }).catch((err) => {
        this.syncPromise = null;
        throw err;
      });
      return this.syncPromise;
    }
    return Promise.resolve();
  }
  static log(userId, action, target, detail) {
    const store = this.get();
    const logItem = {
      id: generateId("log"),
      userId,
      action,
      target,
      detail,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!store.auditLogs) store.auditLogs = [];
    store.auditLogs.unshift(logItem);
    this.save(store, true);
  }
  static notify(userId, type, message) {
    const store = this.get();
    const notification = {
      id: generateId("note"),
      userId,
      type,
      message,
      isRead: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!store.notifications) store.notifications = [];
    store.notifications.unshift(notification);
    this.save(store, true);
  }
};

// src/dbMigrations.ts
import fs from "fs";
import path from "path";
function getMigrationFiles() {
  const migrationsDir = path.join(process.cwd(), "migrations", "postgres");
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort().map((file) => ({
    file,
    version: file.split("_")[0],
    name: file,
    sql: fs.readFileSync(path.join(migrationsDir, file), "utf8").trimStart()
  }));
}
async function runMigrations(pool2) {
  const applied = [];
  const skipped = [];
  await pool2.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  for (const migration of getMigrationFiles()) {
    const existing = await pool2.query("SELECT version FROM schema_migrations WHERE version = $1", [migration.version]);
    if (existing.rowCount) {
      skipped.push(migration.name);
      continue;
    }
    const client2 = await pool2.connect();
    try {
      await client2.query("BEGIN");
      if (migration.sql) {
        await client2.query(migration.sql);
      }
      await client2.query(
        "INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING",
        [migration.version, migration.name]
      );
      await client2.query("COMMIT");
      applied.push(migration.name);
    } catch (error) {
      await client2.query("ROLLBACK");
      throw error;
    } finally {
      client2.release();
    }
  }
  return { applied, skipped };
}

// src/server/db.ts
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();
var dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/lms_mcna";
if (dbUrl.includes("pooler.supabase.com:5432")) {
  dbUrl = dbUrl.replace(":5432", ":6543");
  if (!dbUrl.includes("pgbouncer=true")) {
    dbUrl += (dbUrl.includes("?") ? "&" : "?") + "pgbouncer=true";
  }
}
var isLocalDb = Boolean(
  dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")
);
var pool = new pg.Pool({
  connectionString: dbUrl,
  max: process.env.VERCEL ? 3 : Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 3e4,
  connectionTimeoutMillis: 1e4,
  ssl: isLocalDb ? void 0 : { rejectUnauthorized: false }
});

// src/server/redis.ts
import Redis from "ioredis";
var redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: () => null
});
redis.on("error", (error) => {
  if (process.env.NODE_ENV === "production") {
    console.error("[redis] connection error:", error);
  }
});
var isRedisUnavailable = false;
var lastConnectAttempt = 0;
var RECONNECT_COOLDOWN_MS = 6e4;
var lastWarningLoggedAt = 0;
var WARNING_COOLDOWN_MS = 3e5;
async function safeRedis(operation, fallback) {
  const now = Date.now();
  const needsConnect = redis.status === "wait" || redis.status === "end" || redis.status === "close";
  if (needsConnect && isRedisUnavailable && now - lastConnectAttempt < RECONNECT_COOLDOWN_MS) {
    return fallback;
  }
  try {
    if (needsConnect) {
      lastConnectAttempt = now;
      try {
        await redis.connect();
        isRedisUnavailable = false;
      } catch (connErr) {
        isRedisUnavailable = true;
        throw connErr;
      }
    }
    if (redis.status !== "ready") {
      isRedisUnavailable = true;
      return fallback;
    }
    const result = await operation();
    isRedisUnavailable = false;
    return result;
  } catch (error) {
    isRedisUnavailable = true;
    if (now - lastWarningLoggedAt > WARNING_COOLDOWN_MS) {
      lastWarningLoggedAt = now;
      if (process.env.NODE_ENV === "production") {
        console.error("[redis] Error during Redis operation in production, falling back:", error instanceof Error ? error.stack || error.message : error);
      } else {
        console.warn("[redis] Falling back because Redis is unavailable (throttled):", error instanceof Error ? error.message : error);
      }
    }
    return fallback;
  }
}

// src/server/ids.ts
import crypto from "crypto";
function generateId2(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

// src/server/mappers.ts
function normalizeRole(role) {
  if (role === "teacher" || role === "advisor") return "teacher";
  if (role === "student" || role === "parent") return "student";
  return "admin";
}
function denormalizeRole(role) {
  return role;
}
function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    passwordHash: "",
    name: row.name,
    role: normalizeRole(row.role),
    isActive: Boolean(row.is_active),
    phone: row.phone || void 0,
    linkedStudentId: row.linked_student_id || void 0,
    createdAt: row.created_at,
    schoolEmail: row.school_email || void 0,
    emailProvisioned: Boolean(row.email_provisioned),
    emailProvisionedAt: row.email_provisioned_at || void 0,
    mustChangePassword: Boolean(row.must_change_password),
    signupSource: row.signup_source || "admin",
    crmContactId: row.crm_contact_id || void 0
  };
}
function courseFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    teacherId: row.teacher_id,
    status: row.status,
    category: row.category,
    thumbnail: row.thumbnail || void 0,
    price: row.price === null || row.price === void 0 ? void 0 : Number(row.price),
    originalPrice: row.original_price === null || row.original_price === void 0 ? void 0 : Number(row.original_price),
    level: row.level || void 0,
    tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    rejectionReason: row.rejection_reason || void 0,
    createdAt: row.created_at,
    openingDate: row.opening_date || void 0,
    numberOfLessons: row.number_of_lessons === null || row.number_of_lessons === void 0 ? void 0 : Number(row.number_of_lessons)
  };
}
function publicCourseFromRow(row) {
  const course = courseFromRow(row);
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    thumbnail: course.thumbnail,
    price: course.price || 0,
    originalPrice: course.originalPrice,
    level: course.level,
    tags: course.tags || [],
    openingDate: course.openingDate,
    numberOfLessons: course.numberOfLessons,
    teacherName: row.teacher_name || void 0,
    openSectionCount: Number(row.open_section_count || 0)
  };
}
function publicCourseSectionFromRow(row, sessionRows) {
  const section = courseSectionFromRow(row);
  const toDateText = (value) => value instanceof Date ? value.toISOString() : value ? String(value) : void 0;
  return {
    id: section.id,
    sectionCode: section.sectionCode,
    teacherName: row.teacher_name || void 0,
    maxStudents: section.maxStudents,
    seatsLeft: Math.max(0, section.maxStudents - Number(row.registered_count || 0)),
    schedule: section.schedule,
    openingDate: section.openingDate,
    numberOfSessions: section.numberOfSessions,
    sessions: sessionRows.map((session) => ({
      id: session.id,
      topic: session.topic,
      date: toDateText(session.date || session.session_date)
    })).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
  };
}
function enrollmentFromRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    studentId: row.student_id,
    status: row.status,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at || void 0,
    requestedSectionId: row.requested_section_id || void 0,
    crmDealId: row.crm_deal_id || void 0
  };
}
function sessionMaterialFromRow(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    sectionId: row.section_id || void 0,
    courseId: row.course_id,
    type: row.type,
    title: row.title,
    url: row.url || void 0,
    fileName: row.file_name || void 0,
    mimeType: row.mime_type || void 0,
    sizeBytes: row.size_bytes === null || row.size_bytes === void 0 ? void 0 : Number(row.size_bytes),
    sortOrder: Number(row.sort_order || 0),
    createdBy: row.created_by || void 0,
    createdAt: row.created_at ? row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at) : (/* @__PURE__ */ new Date()).toISOString()
  };
}
function lessonProgressFromRow(row) {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    lessonId: row.lesson_id,
    completed: Boolean(row.completed),
    completedAt: row.completed_at || void 0
  };
}
function quizFromRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    lessonId: row.lesson_id || void 0,
    sessionId: row.session_id || void 0,
    title: row.title,
    passingScore: Number(row.passing_score),
    timeLimit: Number(row.time_limit),
    maxAttempts: Number(row.max_attempts),
    deadline: row.deadline || void 0,
    attachmentUrl: row.attachment_url || void 0
  };
}
function questionFromRow(row) {
  return {
    id: row.id,
    quizId: row.quiz_id,
    text: row.text,
    type: row.type,
    options: row.options_json ? JSON.parse(row.options_json) : [],
    correctAnswer: row.correct_answer,
    createdAt: row.created_at
  };
}
function quizAttemptFromRow(row) {
  return {
    id: row.id,
    quizId: row.quiz_id,
    studentId: row.student_id,
    answers: row.answers_json ? JSON.parse(row.answers_json) : {},
    score: Number(row.score),
    passed: Boolean(row.passed),
    startedAt: row.started_at,
    submittedAt: row.submitted_at
  };
}
function assignmentFromRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    sessionId: row.session_id || void 0,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    maxScore: Number(row.max_score),
    attachmentUrl: row.attachment_url || void 0,
    lessonId: row.lesson_id || void 0,
    type: row.type || void 0
  };
}
function submissionFromRow(row) {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    content: row.content,
    score: row.score !== null ? row.score : void 0,
    feedback: row.feedback || void 0,
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at || void 0,
    attachmentUrl: row.attachment_url || void 0
  };
}
function courseSectionFromRow(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    teacherId: row.teacher_id,
    sectionCode: row.section_code,
    maxStudents: Number(row.max_students),
    schedule: parseSchedule(row),
    status: row.status,
    openingDate: row.opening_date || void 0,
    numberOfSessions: row.number_of_sessions === null || row.number_of_sessions === void 0 ? void 0 : Number(row.number_of_sessions),
    meetingUrl: row.meeting_url || void 0,
    groupChatUrl: row.group_chat_url || void 0
  };
}
var parseScheduleValue = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === void 0) return [];
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed || trimmed === "[]") return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
function parseSchedule(row) {
  const parsedSchedule = parseScheduleValue(row?.schedule);
  if (parsedSchedule.length > 0) return parsedSchedule;
  const parsedScheduleJson = parseScheduleValue(row?.schedule_json);
  if (parsedScheduleJson.length > 0) return parsedScheduleJson;
  return [];
}

// src/server/validation.ts
import { z } from "zod";
function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body.", issues: z.treeifyError(parsed.error) });
    }
    req.body = parsed.data;
    next();
  };
}
var schemas = {
  login: z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1)
  }),
  completePasswordReset: z.object({
    token: z.string().trim().min(32),
    newPassword: z.string().min(8)
  }),
  createUser: z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(8),
    name: z.string().trim().min(1),
    role: z.enum(["admin", "teacher", "student"]),
    phone: z.string().trim().optional()
  }),
  bulkCreateUsers: z.object({
    users: z.array(z.object({
      email: z.email().trim().toLowerCase(),
      name: z.string().trim().min(1),
      role: z.enum(["admin", "teacher", "student"]),
      phone: z.string().trim().optional()
    })).min(1).max(5e3),
    defaultPassword: z.string().min(8).optional()
  }),
  setUserActive: z.object({
    isActive: z.boolean()
  }),
  createCourse: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    teacherId: z.string().trim().optional(),
    category: z.string().trim().min(1).default("General"),
    thumbnail: z.string().trim().optional(),
    price: z.coerce.number().min(0).default(0),
    originalPrice: z.coerce.number().min(0).optional().nullable(),
    level: z.string().trim().optional(),
    tags: z.array(z.string().trim()).default([]),
    openingDate: z.string().trim().optional(),
    numberOfLessons: z.coerce.number().int().min(1).optional()
  }),
  rejectCourse: z.object({
    rejectionReason: z.string().trim().min(1)
  }),
  addLesson: z.object({
    courseId: z.string().trim().min(1),
    title: z.string().trim().min(1),
    content: z.string().trim().min(1),
    videoUrl: z.string().trim().optional(),
    order: z.coerce.number().int().min(0),
    duration: z.string().trim().min(1)
  }),
  updateLesson: z.object({
    title: z.string().trim().min(1).optional(),
    content: z.string().trim().min(1).optional(),
    videoUrl: z.string().trim().optional(),
    order: z.coerce.number().int().min(0).optional(),
    duration: z.string().trim().min(1).optional()
  }),
  createQuiz: z.object({
    courseId: z.string().trim().min(1),
    lessonId: z.string().trim().optional(),
    sessionId: z.string().trim().optional(),
    title: z.string().trim().min(1),
    passingScore: z.coerce.number().min(0).max(100),
    timeLimit: z.coerce.number().int().min(1),
    maxAttempts: z.coerce.number().int().min(1),
    deadline: z.string().trim().nullish()
  }),
  updateQuiz: z.object({
    lessonId: z.string().trim().optional().nullable(),
    sessionId: z.string().trim().optional().nullable(),
    title: z.string().trim().min(1).optional(),
    passingScore: z.coerce.number().min(0).max(100).optional(),
    timeLimit: z.coerce.number().int().min(1).optional(),
    maxAttempts: z.coerce.number().int().min(1).optional(),
    deadline: z.string().trim().nullish()
  }),
  bulkAddQuestions: z.object({
    questions: z.array(z.object({
      text: z.string().trim().min(1),
      type: z.enum(["single", "multiple", "text"]),
      options: z.array(z.string()).default([]),
      correctAnswer: z.string().trim().min(1)
    }))
  }),
  addQuestion: z.object({
    text: z.string().trim().min(1),
    type: z.enum(["single", "multiple", "text"]),
    options: z.array(z.string()).default([]),
    correctAnswer: z.string().trim().min(1)
  }),
  registerEnrollment: z.object({
    courseId: z.string().trim().min(1),
    sectionId: z.string().trim().optional()
  }),
  approveEnrollment: z.object({
    sectionId: z.string().trim().min(1).optional()
  }),
  issueCertificate: z.object({
    enrollmentId: z.string().trim().min(1)
  }),
  toggleProgress: z.object({
    enrollmentId: z.string().trim().min(1),
    lessonId: z.string().trim().min(1)
  }),
  submitQuiz: z.object({
    quizId: z.string().trim().min(1),
    answers: z.record(z.string(), z.string()).default({}),
    startedAt: z.string().trim().optional()
  }),
  createAssignment: z.object({
    courseId: z.string().trim().min(1),
    sessionId: z.string().trim().optional(),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    deadline: z.string().trim().min(1),
    maxScore: z.coerce.number().min(1),
    attachmentUrl: z.string().trim().optional(),
    lessonId: z.string().trim().optional(),
    type: z.enum(["lesson", "chapter", "midterm", "final"]).optional()
  }),
  updateAssignment: z.object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    deadline: z.string().trim().min(1).optional(),
    maxScore: z.coerce.number().min(1).optional(),
    attachmentUrl: z.string().trim().optional().nullable(),
    lessonId: z.string().trim().optional().nullable(),
    sessionId: z.string().trim().optional().nullable(),
    type: z.enum(["lesson", "chapter", "midterm", "final"]).optional()
  }),
  submitAssignment: z.object({
    assignmentId: z.string().trim().min(1),
    content: z.string().trim().min(1),
    attachmentUrl: z.string().trim().optional()
  }),
  gradeAssignment: z.object({
    submissionId: z.string().trim().min(1),
    score: z.coerce.number().min(0),
    feedback: z.string().trim().default("")
  }),
  reviewTransaction: z.object({
    status: z.enum(["approved", "rejected"]),
    notes: z.string().trim().optional()
  }),
  attendanceSession: z.object({
    courseId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1).optional(),
    date: z.string().trim().min(1),
    topic: z.string().trim().min(1),
    content: z.string().trim().optional(),
    videoUrl: z.string().trim().optional(),
    recordingUrl: z.string().trim().optional(),
    records: z.array(z.object({
      studentId: z.string().trim().min(1),
      status: z.enum(["present", "absent", "late", "excused"]),
      note: z.string().trim().optional()
    })).default([])
  }),
  attendanceRecord: z.object({
    sessionId: z.string().trim().min(1),
    studentId: z.string().trim().min(1),
    status: z.enum(["present", "absent", "late", "excused"]),
    note: z.string().trim().optional()
  }),
  courseRegistration: z.object({
    sectionId: z.string().min(1)
  }),
  sectionScheduleSlot: z.object({
    dayOfWeek: z.string().trim().min(1),
    startTime: z.string().trim().min(1),
    endTime: z.string().trim().min(1),
    room: z.string().trim().optional(),
    specificDate: z.string().trim().optional()
  }),
  courseSection: z.object({
    courseId: z.string().trim().min(1),
    teacherId: z.string().trim().min(1).optional(),
    sectionCode: z.string().trim().min(1),
    maxStudents: z.coerce.number().int().min(1),
    numberOfSessions: z.coerce.number().int().min(1).max(200).optional(),
    schedule: z.array(z.object({
      dayOfWeek: z.string().trim().min(1),
      startTime: z.string().trim().min(1),
      endTime: z.string().trim().min(1),
      room: z.string().trim().optional(),
      specificDate: z.string().trim().optional()
    })).default([]),
    status: z.enum(["pending", "open", "closed", "cancelled"]).default("open"),
    openingDate: z.string().trim().optional(),
    meetingUrl: z.string().trim().optional().nullable(),
    groupChatUrl: z.string().trim().optional().nullable()
  }),
  generateAttendanceLink: z.object({
    courseId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1).optional(),
    topic: z.string().trim().min(1)
  }),
  selfCheckin: z.object({
    sessionId: z.string().trim().min(1),
    code: z.string().trim().min(1)
  }),
  selfCheckinQr: z.object({
    token: z.string().trim().min(20).max(2e3)
  }),
  lessonNote: z.object({
    content: z.string().max(2e4)
  }),
  feedbackTemplate: z.object({
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().min(1).max(2e3),
    courseId: z.string().trim().min(1).optional()
  }),
  teacherCheckin: z.object({
    courseId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1),
    slotTime: z.string().trim().min(1),
    classDate: z.string().trim().min(1)
  }),
  createForumPost: z.object({
    courseId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(1e4)
  }),
  createForumReply: z.object({
    content: z.string().trim().min(1).max(1e4)
  }),
  updateAttendanceSession: z.object({
    topic: z.string().trim().min(1).optional(),
    date: z.string().trim().min(1).optional(),
    videoUrl: z.string().trim().optional().nullable(),
    recordingUrl: z.string().trim().optional().nullable(),
    content: z.string().trim().optional().nullable()
  }),
  // Multipart for slide/document (fields arrive as strings), JSON for youtube/link.
  createSessionMaterial: z.object({
    type: z.enum(["slide", "document", "youtube", "link"]),
    title: z.string().trim().max(200).optional().transform((value) => value || void 0),
    url: z.string().trim().max(2e3).optional()
  }),
  updateSessionMaterial: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    url: z.string().trim().min(1).max(2e3).optional()
  }),
  reorderSessionMaterials: z.object({
    materialIds: z.array(z.string().trim().min(1)).min(1).max(200)
  }),
  selfRegister: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().trim().toLowerCase(),
    phone: z.string().trim().regex(/^[0-9+\s.()-]{8,20}$/)
  }),
  forgotPassword: z.object({
    email: z.email().trim().toLowerCase()
  }),
  crmUpsertStudent: z.object({
    crmContactId: z.string().trim().min(1).max(200),
    name: z.string().trim().min(2).max(120),
    email: z.email().trim().toLowerCase(),
    phone: z.string().trim().regex(/^[0-9+\s.()-]{8,20}$/).optional()
  }),
  crmCreateEnrollment: z.object({
    crmContactId: z.string().trim().min(1).max(200).optional(),
    email: z.email().trim().toLowerCase().optional(),
    courseId: z.string().trim().min(1),
    sectionId: z.string().trim().min(1).optional(),
    crmDealId: z.string().trim().min(1).max(200).optional()
  }).refine((value) => Boolean(value.crmContactId || value.email), { message: "crmContactId or email is required." }),
  crmConfirmPayment: z.object({
    enrollmentId: z.string().trim().min(1).optional(),
    crmDealId: z.string().trim().min(1).max(200).optional(),
    amount: z.coerce.number().nonnegative().optional(),
    reference: z.string().trim().max(200).optional(),
    paidAt: z.string().trim().max(40).optional(),
    sectionId: z.string().trim().min(1).optional()
  }).refine((value) => Boolean(value.enrollmentId || value.crmDealId), { message: "enrollmentId or crmDealId is required." })
};

// src/mockSeeds.ts
var credential2 = (password, salt) => hashPassword(password, salt);
function backfillMegaDemoData(storeInput) {
  const store = storeInput;
  const surnames = ["Nguy\u1EC5n", "Tr\u1EA7n", "L\xEA", "Ph\u1EA1m", "Ho\xE0ng", "Hu\u1EF3nh", "Phan", "V\u0169", "V\xF5", "\u0110\u1EB7ng", "B\xF9i", "\u0110\u1ED7", "H\u1ED3", "Ng\xF4", "D\u01B0\u01A1ng", "L\xFD"];
  const middlenames = ["V\u0103n", "Th\u1ECB", "Quang", "Minh", "H\u1ED3ng", "Kh\xE1nh", "Tu\u1EA5n", "Thanh", "Ng\u1ECDc", "H\u1EA3i", "Anh", "\u0110\u1EE9c", "C\xF4ng", "Xu\xE2n", "Ph\u01B0\u01A1ng"];
  const givennames = ["H\xF9ng", "H\u1EA3i", "S\u01A1n", "Trung", "Nam", "B\u1EAFc", "Trang", "Linh", "Th\u1EA3o", "H\u01B0\u01A1ng", "Anh", "Duy", "Ph\u01B0\u01A1ng", "C\u01B0\u1EDDng", "Tu\u1EA5n", "Vy", "Y\u1EBFn", "Lan", "Phong", "Khoa"];
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
  const teachersCountToGen = 20 - store.users.filter((u) => u.role === "teacher").length;
  const newTeachers = [];
  for (let i = 1; i <= teachersCountToGen; i++) {
    newTeachers.push({
      id: `teacher_gen_${i}`,
      email: `teacher_${i}@mcna.local`,
      passwordHash: credential2("teachere16", `seed_teacher_gen_${i}`).hash,
      passwordSalt: credential2("teachere16", `seed_teacher_gen_${i}`).salt,
      name: "Th\u1EA7y/C\xF4 " + generateName(),
      role: "teacher",
      isActive: true,
      createdAt: (/* @__PURE__ */ new Date("2026-01-02T00:00:00Z")).toISOString()
    });
  }
  store.users.push(...newTeachers);
  const allTeachers = store.users.filter((u) => u.role === "teacher");
  const courseTitles = [
    "C\u1EA5u tr\xFAc d\u1EEF li\u1EC7u v\xE0 gi\u1EA3i thu\u1EADt \xE1p d\u1EE5ng",
    "L\u1EADp tr\xECnh h\u01B0\u1EDBng \u0111\u1ED1i t\u01B0\u1EE3ng chuy\xEAn s\xE2u",
    "C\u01A1 s\u1EDF d\u1EEF li\u1EC7u NoSQL & Distributed Cache",
    "K\u1EF9 thu\u1EADt ki\u1EC3m th\u1EED & Jenkins CI/CD pipeline",
    "Ph\xE1t tri\u1EC3n \u1EE9ng d\u1EE5ng \u0111\xE1m m\xE2y AWS",
    "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o v\xE0 \u1EE9ng d\u1EE5ng NLP",
    "An to\xE0n m\u1EA1ng m\xE1y t\xEDnh v\xE0 m\xE3 h\xF3a \u0111\u1EA7u cu\u1ED1i",
    "Ph\xE2n t\xEDch t\xE0i ch\xEDnh doanh nghi\u1EC7p n\xE2ng cao",
    "L\u1EADp tr\xECnh \u1EE9ng d\u1EE5ng di \u0111\u1ED9ng React Native",
    "X\xE2y d\u1EF1ng v\xE0 t\u1ED1i \u01B0u h\xF3a truy v\u1EA5n SQL",
    "Thi\u1EBFt k\u1EBF ki\u1EBFn tr\xFAc h\u1EC7 th\u1ED1ng Microservices",
    "H\xE0nh vi ng\u01B0\u1EDDi d\xF9ng & Thi\u1EBFt k\u1EBF UI/UX",
    "Gi\u1EA3i ph\xE1p Blockchain & Ethereum Smart Contract",
    "Khai th\xE1c v\xE0 ph\xE2n t\xEDch Big Data",
    "K\u1EF9 thu\u1EADt l\u1EADp tr\xECnh s\u1EA1ch Clean Code",
    "H\u1EC7 th\u1ED1ng \u0111i\u1EC1u h\xE0nh ph\xE2n t\xE1n",
    "L\u1EADp tr\xECnh tr\xF2 ch\u01A1i Unity 3D c\u01A1 b\u1EA3n",
    "\u0110i\u1EC7n to\xE1n \u0111\xE1m m\xE2y Docker & Kubernetes",
    "K\u1EBF to\xE1n qu\u1EA3n tr\u1ECB v\xE0 Thu\u1EBF chuy\xEAn s\xE2u",
    "H\u1EC7 th\u1ED1ng th\xF4ng tin qu\u1EA3n l\xFD kinh t\u1EBF",
    "Ph\xE2n t\xEDch r\u1EE7i ro & B\u1EA3o hi\u1EC3m t\xE0i ch\xEDnh",
    "Kh\u1EDFi nghi\u1EC7p \u0111\u1ED5i m\u1EDBi s\xE1ng t\u1EA1o s\u1ED1",
    "Th\u01B0\u01A1ng m\u1EA1i \u0111i\u1EC7n t\u1EED & Ph\u1EC5u t\u1ED1i \u01B0u Marketing",
    "Qu\u1EA3n l\xFD chu\u1ED7i cung \u1EE9ng Logistics to\xE0n c\u1EA7u",
    "K\u1EF9 n\u0103ng m\u1EC1m cho k\u1EF9 s\u01B0 ph\u1EA7n m\u1EC1m",
    "L\u1EADp tr\xECnh \u1EE9ng d\u1EE5ng Web v\u1EDBi NestJS",
    "\u0110\u1EA1i s\u1ED1 tuy\u1EBFn t\xEDnh h\u01B0\u1EDBng \u1EE9ng d\u1EE5ng M\xE1y h\u1ECDc",
    "L\xFD thuy\u1EBFt m\u1EADt m\xE3 h\u1ECDc v\xE0 b\u1EA3o m\u1EADt",
    "Ph\xE1t tri\u1EC3n \u1EE9ng d\u1EE5ng Web Frontend v\u1EDBi Vue.js 3",
    "L\u1EADp tr\xECnh Python Core & C\u01A1 b\u1EA3n",
    "Tr\u1EA3i nghi\u1EC7m tr\xF2 ch\u01A1i & K\u1EF9 thu\u1EADt Shader",
    "Ph\xE1c th\u1EA3o \u0111\u1ED3 h\u1ECDa v\xE0 ho\u1EA1t c\u1EA3nh 2D",
    "T\u1ED1i \u01B0u hi\u1EC7u su\u1EA5t Server Node.js",
    "Ng\xF4n ng\u1EEF Go cho ph\xE1t tri\u1EC3n Network Service",
    "Ph\xE1t tri\u1EC3n \u1EE9ng d\u1EE5ng Cross-platform v\u1EDBi Flutter",
    "C\xF4ng ngh\u1EC7 IoT & L\u1EADp tr\xECnh nh\xFAng Arduino",
    "Ki\u1EC3m to\xE1n \u0111\u1ED9c l\u1EADp v\xE0 Qu\u1EA3n tr\u1ECB doanh nghi\u1EC7p"
  ];
  const categories = ["Web Development", "Software Engineering", "Data Science", "System Administration", "Artificial Intelligence", "Business Management", "Finance"];
  const levels = ["C\u01A1 b\u1EA3n", "Trung c\u1EA5p", "N\xE2ng cao"];
  const coursesCountToGen = 40 - store.courses.length;
  const newCourses = [];
  for (let i = 0; i < coursesCountToGen; i++) {
    const teacher = allTeachers[Math.floor(Math.random() * allTeachers.length)];
    const title = courseTitles[i % courseTitles.length];
    const category = categories[Math.floor(Math.random() * categories.length)];
    newCourses.push({
      id: `course_gen_${i}`,
      title,
      description: `Kh\xF3a h\u1ECDc th\u1EF1c chi\u1EBFn v\u1EC1 ${title}: h\u1ECDc qua d\u1EF1 \xE1n, c\xF3 l\u1EDBp tr\u1EF1c tuy\u1EBFn v\xE0 t\xE0i li\u1EC7u t\u1EEBng bu\u1ED5i.`,
      teacherId: teacher.id,
      status: "published",
      category,
      price: 15e5 + Math.floor(Math.random() * 5) * 5e5,
      level: levels[Math.floor(Math.random() * levels.length)],
      tags: [category.split(" ")[0] || "General", "MCNA"],
      createdAt: (/* @__PURE__ */ new Date("2026-01-10T00:00:00Z")).toISOString(),
      thumbnail: `https://images.unsplash.com/photo-${15e11 + Math.floor(Math.random() * 9e8)}?w=600&auto=format&fit=crop&q=60`
    });
  }
  store.courses.push(...newCourses);
  store.courses.forEach((course) => {
    if (!store.lessons.some((l) => l.courseId === course.id)) {
      store.lessons.push({
        id: `lesson_en_${course.id}_1`,
        courseId: course.id,
        title: "1. T\u1ED5ng quan kh\xF3a h\u1ECDc & \u0111\u1ECBnh v\u1ECB ki\u1EBFn th\u1EE9c",
        content: `Ch\xE0o m\u1EEBng b\u1EA1n \u0111\u1EBFn v\u1EDBi kh\xF3a h\u1ECDc: ${course.title}. Bu\u1ED5i m\u1EDF \u0111\u1EA7u gi\u1EDBi thi\u1EC7u l\u1ED9 tr\xECnh v\xE0 c\xE1ch h\u1ECDc hi\u1EC7u qu\u1EA3.`,
        order: 1,
        duration: "20 mins"
      });
      store.lessons.push({
        id: `lesson_en_${course.id}_2`,
        courseId: course.id,
        title: "2. Th\u1EF1c h\xE0nh tr\u1EF1c ti\u1EBFp tr\xEAn m\xF4i tr\u01B0\u1EDDng th\u1EADt",
        content: "H\u01B0\u1EDBng d\u1EABn t\u1EEBng b\u01B0\u1EDBc d\u1EF1ng m\xF4i tr\u01B0\u1EDDng v\xE0 tri\u1EC3n khai b\xE0i th\u1EF1c h\xE0nh \u0111\u1EA7u ti\xEAn.",
        order: 2,
        duration: "30 mins"
      });
    }
    const quizId = `quiz_${course.id}`;
    if (!store.quizzes.some((q) => q.courseId === course.id)) {
      store.quizzes.push({
        id: quizId,
        courseId: course.id,
        title: `B\xE0i ki\u1EC3m tra: ${course.title}`,
        passingScore: 70,
        timeLimit: 15,
        maxAttempts: 3
      });
      store.questions.push({
        id: `q_${course.id}_1`,
        quizId,
        text: `\u0110i\u1EC3m m\u1EA1nh c\u1EE7a kh\xF3a h\u1ECDc ${course.title} l\xE0 g\xEC?`,
        type: "single",
        options: ["H\u1ECDc qua d\u1EF1 \xE1n th\u1EF1c t\u1EBF c\u1EE7a doanh nghi\u1EC7p", "H\u1ECDc xong kh\xF4ng c\u1EA7n l\xE0m b\xE0i", "C\u1EA5p ch\u1EE9ng nh\u1EADn m\xE0 kh\xF4ng c\u1EA7n h\u1ECDc", "N\u1ED9i dung \u0111\xE3 l\u1ED7i th\u1EDDi"],
        correctAnswer: "0"
      });
      store.questions.push({
        id: `q_${course.id}_2`,
        quizId,
        text: "Khi g\u1EB7p l\u1ED7i k\u1EF9 thu\u1EADt trong l\xFAc th\u1EF1c h\xE0nh, b\u1EA1n n\xEAn l\xE0m g\xEC?",
        type: "single",
        options: ["B\u1ECF qua v\xE0 h\u1ECDc ti\u1EBFp", "H\u1ECFi gi\u1EA3ng vi\xEAn ph\u1EE5 tr\xE1ch l\u1EDBp", "T\u1EF1 s\u1EEDa \u0111i\u1EC3m b\xE0i t\u1EADp", "N\u1ED9p b\xE0i tr\u1ED1ng"],
        correctAnswer: "1"
      });
    }
    if (!store.assignments.some((a) => a.courseId === course.id)) {
      store.assignments.push({
        id: `assign_${course.id}`,
        courseId: course.id,
        title: `B\xE0i t\u1EADp l\u1EDBn cu\u1ED1i kh\xF3a: ${course.title}`,
        description: "Ho\xE0n th\xE0nh d\u1EF1 \xE1n cu\u1ED1i kh\xF3a, \u0111\u1EA9y m\xE3 ngu\u1ED3n l\xEAn GitHub v\xE0 m\xF4 t\u1EA3 gi\u1EA3i ph\xE1p khi n\u1ED9p b\xE0i.",
        deadline: (/* @__PURE__ */ new Date("2026-07-15T23:59:59Z")).toISOString(),
        maxScore: 100,
        type: "final"
      });
      const courseLessons = store.lessons.filter((l) => l.courseId === course.id);
      if (courseLessons.length > 0) {
        store.assignments.push({
          id: `assign_lesson_${course.id}`,
          courseId: course.id,
          title: "B\xE0i t\u1EADp bu\u1ED5i 1",
          description: "Ho\xE0n th\xE0nh c\xE1c b\xE0i luy\u1EC7n t\u1EADp nh\u1ECF trong ph\u1EA7n n\u1ED9i dung c\u1EE7a bu\u1ED5i h\u1ECDc s\u1ED1 1.",
          deadline: (/* @__PURE__ */ new Date("2026-06-30T23:59:59Z")).toISOString(),
          maxScore: 100,
          lessonId: courseLessons[0].id,
          type: "lesson"
        });
      }
    }
  });
  const daysOfWeek = ["Th\u1EE9 Hai", "Th\u1EE9 Ba", "Th\u1EE9 T\u01B0", "Th\u1EE9 N\u0103m", "Th\u1EE9 S\xE1u", "Th\u1EE9 B\u1EA3y"];
  const rooms = ["Ph\xF2ng A101", "Ph\xF2ng A102", "Ph\xF2ng B201", "Ph\xF2ng B202", "Ph\xF2ng C301", "Ph\xF2ng C302", "Ph\xF2ng D401"];
  store.courses.forEach((course, index) => {
    const sectionId = `sec_${course.id}_01`;
    if (store.courseSections.some((sec) => sec.id === sectionId)) return;
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
  if (store.users.filter((u) => u.role === "student").length >= 100) return;
  const studentsToGen = 300 - store.users.filter((u) => u.role === "student").length;
  const newStudents = [];
  for (let i = 1; i <= studentsToGen; i++) {
    newStudents.push({
      id: `student_gen_${i}`,
      email: `st_${i}@mcna.local`,
      passwordHash: credential2("studente16", `seed_student_gen_${i}`).hash,
      passwordSalt: credential2("studente16", `seed_student_gen_${i}`).salt,
      name: generateName(),
      role: "student",
      isActive: true,
      createdAt: (/* @__PURE__ */ new Date("2026-01-03T00:00:00Z")).toISOString(),
      phone: "09" + Math.floor(1e7 + Math.random() * 9e7)
    });
  }
  store.users.push(...newStudents);
  newStudents.forEach((student, index) => {
    const pickedCourses = [...store.courses].sort(() => 0.5 - Math.random()).slice(0, 2);
    pickedCourses.forEach((course) => {
      const courseSuffix = course.id.replace("course_", "");
      const enrollId = `enroll_gen_${student.id}_${courseSuffix}`;
      store.enrollments.push({
        id: enrollId,
        courseId: course.id,
        studentId: student.id,
        status: "active",
        enrolledAt: (/* @__PURE__ */ new Date("2026-02-15T09:00:00Z")).toISOString()
      });
      store.lessonProgress.push({
        id: `progress_gen_${student.id}_${courseSuffix}_1`,
        enrollmentId: enrollId,
        lessonId: `lesson_en_${course.id}_1`,
        completed: true,
        completedAt: (/* @__PURE__ */ new Date("2026-02-20T10:00:00Z")).toISOString()
      });
      const score = Math.floor(65 + Math.random() * 35);
      store.quizAttempts.push({
        id: `attempt_gen_${student.id}_${courseSuffix}`,
        quizId: `quiz_${course.id}`,
        studentId: student.id,
        answers: { [`q_${course.id}_1`]: "0", [`q_${course.id}_2`]: "1" },
        score,
        passed: score >= 70,
        startedAt: (/* @__PURE__ */ new Date("2026-03-01T14:00:00Z")).toISOString(),
        submittedAt: (/* @__PURE__ */ new Date("2026-03-01T14:12:00Z")).toISOString()
      });
      const isPaid = Math.random() > 0.4;
      const isPending = !isPaid && Math.random() > 0.3;
      if (isPaid) {
        const paidAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1e3).toISOString();
        store.transactions.push({
          id: `tx_gen_${student.id}_${courseSuffix}`,
          studentId: student.id,
          courseId: course.id,
          amount: course.price || 2e6,
          status: "approved",
          paymentMethod: "Chuy\u1EC3n kho\u1EA3n ng\xE2n h\xE0ng",
          createdAt: paidAt,
          processedAt: paidAt,
          processedBy: "user_admin",
          notes: "Giao d\u1ECBch chuy\u1EC3n kho\u1EA3n \u0111\xE3 \u0111\u01B0\u1EE3c x\xE1c nh\u1EADn"
        });
      } else if (isPending) {
        store.transactions.push({
          id: `tx_gen_${student.id}_${courseSuffix}`,
          studentId: student.id,
          courseId: course.id,
          amount: course.price || 2e6,
          status: "pending",
          paymentMethod: "Chuy\u1EC3n kho\u1EA3n ng\xE2n h\xE0ng",
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1e3).toISOString()
        });
      }
    });
    pickedCourses.forEach((course) => {
      const section = store.courseSections.find((sec) => sec.courseId === course.id);
      if (!section) return;
      const registrationId = `cr_${student.id}_${section.id}`;
      if (store.courseRegistrations.some((r) => r.id === registrationId)) return;
      const placed = store.courseRegistrations.filter((r) => r.sectionId === section.id && r.status === "registered").length;
      if (placed >= section.maxStudents) return;
      store.courseRegistrations.push({
        id: registrationId,
        studentId: student.id,
        sectionId: section.id,
        status: "registered",
        registeredAt: (/* @__PURE__ */ new Date("2026-02-16T09:00:00Z")).toISOString(),
        credits: 3
      });
    });
    void index;
  });
  store.courseSections.forEach((section) => {
    const sessions = [
      { id: `sess_${section.id}_1`, date: "2026-09-15T08:00:00Z", topic: "Bu\u1ED5i 1: Gi\u1EDBi thi\u1EC7u \u0111\u1EC1 c\u01B0\u01A1ng v\xE0 l\u1ED9 tr\xECnh h\u1ECDc" },
      { id: `sess_${section.id}_2`, date: "2026-09-22T08:00:00Z", topic: "Bu\u1ED5i 2: Ki\u1EBFn th\u1EE9c n\u1EC1n t\u1EA3ng v\xE0 b\xE0i th\u1EF1c h\xE0nh" }
    ];
    sessions.forEach(({ id, date, topic }) => {
      if (store.attendanceSessions.some((s) => s.id === id)) return;
      store.attendanceSessions.push({
        id,
        courseId: section.courseId,
        sectionId: section.id,
        teacherId: section.teacherId,
        date,
        topic
      });
      const statuses = ["present", "present", "present", "late", "absent", "excused"];
      store.courseRegistrations.filter((r) => r.sectionId === section.id).forEach((registration) => {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        store.attendanceRecords.push({
          id: `att_${id}_${registration.studentId}`,
          sessionId: id,
          studentId: registration.studentId,
          status,
          note: status === "late" ? "\u0110i mu\u1ED9n 10 ph\xFAt" : status === "absent" ? "Ngh\u1EC9 kh\xF4ng ph\xE9p" : ""
        });
      });
    });
  });
}

// src/server/repositories/users.ts
var usersRepository = {
  async normalizeLegacyRoles(db) {
    await db.query(`
      UPDATE users SET role = 'admin' WHERE role IN ('ke_toan', 'finance', 'le_tan', 'sale', 'quan_ly_hoc_vu', 'academic', 'academic_admin');
      UPDATE users SET role = 'teacher' WHERE role = 'advisor';
    `);
  },
  async normalizeSystemUsers(db) {
    const systemUsers = [
      ["admin@mcna.local", "Arthur Pendragon", "admin"],
      ["teacher@mcna.local", "Prof. Linus Torvalds", "teacher"]
    ];
    for (const [email, name, role] of systemUsers) {
      await db.query(
        "UPDATE users SET name = $1, role = $2 WHERE lower(email) = $3",
        [name, role, email]
      );
    }
  },
  async count(db) {
    return Number((await db.query("SELECT COUNT(*) AS count FROM users")).rows[0].count);
  },
  async findAuthByEmail(db, email) {
    const cleanEmail = email.toLowerCase().trim();
    const exactMatch = (await db.query("SELECT * FROM users WHERE lower(email) = $1", [cleanEmail])).rows[0];
    if (exactMatch) return exactMatch;
    if (cleanEmail.endsWith("@e16.local")) {
      const mappedEmail = cleanEmail.replace("@e16.local", "@mcna.local");
      const mappedMatch = (await db.query("SELECT * FROM users WHERE lower(email) = $1", [mappedEmail])).rows[0];
      if (mappedMatch) return mappedMatch;
    }
    if (cleanEmail.endsWith("@mcna.local")) {
      const mappedEmail = cleanEmail.replace("@mcna.local", "@e16.local");
      const mappedMatch = (await db.query("SELECT * FROM users WHERE lower(email) = $1", [mappedEmail])).rows[0];
      if (mappedMatch) return mappedMatch;
    }
    return null;
  },
  async findById(db, id) {
    const row = (await db.query("SELECT * FROM users WHERE id = $1", [id])).rows[0];
    return row ? toPublicUser(row) : null;
  },
  async list(db) {
    return (await db.query("SELECT * FROM users ORDER BY created_at DESC")).rows.map(toPublicUser);
  },
  async create(db, user) {
    await db.query(
      `INSERT INTO users (id, email, password_hash, password_salt, name, role, is_active, phone, linked_student_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [user.id, user.email.toLowerCase(), user.passwordHash, user.passwordSalt || null, user.name, denormalizeRole(user.role), user.isActive, user.phone || null, user.linkedStudentId || null, user.createdAt]
    );
    return { ...user, passwordHash: "" };
  },
  async seed(db, users) {
    for (const user of users) {
      await db.query(
        `INSERT INTO users (id, email, password_hash, password_salt, name, role, is_active, phone, linked_student_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, user.email.toLowerCase(), user.passwordHash, user.passwordSalt || null, user.name, denormalizeRole(user.role), user.isActive, user.phone || null, user.linkedStudentId || null, user.createdAt]
      );
    }
  },
  async setActive(db, id, isActive) {
    const row = (await db.query("UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *", [isActive, id])).rows[0];
    return row ? toPublicUser(row) : null;
  }
};

// src/server/emailProvisioning/googleWorkspaceClient.ts
import { google } from "googleapis";
import { JWT } from "google-auth-library";
var SCHOOL_EMAIL_DOMAIN = process.env.SCHOOL_EMAIL_DOMAIN || "mcna.edu.vn";
var GOOGLE_ADMIN_EMAIL = process.env.GOOGLE_ADMIN_EMAIL || `admin@${SCHOOL_EMAIL_DOMAIN}`;
var GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
function generateUsername(fullName) {
  const normalized = fullName.replace(/[đ]/g, "d").replace(/[Đ]/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const parts = normalized.toLowerCase().split(/\s+/).filter((p) => p.trim().length > 0);
  return parts.reverse().join(".");
}
function hasGoogleCredentials() {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) return false;
  try {
    const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    return creds && creds.client_email && creds.private_key;
  } catch {
    return false;
  }
}
function getAuthClient() {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured.");
  }
  const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/admin.directory.user"],
    subject: GOOGLE_ADMIN_EMAIL
  });
}
function getDirectoryClient() {
  const auth = getAuthClient();
  return google.admin({ version: "directory_v1", auth });
}
function generateTempPassword() {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const allChars = lowercase + uppercase + numbers + symbols;
  let pass = "";
  pass += lowercase[Math.floor(Math.random() * lowercase.length)];
  pass += uppercase[Math.floor(Math.random() * uppercase.length)];
  pass += numbers[Math.floor(Math.random() * numbers.length)];
  pass += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = 0; i < 8; i++) {
    pass += allChars[Math.floor(Math.random() * allChars.length)];
  }
  return pass.split("").sort(() => 0.5 - Math.random()).join("");
}
async function createSchoolEmail(pool2, user) {
  const baseUsername = generateUsername(user.name);
  let suffix = "";
  let counter = 1;
  let username = baseUsername;
  let schoolEmail = `${username}@${SCHOOL_EMAIL_DOMAIN}`;
  let isUnique = false;
  while (!isUnique) {
    schoolEmail = `${username}${suffix}@${SCHOOL_EMAIL_DOMAIN}`;
    const dbCheck = await pool2.query(
      "SELECT 1 FROM users WHERE school_email = $1 OR email = $1",
      [schoolEmail]
    );
    if (dbCheck.rows.length > 0) {
      counter++;
      suffix = String(counter);
      continue;
    }
    if (hasGoogleCredentials()) {
      try {
        const admin = getDirectoryClient();
        await admin.users.get({ userKey: schoolEmail });
        counter++;
        suffix = String(counter);
        continue;
      } catch (err) {
        if (err.code === 404) {
          isUnique = true;
        } else {
          console.error("[GoogleWorkspace] Directory API call failed:", err);
          throw err;
        }
      }
    } else {
      isUnique = true;
    }
  }
  const tempPassword = generateTempPassword();
  if (hasGoogleCredentials()) {
    try {
      const admin = getDirectoryClient();
      console.log(`[GoogleWorkspace] Provisioning user ${schoolEmail} on Workspace...`);
      await admin.users.insert({
        requestBody: {
          primaryEmail: schoolEmail,
          name: {
            givenName: user.name.split(" ").slice(-1)[0] || user.name,
            familyName: user.name.split(" ").slice(0, -1).join(" ") || user.name
          },
          password: tempPassword,
          changePasswordAtNextLogin: true
        }
      });
      console.log(`[GoogleWorkspace] Provisioned user ${schoolEmail} successfully.`);
    } catch (err) {
      if (err.code === 409) {
        console.warn(`[GoogleWorkspace] Concurrency conflict: ${schoolEmail} already exists. Retrying creation...`);
        return createSchoolEmail(pool2, user);
      }
      throw err;
    }
  } else {
    console.log(
      `[GoogleWorkspace MOCK] Simulating user creation for: ${schoolEmail} (Password: ${tempPassword})`
    );
  }
  return { schoolEmail, tempPassword };
}
async function deleteSchoolEmail(schoolEmail) {
  if (hasGoogleCredentials()) {
    try {
      const admin = getDirectoryClient();
      console.log(`[GoogleWorkspace] Deleting user ${schoolEmail} from Workspace...`);
      await admin.users.delete({ userKey: schoolEmail });
      console.log(`[GoogleWorkspace] Deleted user ${schoolEmail} successfully.`);
    } catch (err) {
      if (err.code === 404) {
        console.warn(`[GoogleWorkspace] User ${schoolEmail} not found on Workspace for deletion.`);
        return;
      }
      throw err;
    }
  } else {
    console.log(`[GoogleWorkspace MOCK] Simulating deletion of: ${schoolEmail}`);
  }
}

// src/server/data/mcnaCatalog.json
var mcnaCatalog_default = {
  source: "https://mcna.vn",
  scrapedAt: "2026-09-14",
  note: "Kh\xF3a l\u1EBB b\u1EA3n m\u1EDBi nh\u1EA5t tr\xEAn mcna.vn v\xE0 l\u1ECBch khai gi\u1EA3ng th\xE1ng 09/2026. Web kh\xF4ng c\xF4ng b\u1ED1 h\u1ECDc ph\xED: defaultPrice l\xE0 gi\xE1 t\u1EA1m \u0111\u1EC3 th\u1EED, s\u1EEDa l\u1EA1i trong LMS.",
  defaultPrice: 299e4,
  defaultMaxStudents: 30,
  courses: [
    {
      key: "ai_for_work",
      code: "AI_WORK",
      title: "AI for Work: T\u1ED1i \u01B0u hi\u1EC7u su\u1EA5t & t\u1EF1 \u0111\u1ED9ng h\xF3a c\xF4ng vi\u1EC7c",
      englishName: "AI For Work",
      category: "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o (AI)",
      level: "C\u01A1 b\u1EA3n",
      description: "Kh\xF3a h\u1ECDc AI for Work t\u1EA1i MCNA gi\xFAp b\u1EA1n l\xE0m ch\u1EE7 K\u1EF9 thu\u1EADt Prompt Engineering, \u1EE9ng d\u1EE5ng ChatGPT, Gemini, Copilot v\xE0 c\xE1c c\xF4ng c\u1EE5 AI t\u1EA1o sinh \u0111\u1EC3 t\u0103ng 200% hi\u1EC7u su\u1EA5t v\u0103n ph\xF2ng.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2026/07/1784088138427_3816359707153636430_g2445526069388021576_0cabe2b9d3ee2bd84a0aa40aa4e9093d.jpg",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-ai-for-work-toi-uu-hieu-suat/",
      sessions: [
        { title: "Prompt & T\u1EA1o Slide", content: "C\xE1ch vi\u1EBFt prompt hi\u1EC7u qu\u1EA3, chu\u1EA9n x\xE1c \u0111\u1EC3 AI hi\u1EC3u \u0111\xFAng \xFD b\u1EA1n. \u1EE8ng d\u1EE5ng c\xF4ng ngh\u1EC7 AI \u0111\u1EC3 thi\u1EBFt k\u1EBF slide chuy\xEAn nghi\u1EC7p, nhanh ch\xF3ng." },
        { title: "AI cho Office", content: "AI trong Word: h\u1ED7 tr\u1EE3 vi\u1EBFt l\xE1ch, t\xF3m t\u1EAFt v\xE0 ch\u1EC9nh s\u1EEDa v\u0103n b\u1EA3n. AI trong Excel: ph\xE2n t\xEDch d\u1EEF li\u1EC7u nhanh v\xE0 t\u1ED1i \u01B0u c\xF4ng th\u1EE9c h\xE0m ph\u1EE9c t\u1EA1p. AI trong PowerPoint: t\u1EF1 \u0111\u1ED9ng t\u1EA1o slide thuy\u1EBFt tr\xECnh nhanh v\xE0 \u0111\u1EB9p m\u1EAFt." },
        { title: "Ph\xE2n t\xEDch d\u1EEF li\u1EC7u", content: "S\u1EED d\u1EE5ng AI ph\xE2n t\xEDch kh\u1ED1i l\u01B0\u1EE3ng l\u1EDBn d\u1EEF li\u1EC7u c\u1EF1c nhanh. Tr\u1EF1c quan h\xF3a s\u1ED1 li\u1EC7u v\xE0 thi\u1EBFt l\u1EADp b\xE1o c\xE1o th\xF4ng minh c\xF9ng Claude AI." },
        { title: "Giao ti\u1EBFp & Nghi\xEAn c\u1EE9u", content: "T\u1ED1i \u01B0u h\xF3a qu\u1EA3n l\xFD email c\xE1 nh\xE2n v\xE0 s\u1EAFp x\u1EBFp l\u1ECBch l\xE0m vi\u1EC7c khoa h\u1ECDc. \u1EE8ng d\u1EE5ng AI nghi\xEAn c\u1EE9u th\xF4ng tin chuy\xEAn s\xE2u v\xE0 t\u1ED5ng h\u1EE3p d\u1EEF li\u1EC7u t\u1ED1c h\xE0nh." },
        { title: "Quy tr\xECnh & T\u1EF1 \u0111\u1ED9ng h\xF3a", content: "Thi\u1EBFt l\u1EADp h\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng h\xF3a c\xE1c c\xF4ng vi\u1EC7c v\u0103n ph\xF2ng l\u1EB7p \u0111i l\u1EB7p l\u1EA1i h\xE0ng ng\xE0y. X\xE2y d\u1EF1ng v\xE0 t\u1ED1i \u01B0u h\xF3a \u1EE9ng d\u1EE5ng AI c\xE1 nh\xE2n hi\u1EC7u qu\u1EA3 cho ri\xEAng b\u1EA1n." }
      ]
    },
    {
      key: "ai_agent",
      code: "AI_AGENT",
      title: "AI Agent Masterclass: X\xE2y d\u1EF1ng tr\u1EE3 l\xFD \u1EA3o t\u1EF1 \u0111\u1ED9ng 24/7",
      englishName: "AI Agent Masterclass",
      category: "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o (AI)",
      level: "Trung c\u1EA5p",
      description: "Kh\xF3a h\u1ECDc AI Agent Masterclass t\u1EA1i MCNA v\u1EDBi l\u1ED9 tr\xECnh 5 bu\u1ED5i th\u1EF1c chi\u1EBFn. Gi\xFAp b\u1EA1n l\xE0m ch\u1EE7 c\xF4ng ngh\u1EC7 no-code & code, x\xE2y d\u1EF1ng tr\u1EE3 l\xFD th\xF4ng minh l\xE0m vi\u1EC7c t\u1EF1 \u0111\u1ED9ng 24/7.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2026/07/47def052-0740-4555-8c3c-03fab39a7773.png",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-ai-agent-masterclass-tu-dong-hoa/",
      sessions: [
        { title: "AI Agent Foundation", content: "Hi\u1EC3u b\u1EA3n ch\u1EA5t AI Agent v\xE0 xu h\u01B0\u1EDBng c\xF4ng ngh\u1EC7. T\xECm hi\u1EC3u Prompt Engineering, RAG, Memory, Tool Calling, MCP. Th\u1EF1c h\xE0nh: t\u1EA1o AI Agent \u0111\u1EA7u ti\xEAn." },
        { title: "No-code AI Agent", content: "L\xE0m ch\u1EE7 c\xE1c n\u1EC1n t\u1EA3ng n8n, Flowise, Dify, Langflow. \u1EE8ng d\u1EE5ng Workflow, Memory, Tool, PDF, RAG. Th\u1EF1c h\xE0nh: t\u1EA1o Chatbot CSKH v\xE0 AI tra c\u1EE9u t\xE0i li\u1EC7u." },
        { title: "Code AI Agent", content: "S\u1EED d\u1EE5ng Python, OpenAI API, LangChain, LangGraph, CrewAI, AutoGen, MCP Server. Th\u1EF1c h\xE0nh: l\xE0m AI Research, vi\u1EBFt b\xE1o c\xE1o v\xE0 ph\xE2n t\xEDch Excel t\u1EF1 \u0111\u1ED9ng." },
        { title: "AI Agent cho Doanh nghi\u1EC7p", content: "T\xEDch h\u1EE3p AI v\xE0o Gmail, Drive, Sheets, Notion, Slack, Telegram, Discord, CRM. Th\u1EF1c h\xE0nh: x\xE2y d\u1EF1ng h\u1EC7 th\u1ED1ng AI Sale Automation v\xE0 Marketing Automation." },
        { title: "Tri\u1EC3n khai & Ki\u1EBFm ti\u1EC1n", content: "Deploy h\u1EC7 th\u1ED1ng v\u1EDBi VPS, Cloud, Docker, API, Authentication. Theo d\xF5i ho\u1EA1t \u0111\u1ED9ng v\xE0 t\u1ED1i \u01B0u chi ph\xED. H\u01B0\u1EDBng \u0111i Freelance, s\u0103n d\u1EF1 \xE1n AI Agent, ph\xE1t tri\u1EC3n AI SaaS, Agency." }
      ]
    },
    {
      key: "ai_automation",
      code: "AI_AUTO",
      title: "AI Automation: X\xE2y d\u1EF1ng h\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng h\xF3a doanh nghi\u1EC7p",
      englishName: "AI Automation",
      category: "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o (AI)",
      level: "Trung c\u1EA5p",
      description: "Kh\xF3a h\u1ECDc AI Automation t\u1EA1i MCNA v\u1EDBi l\u1ED9 tr\xECnh 5 bu\u1ED5i th\u1EF1c chi\u1EBFn gi\xFAp b\u1EA1n k\u1EBFt n\u1ED1i \u0111a n\u1EC1n t\u1EA3ng, x\xE2y d\u1EF1ng quy tr\xECnh t\u1EF1 \u0111\u1ED9ng h\xF3a chuy\xEAn s\xE2u v\xE0 t\u1ED1i \u01B0u chi ph\xED v\u1EADn h\xE0nh.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2026/07/66ef5f30-3018-4d66-b254-36770e048277.png",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-ai-automation-chuan-doanh-nghiep/",
      sessions: [
        { title: "N\u1EC1n t\u1EA3ng t\u1EF1 \u0111\u1ED9ng h\xF3a", content: "T\u1ED5ng quan v\u1EC1 Automation v\xE0 c\xE1c n\u1EC1n t\u1EA3ng ph\u1ED5 bi\u1EBFn. L\xE0m quen Make.com, n8n, Zapier, API, Webhook, JSON. Thi\u1EBFt k\u1EBF quy tr\xECnh t\u1EF1 \u0111\u1ED9ng h\xF3a hi\u1EC7u qu\u1EA3." },
        { title: "X\xE2y d\u1EF1ng Workflow chuy\xEAn s\xE2u", content: "X\u1EED l\xFD d\u1EEF li\u1EC7u: l\u1ECDc, ph\xE2n lo\u1EA1i, \u0111i\u1EC1u ki\u1EC7n, v\xF2ng l\u1EB7p. T\xEDch h\u1EE3p AI g\u1ED3m ChatGPT, OCR, ph\xE2n t\xEDch d\u1EEF li\u1EC7u. K\u1EBFt n\u1ED1i Email, Sheets, CRM, Slack." },
        { title: "T\xEDch h\u1EE3p API & D\u1EEF li\u1EC7u n\xE2ng cao", content: "L\xE0m vi\u1EC7c v\u1EDBi API, Webhook, Authentication. K\u1EBFt n\u1ED1i Database g\u1ED3m Google Sheets, Airtable, SQL. X\u1EED l\xFD v\xE0 \u0111\u1ED3ng b\u1ED9 d\u1EEF li\u1EC7u t\u1EF1 \u0111\u1ED9ng." },
        { title: "Tri\u1EC3n khai & Gi\xE1m s\xE1t h\u1EC7 th\u1ED1ng", content: "Deploy l\xEAn Cloud/VPS, Cron Job, Scheduling. C\xE0i \u0111\u1EB7t h\u1EC7 th\u1ED1ng Monitoring, Logging, Error Handling. T\u1ED1i \u01B0u hi\u1EC7u su\u1EA5t v\xE0 chi ph\xED h\u1EC7 th\u1ED1ng." },
        { title: "D\u1EF1 \xE1n th\u1EF1c t\u1EBF & \u1EE8ng d\u1EE5ng", content: "X\xE2y d\u1EF1ng h\u1EC7 th\u1ED1ng Automation ho\xE0n ch\u1EC9nh. \u1EE8ng d\u1EE5ng th\u1EF1c t\u1EBF cho Sales, Marketing, CSKH, HR, Finance. M\u1EDF r\u1ED9ng v\xE0 t\u1ED1i \u01B0u theo nhu c\u1EA7u doanh nghi\u1EC7p." }
      ]
    },
    {
      key: "ai_leader",
      code: "AI_LEAD",
      title: "AI cho l\xE3nh \u0111\u1EA1o: Chi\u1EBFn l\u01B0\u1EE3c & l\u1ED9 tr\xECnh 90 ng\xE0y",
      englishName: "AI for Leaders",
      category: "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o (AI)",
      level: "C\u01A1 b\u1EA3n",
      description: "Kh\xF3a h\u1ECDc AI cho l\xE3nh \u0111\u1EA1o th\u1EF1c chi\u1EBFn t\u1EA1i MCNA. Trang b\u1ECB t\u01B0 duy chi\u1EBFn l\u01B0\u1EE3c, ch\u1ECDn \u0111\xFAng b\xE0i to\xE1n v\xE0 x\xE2y d\u1EF1ng l\u1ED9 tr\xECnh 90 ng\xE0y b\u1EE9t ph\xE1 cho doanh nghi\u1EC7p.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2026/08/AI-for-Boss_V2.png",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-ai-cho-lanh-dao-mcna/",
      sessions: [
        { title: "B\u1EE9c tranh AI & C\u01A1 h\u1ED9i theo ng\xE0nh", content: "T\u1ED5ng quan v\u1EC1 AI v\xE0 xu h\u01B0\u1EDBng \u1EE9ng d\u1EE5ng. Nh\u1EADn di\u1EC7n 10+ use case kh\u1EA3 thi. X\xE1c \u0111\u1ECBnh \u0111i\u1EC3m ngh\u1EBDn v\u1EADn h\xE0nh c\u1EA7n \u01B0u ti\xEAn. \u0110\u1EA7u ra: danh s\xE1ch \u0111i\u1EC3m ngh\u1EBDn v\xE0 c\u01A1 h\u1ED9i AI chuy\xEAn bi\u1EC7t." },
        { title: "\u0110\xE1nh gi\xE1 s\u1EB5n s\xE0ng & Ch\u1ECDn b\xE0i to\xE1n", content: "\u0110\xE1nh gi\xE1 m\u1EE9c \u0111\u1ED9 s\u1EB5n s\xE0ng c\u1EE7a t\u1ED5 ch\u1EE9c. L\u1EF1a ch\u1ECDn 2-3 b\xE0i to\xE1n gi\xE1 tr\u1ECB cao. Th\u1EF1c h\xE0nh vi\u1EBFt m\xF4 t\u1EA3 b\xE0i to\xE1n chu\u1EA9n. \u0110\u1EA7u ra: ch\u1ED1t 2-3 b\xE0i to\xE1n c\u1ED1t l\xF5i c\xF3 c\u0103n c\u1EE9 r\xF5 r\xE0ng." },
        { title: "X\xE2y l\u1ED9 tr\xECnh & Qu\u1EA3n tr\u1ECB r\u1EE7i ro", content: "X\xE1c \u0111\u1ECBnh ph\u01B0\u01A1ng \xE1n: Build, Buy hay H\u1EE3p t\xE1c. \u01AF\u1EDBc t\xEDnh ng\xE2n s\xE1ch, ngu\u1ED3n l\u1EF1c, th\u1EDDi gian. Ph\xE1c th\u1EA3o l\u1ED9 tr\xECnh 90 ng\xE0y k\xE8m qu\u1EA3n tr\u1ECB r\u1EE7i ro. \u0110\u1EA7u ra: l\u1ED9 tr\xECnh 90 ng\xE0y kh\u1EA3 thi." },
        { title: "D\u1EABn d\u1EAFt chuy\u1EC3n \u0111\u1ED5i & Ho\xE0n thi\u1EC7n", content: "Thi\u1EBFt l\u1EADp h\u1EC7 th\u1ED1ng KPI. So\u1EA1n th\u1EA3o th\xF4ng \u0111i\u1EC7p truy\u1EC1n th\xF4ng n\u1ED9i b\u1ED9. Tr\xECnh b\xE0y k\u1EBF ho\u1EA1ch v\xE0 nh\u1EADn ph\u1EA3n h\u1ED3i. \u0110\u1EA7u ra: b\u1EA3n tr\xECnh b\xE0y l\u1ED9 tr\xECnh s\u1EB5n s\xE0ng tri\u1EC3n khai." }
      ]
    },
    {
      key: "ai_research",
      code: "AI_RSCH",
      title: "AI for Research: Bi\u1EBFn \u0111\u1EC1 t\xE0i th\xE0nh s\u1EA3n ph\u1EA9m th\u1EADt trong 3 bu\u1ED5i",
      englishName: "AI for Research",
      category: "Tr\xED tu\u1EC7 nh\xE2n t\u1EA1o (AI)",
      level: "Trung c\u1EA5p",
      description: "Kh\xF3a h\u1ECDc AI for Research gi\u1EDBi h\u1EA1n 10-15 h\u1ECDc vi\xEAn t\u1EA1i MCNA. L\u1ED9 tr\xECnh 3 bu\u1ED5i th\u1EF1c chi\u1EBFn tr\xEAn \u0111\u1EC1 t\xE0i ri\xEAng, cam k\u1EBFt c\xF3 s\u1EA3n ph\u1EA9m th\u1EADt (Skill/Agent).",
      thumbnail: "https://mcna.vn/wp-content/uploads/2026/09/9664af82-0bc1-4aed-be59-82456bce062f.png",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-ai-for-research/",
      sessions: [
        { title: "Thi\u1EBFt l\u1EADp khung nghi\xEAn c\u1EE9u & khai th\xE1c t\xE0i li\u1EC7u th\xF4ng minh", content: "Chu\u1EA9n h\xF3a c\u1EA5u tr\xFAc \u0111\u1EC1 t\xE0i v\xE0 x\xE1c \u0111\u1ECBnh b\xE0i to\xE1n nghi\xEAn c\u1EE9u c\u1ED1t l\xF5i. Khai th\xE1c Perplexity & AI chuy\xEAn s\xE2u \u0111\u1EC3 t\u1ED5ng h\u1EE3p t\xE0i li\u1EC7u, t\xECm ki\u1EBFm paper uy t\xEDn. Tr\xEDch xu\u1EA5t v\xE0 l\u1ECDc d\u1EEF li\u1EC7u th\xF4 ph\u1EE5c v\u1EE5 ph\u1EA7n Literature Review." },
        { title: "X\u1EED l\xFD d\u1EEF li\u1EC7u & ph\xE2n t\xEDch chuy\xEAn s\xE2u c\xF9ng AI", content: "\u1EE8ng d\u1EE5ng Claude v\xE0 ChatGPT x\xE2y d\u1EF1ng khung ph\u01B0\u01A1ng ph\xE1p nghi\xEAn c\u1EE9u. K\u1EF9 thu\u1EADt prompting n\xE2ng cao \u0111\u1EC3 x\u1EED l\xFD b\u1EA3ng bi\u1EC3u v\xE0 b\xF3c t\xE1ch insight. Gi\u1EA3i quy\u1EBFt \u0111i\u1EC3m ngh\u1EBDn logic tr\u1EF1c ti\u1EBFp c\xF9ng gi\u1EA3ng vi\xEAn." },
        { title: "T\u1EF1 \u0111\u1ED9ng h\xF3a & \u0111\xF3ng g\xF3i s\u1EA3n ph\u1EA9m nghi\xEAn c\u1EE9u (Skill/Agent)", content: "T\xEDch h\u1EE3p quy tr\xECnh th\xE0nh h\u1EC7 th\u1ED1ng t\u1EF1 \u0111\u1ED9ng h\xF3a c\xE1 nh\xE2n h\xF3a. T\u1EF1 tay x\xE2y d\u1EF1ng v\xE0 t\u1ED1i \u01B0u Skill/Agent ri\xEAng cho \u0111\u1EC1 t\xE0i. Review s\u1EA3n ph\u1EA9m 1:1 v\xE0 ho\xE0n thi\u1EC7n to\xE0n b\u1ED9 h\u1EC7 th\u1ED1ng ngay t\u1EA1i l\u1EDBp." }
      ]
    },
    {
      key: "pbi_lv1",
      code: "PBI_LV1",
      title: "Power BI Level 1: Ph\xE2n t\xEDch & tr\u1EF1c quan h\xF3a d\u1EEF li\u1EC7u",
      englishName: "Power BI Essentials: Data Analysis & Visualization",
      category: "Power BI & Business Intelligence",
      level: "C\u01A1 b\u1EA3n",
      description: "Kh\xF3a h\u1ECDc Power BI Level 1 t\u1EA1i MCNA: h\u1ECDc Power Query, Data Modeling, DAX, d\u1EF1ng Dashboard chuy\xEAn nghi\u1EC7p ch\u1EC9 sau 7 bu\u1ED5i.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2026/07/1d864ccb-b01c-43d9-936c-989b40db7881.png",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-power-bi-level-1/",
      sessions: [
        { title: "T\u1ED5ng quan Power BI", content: "L\xE0m quen v\u1EDBi giao di\u1EC7n v\xE0 hi\u1EC3u tr\u1ECDn v\u1EB9n quy tr\xECnh t\u1EEB nh\u1EADp d\u1EEF li\u1EC7u \u0111\u1EBFn t\u1EA1o b\xE1o c\xE1o." },
        { title: "K\u1EBFt n\u1ED1i d\u1EEF li\u1EC7u", content: "H\u1ECDc c\xE1ch \u0111\u01B0a d\u1EEF li\u1EC7u v\xE0o Power BI t\u1EEB c\xE1c ngu\u1ED3n ph\u1ED5 bi\u1EBFn nh\u01B0 Excel, CSV\u2026" },
        { title: "Power Query c\u01A1 b\u1EA3n", content: "Th\u1EF1c h\xE0nh chu\u1EA9n h\xF3a d\u1EEF li\u1EC7u: l\u1ECDc, \u0111\u1ED5i ki\u1EC3u d\u1EEF li\u1EC7u, x\xF3a c\u1ED9t v\xE0 x\u1EED l\xFD l\u1ED7i c\u01A1 b\u1EA3n." },
        { title: "Thi\u1EBFt k\u1EBF Data Model", content: "H\u1ECDc c\xE1ch t\u1EA1o quan h\u1EC7 gi\u1EEFa c\xE1c b\u1EA3ng v\xE0 x\xE2y d\u1EF1ng m\xF4 h\xECnh d\u1EEF li\u1EC7u t\u1ED1i \u01B0u nh\u1EA5t." },
        { title: "DAX c\u01A1 b\u1EA3n", content: "Th\u1EF1c h\xE0nh vi\u1EBFt c\xE1c h\xE0m Measure, Calculated Column \u1EE9ng d\u1EE5ng cho b\xE1o c\xE1o doanh nghi\u1EC7p." },
        { title: "Visualization & T\u01B0\u01A1ng t\xE1c", content: "Thi\u1EBFt k\u1EBF bi\u1EC3u \u0111\u1ED3, KPI Card v\xE0 thi\u1EBFt l\u1EADp t\xEDnh n\u0103ng t\u01B0\u01A1ng t\xE1c th\xF4ng minh cho b\xE1o c\xE1o." },
        { title: "D\u1EF1 \xE1n cu\u1ED1i kh\xF3a", content: "X\xE2y d\u1EF1ng Dashboard ho\xE0n ch\u1EC9nh t\u1EEB \u0111\u1EA7u, gi\xFAp t\u1ED5ng h\u1EE3p ki\u1EBFn th\u1EE9c v\xE0 l\xE0m s\u1EA3n ph\u1EA9m Portfolio." }
      ]
    },
    {
      key: "pbi_lv2",
      code: "PBI_LV2",
      title: "Power BI Level 2: Gi\u1EA3i ph\xE1p Business Intelligence",
      englishName: "Power BI in Action: Business Intelligence Solutions",
      category: "Power BI & Business Intelligence",
      level: "N\xE2ng cao",
      description: "Kh\xF3a h\u1ECDc Power BI n\xE2ng cao gi\xFAp b\u1EA1n l\xE0m ch\u1EE7 DAX n\xE2ng cao, t\xEDch h\u1EE3p AI, thi\u1EBFt l\u1EADp b\u1EA3o m\u1EADt RLS v\xE0 t\u1ED1i \u01B0u h\xF3a h\u1EC7 th\u1ED1ng Dashboard th\u1EF1c chi\u1EBFn cho doanh nghi\u1EC7p.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2026/07/8efd7113-738e-48ae-89e2-a79eb2c531c7.png",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-power-bi-nang-cao-2/",
      sessions: [
        { title: "T\u01B0 duy & DAX n\xE2ng cao (P1)", content: "B\u1EAFt \u0111\u1EA7u h\u1ECDc c\xE1c c\xF4ng th\u1EE9c ph\u1EE9c t\u1EA1p, th\u1EA5u hi\u1EC3u c\u01A1 ch\u1EBF Filter Context v\xE0 Row Context \u0111\u1EC3 x\u1EED l\xFD d\u1EEF li\u1EC7u chu\u1EA9n x\xE1c." },
        { title: "Advanced DAX & Calculated Table (P2)", content: "\u1EE8ng d\u1EE5ng c\xE1c h\xE0m DAX n\xE2ng cao \u0111\u1EC3 kh\u1EDFi t\u1EA1o Calculated Table ph\u1EE5c v\u1EE5 c\xE1c b\xE0i to\xE1n so s\xE1nh, d\u1EF1 b\xE1o ph\xE2n t\xEDch." },
        { title: "Tr\u1EF1c quan h\xF3a d\u1EEF li\u1EC7u chuy\xEAn s\xE2u", content: "X\xE2y d\u1EF1ng bi\u1EC3u \u0111\u1ED3 \u0111\u1ED9ng, thi\u1EBFt l\u1EADp \u0111\u1ECBnh d\u1EA1ng c\xF3 \u0111i\u1EC1u ki\u1EC7n (Conditional Formatting) v\xE0 l\u1ED3ng gh\xE9p c\xE1c y\u1EBFu t\u1ED1 AI tr\u1EF1c quan." },
        { title: "T\xF9y ch\u1EC9nh t\u01B0\u01A1ng t\xE1c b\xE1o c\xE1o n\xE2ng cao", content: "N\xE2ng t\u1EA7m UX/UI b\xE1o c\xE1o th\xF4ng qua vi\u1EC7c t\u1ED1i \u01B0u Slicer, \u1EE9ng d\u1EE5ng linh ho\u1EA1t Bookmark v\xE0 Drillthrough." },
        { title: "B\u1EA3o m\u1EADt & Ph\xE2n quy\u1EC1n RLS", content: "Qu\u1EA3n l\xFD v\xE0 thi\u1EBFt l\u1EADp b\u1EA3o m\u1EADt Row-Level Security (RLS): ph\xE2n quy\u1EC1n xem s\u1ED1 li\u1EC7u theo v\u1ECB tr\xED/ph\xF2ng ban." },
        { title: "Tri\u1EC3n khai Power BI Service & AI Dashboard", content: "L\xE0m ch\u1EE7 Power BI Cloud/Service, chia s\u1EBB b\xE1o c\xE1o an to\xE0n trong t\u1ED5 ch\u1EE9c, \u1EE9ng d\u1EE5ng AI & Copilot \u0111\u1EC3 t\u1ED1i \u01B0u Dashboard." },
        { title: "D\u1EF1 \xE1n cu\u1ED1i kh\xF3a & T\u1ED1i \u01B0u h\xF3a hi\u1EC7u su\u1EA5t", content: "X\xE2y d\u1EF1ng gi\u1EA3i ph\xE1p BI ho\xE0n ch\u1EC9nh cho case study th\u1EF1c t\u1EBF l\u1EDBn, h\u1ECDc c\xE1ch t\u1ED1i \u01B0u hi\u1EC7u n\u0103ng v\xE0 gi\u1EA3m \u0111\u1ED9 tr\u1EC5 c\u1EE7a Dashboard." }
      ]
    },
    {
      key: "pl300",
      code: "PL-300",
      title: "PL-300: Microsoft Power BI Data Analyst",
      englishName: "PL-300: Microsoft Power BI Data Analyst",
      category: "Power BI & Business Intelligence",
      level: "N\xE2ng cao",
      description: "Kho\xE1 h\u1ECDc PL-300: L\xE0m ch\u1EE7 Power BI t\u1EEB k\u1EBFt n\u1ED1i d\u1EEF li\u1EC7u, vi\u1EBFt DAX, \u0111\u1EBFn x\xE2y dashboard & chia s\u1EBB b\xE1o c\xE1o chuy\xEAn nghi\u1EC7p tr\xEAn Power BI Service.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2025/07/khoa-hoc-pl-300.jpg",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-pl-300-mcna/",
      sessions: [
        { title: "Gi\u1EDBi thi\u1EC7u Ph\xE2n t\xEDch D\u1EEF li\u1EC7u & K\u1EBFt n\u1ED1i D\u1EEF li\u1EC7u trong Power BI" },
        { title: "L\xE0m s\u1EA1ch, Bi\u1EBFn \u0111\u1ED5i & M\xF4 h\xECnh h\xF3a D\u1EEF li\u1EC7u" },
        { title: "L\xE0m quen DAX & Filter Context" },
        { title: "DAX n\xE2ng cao & \xD4n t\u1EADp DAX + Project" },
        { title: "Thi\u1EBFt k\u1EBF Visual & X\xE2y d\u1EF1ng B\xE1o c\xE1o Power BI" },
        { title: "Ph\xE2n t\xEDch n\xE2ng cao & Chia s\u1EBB n\u1ED9i dung tr\xEAn Power BI Service" },
        { title: "Project Day" }
      ]
    },
    {
      key: "excel_lv2",
      code: "EXC_LV2",
      title: "Excel n\xE2ng cao: L\xE0m b\xE1o c\xE1o logic, th\xF4ng minh",
      englishName: "Excel for Data-Driven Business Intelligence",
      category: "Excel",
      level: "Trung c\u1EA5p",
      description: "Kho\xE1 h\u1ECDc Excel n\xE2ng cao: L\xE0m ch\u1EE7 h\xE0m, Pivot, Power Query, thi\u1EBFt k\u1EBF dashboard. T\xEDch h\u1EE3p AI h\u1ED7 tr\u1EE3 \u0111\u1EC3 \xE1p d\u1EE5ng v\xE0o c\xF4ng vi\u1EC7c.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2025/06/excel-nang-cao-scaled.jpg",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-excel-nang-cao/",
      sessions: [
        { title: "L\xE0m ch\u1EE7 b\u1EA3ng t\xEDnh & h\xE0m Excel th\xF4ng d\u1EE5ng" },
        { title: "T\u1EF1 \u0111\u1ED9ng ho\xE1 l\xE0m s\u1EA1ch d\u1EEF li\u1EC7u v\u1EDBi Power Query" },
        { title: "Tr\u1EF1c quan h\xF3a d\u1EEF li\u1EC7u v\u1EDBi Pivot Table & Pivot Chart" },
        { title: "Dashboard & B\xE1o c\xE1o qu\u1EA3n tr\u1ECB" },
        { title: "Automation v\u1EDBi Formulas + AI h\u1ED7 tr\u1EE3" },
        { title: "K\u1EBFt n\u1ED1i ngu\u1ED3n d\u1EEF li\u1EC7u & qu\u1EA3n l\xFD b\xE1o c\xE1o li\xEAn v\xF9ng" },
        { title: "Project Day" }
      ]
    },
    {
      key: "sql_lv1",
      code: "SQL_LV1",
      title: "SQL c\u01A1 b\u1EA3n: Ph\xE2n t\xEDch d\u1EEF li\u1EC7u cho ng\u01B0\u1EDDi m\u1EDBi",
      englishName: "SQL Fundamentals: From Beginner to Data Analyst",
      category: "SQL & C\u01A1 s\u1EDF d\u1EEF li\u1EC7u",
      level: "C\u01A1 b\u1EA3n",
      description: "Kho\xE1 h\u1ECDc SQL c\u01A1 b\u1EA3n gi\xFAp b\u1EA1n n\u1EAFm v\u1EEFng ki\u1EBFn th\u1EE9c, th\u1EF1c h\xE0nh truy v\u1EA5n d\u1EEF li\u1EC7u, ph\xF9 h\u1EE3p cho ng\u01B0\u1EDDi m\u1EDBi b\u1EAFt \u0111\u1EA7u.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2025/06/sql-co-ban-scaled.jpg",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-sql-co-ban/",
      sessions: [
        { title: "L\xE0m quen SQL Server & ng\xF4n ng\u1EEF DDL" },
        { title: "Truy v\u1EA5n d\u1EEF li\u1EC7u v\u1EDBi SELECT v\xE0 thao t\xE1c DML" },
        { title: "Gh\xE9p n\u1ED1i d\u1EEF li\u1EC7u v\xE0 k\u1EBFt h\u1EE3p b\u1EA3ng" },
        { title: "H\xE0m x\u1EED l\xFD d\u1EEF li\u1EC7u n\xE2ng cao" },
        { title: "Truy v\u1EA5n n\xE2ng cao v\u1EDBi b\u1EA3ng ph\u1EE5" },
        { title: "Project: Sales Analysis & Top Products" },
        { title: "Project Day: Truy v\u1EA5n n\xE2ng cao & \u1EE9ng d\u1EE5ng GenAI" }
      ]
    },
    {
      key: "sql_lv2",
      code: "SQL_LV2",
      title: "SQL n\xE2ng cao: K\u1EF9 thu\u1EADt x\u1EED l\xFD d\u1EEF li\u1EC7u chuy\xEAn s\xE2u",
      englishName: "Advanced SQL for Data Science Mastery",
      category: "SQL & C\u01A1 s\u1EDF d\u1EEF li\u1EC7u",
      level: "N\xE2ng cao",
      description: "Kho\xE1 h\u1ECDc SQL n\xE2ng cao t\u1EA1i MCNA: Th\xE0nh th\u1EA1o Stored Proc, Pivot, Trigger,... T\xEDch h\u1EE3p AI h\u1ED7 tr\u1EE3 vi\u1EBFt truy v\u1EA5n, ph\xF9 h\u1EE3p cho Data Analyst & BI.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2025/06/sql-nang-cao-scaled.jpg",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-sql-nang-cao/",
      sessions: [
        { title: "Stored Procedure & x\u1EED l\xFD logic n\xE2ng cao" },
        { title: "CRUD n\xE2ng cao: Xo\xE1, C\u1EADp nh\u1EADt & Th\xEAm d\u1EEF li\u1EC7u" },
        { title: "Transactions, Table Variables, Temp Table" },
        { title: "H\xE0m tr\u1EA3 b\u1EA3ng, Derived Tables v\xE0 CTEs" },
        { title: "Cursors, Debugging v\xE0 Dynamic SQL" },
        { title: "Pivot & Trigger n\xE2ng cao" },
        { title: "Project Day" }
      ]
    },
    {
      key: "pyt_lv1",
      code: "PYT_LV1",
      title: "Python c\u01A1 b\u1EA3n: Ph\xE2n t\xEDch d\u1EEF li\u1EC7u th\u1EF1c chi\u1EBFn",
      englishName: "Python for Data Analytics & Risk Analytics Fundamentals",
      category: "Python & Machine Learning",
      level: "C\u01A1 b\u1EA3n",
      description: "Kho\xE1 h\u1ECDc Python c\u01A1 b\u1EA3n: L\xE0m ch\u1EE7 Pandas, tr\u1EF1c quan h\xF3a, x\u1EED l\xFD d\u1EEF li\u1EC7u & d\u1EF1 b\xE1o. H\u1ECDc qua d\u1EF1 \xE1n th\u1EF1c t\u1EBF, ph\xF9 h\u1EE3p ng\u01B0\u1EDDi m\u1EDBi v\xE0o ng\xE0nh d\u1EEF li\u1EC7u.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2025/06/python-co-ban-scaled.jpg",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-python-co-ban/",
      sessions: [
        { title: "L\xE0m quen Python & X\u1EED l\xFD d\u1EEF li\u1EC7u c\u01A1 b\u1EA3n" },
        { title: "Numpy & Pandas c\u01A1 b\u1EA3n" },
        { title: "L\xE0m s\u1EA1ch & Chu\u1EA9n h\xF3a d\u1EEF li\u1EC7u" },
        { title: "Tr\u1EF1c quan h\xF3a & ph\xE2n t\xEDch chu\u1ED7i th\u1EDDi gian" },
        { title: "Gi\u1EDBi thi\u1EC7u Machine Learning v\u1EDBi Scikit-learn" },
        { title: "Project: D\u1EF1 b\xE1o doanh thu" },
        { title: "Project Day: Ph\xE2n t\xEDch d\u1EEF li\u1EC7u & tr\xECnh b\xE0y m\xF4 h\xECnh d\u1EF1 \u0111o\xE1n" }
      ]
    },
    {
      key: "pyt_lv2",
      code: "PYT_LV2",
      title: "Python n\xE2ng cao: Machine Learning & Deep Learning th\u1EF1c chi\u1EBFn",
      englishName: "Python for Machine Learning & Deep Learning Mastery",
      category: "Python & Machine Learning",
      level: "N\xE2ng cao",
      description: "Kho\xE1 h\u1ECDc Python n\xE2ng cao: \u1EE8ng d\u1EE5ng Machine Learning, Clustering, Regression. H\u1ECDc qua project th\u1EF1c t\u1EBF, d\xF9ng AI h\u1ED7 tr\u1EE3 vi\u1EBFt & t\u1ED1i \u01B0u m\xF4 h\xECnh.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2025/06/python-nang-cao-scaled.jpg",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-python-nang-cao/",
      sessions: [
        { title: "T\u1ED5ng quan & chu\u1EA9n b\u1ECB m\xF4i tr\u01B0\u1EDDng ML" },
        { title: "Linear Regression: D\u1EF1 \u0111o\xE1n bi\u1EBFn s\u1ED1 li\xEAn t\u1EE5c" },
        { title: "T\u1ED1i \u01B0u h\xF3a m\xF4 h\xECnh h\u1ED3i quy & \u0111\xE1nh gi\xE1 t\u1EF1 \u0111\u1ED9ng" },
        { title: "Case Study: D\u1EF1 \u0111o\xE1n gi\xE1 nh\xE0" },
        { title: "Logistic Regression: Ph\xE2n lo\u1EA1i kh\xE1ch h\xE0ng" },
        { title: "Unsupervised Learning: Ph\xE2n kh\xFAc kh\xE1ch h\xE0ng" },
        { title: "Project Day" }
      ]
    },
    {
      key: "stat_lv2",
      code: "STAT_LV2",
      title: "To\xE1n & Th\u1ED1ng k\xEA cho Data Science",
      englishName: "Essential Math & Statistics for Data Science",
      category: "Th\u1ED1ng k\xEA",
      level: "Trung c\u1EA5p",
      description: "Kho\xE1 h\u1ECDc Th\u1ED1ng k\xEA: N\u1EAFm v\u1EEFng m\xF4 t\u1EA3, ki\u1EC3m \u0111\u1ECBnh, h\u1ED3i quy, tr\u1EF1c quan ho\xE1 d\u1EEF li\u1EC7u; d\xF9ng AI h\u1ED7 tr\u1EE3 ph\xE2n t\xEDch d\u1EEF li\u1EC7u.",
      thumbnail: "https://mcna.vn/wp-content/uploads/2025/06/thong-ke-co-ban-scaled.jpg",
      sourceUrl: "https://mcna.vn/khoa-hoc/khoa-hoc-thong-ke-co-ban/",
      sessions: [
        { title: "To\xE1n h\u1ECDc n\u1EC1n t\u1EA3ng trong Data Science" },
        { title: "Th\u1ED1ng k\xEA m\xF4 t\u1EA3 & tr\u1EF1c quan h\xF3a d\u1EEF li\u1EC7u" },
        { title: "X\xE1c su\u1EA5t & Ph\xE2n ph\u1ED1i x\xE1c su\u1EA5t" },
        { title: "L\u1EA5y m\u1EABu & Suy lu\u1EADn th\u1ED1ng k\xEA" },
        { title: "Ki\u1EC3m \u0111\u1ECBnh gi\u1EA3 thuy\u1EBFt (Hypothesis Testing)" },
        { title: "T\u01B0\u01A1ng quan & H\u1ED3i quy \u0111\u01A1n gi\u1EA3n" },
        { title: "Project Day" }
      ]
    }
  ],
  classes: [
    { course: "ai_for_work", openingDate: "2026-09-06", days: ["Th\u1EE9 N\u0103m", "Ch\u1EE7 Nh\u1EADt"], startTime: "19:30", endTime: "21:30" },
    { course: "ai_agent", openingDate: "2026-09-08", days: ["Th\u1EE9 Ba", "Th\u1EE9 B\u1EA3y"], startTime: "19:30", endTime: "21:30" },
    { course: "ai_automation", openingDate: "2026-09-12", days: ["Th\u1EE9 T\u01B0", "Th\u1EE9 B\u1EA3y"], startTime: "19:30", endTime: "21:30" },
    { course: "ai_for_work", openingDate: "2026-09-28", days: ["Th\u1EE9 Hai", "Th\u1EE9 S\xE1u"], startTime: "19:30", endTime: "21:30" },
    { course: "pbi_lv1", openingDate: "2026-09-04", days: ["Th\u1EE9 Ba", "Th\u1EE9 S\xE1u"], startTime: "19:30", endTime: "21:30" },
    { course: "pyt_lv2", openingDate: "2026-09-07", days: ["Th\u1EE9 Hai", "Th\u1EE9 T\u01B0"], startTime: "19:30", endTime: "21:30" },
    { course: "sql_lv1", openingDate: "2026-09-15", days: ["Th\u1EE9 Ba", "Th\u1EE9 B\u1EA3y"], startTime: "19:30", endTime: "21:30" },
    { course: "sql_lv2", openingDate: "2026-09-20", days: ["Th\u1EE9 T\u01B0", "Ch\u1EE7 Nh\u1EADt"], startTime: "19:30", endTime: "21:30" },
    { course: "pbi_lv2", openingDate: "2026-09-22", days: ["Th\u1EE9 Ba", "Th\u1EE9 B\u1EA3y"], startTime: "19:30", endTime: "21:30" },
    { course: "pbi_lv1", openingDate: "2026-09-28", days: ["Th\u1EE9 Hai", "Th\u1EE9 N\u0103m"], startTime: "19:30", endTime: "21:30" },
    { course: "pyt_lv1", openingDate: "2026-09-29", days: ["Th\u1EE9 Hai", "Th\u1EE9 N\u0103m"], startTime: "19:30", endTime: "21:30" }
  ]
};

// src/server/services/sectionSchedule.ts
var normalizeDayText = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
var DAY_INDEX_BY_NAME = {
  "chu nhat": 0,
  "cn": 0,
  "sun": 0,
  "sunday": 0,
  "thu hai": 1,
  "thu 2": 1,
  "t2": 1,
  "mon": 1,
  "monday": 1,
  "thu ba": 2,
  "thu 3": 2,
  "t3": 2,
  "tue": 2,
  "tuesday": 2,
  "thu tu": 3,
  "thu 4": 3,
  "t4": 3,
  "wed": 3,
  "wednesday": 3,
  "thu nam": 4,
  "thu 5": 4,
  "t5": 4,
  "thu": 4,
  "thursday": 4,
  "thu sau": 5,
  "thu 6": 5,
  "t6": 5,
  "fri": 5,
  "friday": 5,
  "thu bay": 6,
  "thu 7": 6,
  "t7": 6,
  "sat": 6,
  "saturday": 6
};
var dayOfWeekIndex = (value) => {
  const text = normalizeDayText(value).replace(/\s+/g, " ").trim();
  return DAY_INDEX_BY_NAME[text] ?? null;
};
var addDaysIso = (dateOnly, days) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
var isDateOnlyText = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").slice(0, 10));
var normalizeDateOnly = (value, fallback = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)) => {
  const dateOnly = String(value || "").slice(0, 10);
  return isDateOnlyText(dateOnly) ? dateOnly : fallback;
};
var nextDateForSlot = (fromDate, slot, cycle) => {
  if (slot.specificDate) return addDaysIso(normalizeDateOnly(slot.specificDate, fromDate), cycle * 7);
  const targetDay = dayOfWeekIndex(slot.dayOfWeek);
  if (targetDay === null) return addDaysIso(fromDate, cycle * 7);
  const [year, month, day] = fromDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const currentDay = start.getUTCDay();
  const delta = (targetDay - currentDay + 7) % 7;
  return addDaysIso(fromDate, delta + cycle * 7);
};
var dateTimeForSlot = (dateOnly, slot) => {
  const startTime = String(slot?.startTime || "").trim();
  return /^\d{2}:\d{2}$/.test(startTime) ? `${dateOnly}T${startTime}:00` : dateOnly;
};
var buildScheduledSessionSeed = (order, schedule, openingDate) => {
  const slotCount = Math.max(schedule.length, 1);
  const slot = schedule.length > 0 ? schedule[(order - 1) % slotCount] : null;
  const cycle = Math.floor((order - 1) / slotCount);
  const baseDate = normalizeDateOnly(openingDate || slot?.specificDate);
  const date = slot ? nextDateForSlot(baseDate, slot, cycle) : addDaysIso(baseDate, order - 1);
  const time = slot ? `${slot.startTime} - ${slot.endTime}` : "";
  const room = slot?.room || "Online";
  const scheduleText = slot ? `${slot.dayOfWeek}, ${time}, ${room}` : date;
  return {
    date: dateTimeForSlot(date, slot),
    topic: `Bu\u1ED5i ${order}: ${scheduleText}`,
    content: slot ? `L\u1ECBch h\u1ECDc theo th\u1EDDi kh\xF3a bi\u1EC3u: ${scheduleText}. Gi\u1EA3ng vi\xEAn c\xF3 th\u1EC3 c\u1EADp nh\u1EADt n\u1ED9i dung chi ti\u1EBFt cho bu\u1ED5i h\u1ECDc n\xE0y.` : "Gi\u1EA3ng vi\xEAn c\xF3 th\u1EC3 c\u1EADp nh\u1EADt n\u1ED9i dung chi ti\u1EBFt cho bu\u1ED5i h\u1ECDc n\xE0y."
  };
};
var buildLessonSeed = (order, schedule, openingDate) => {
  const slot = schedule.length > 0 ? schedule[(order - 1) % schedule.length] : null;
  const cycle = Math.floor((order - 1) / Math.max(schedule.length, 1));
  const baseDate = normalizeDateOnly(openingDate || slot?.specificDate);
  const date = slot ? nextDateForSlot(baseDate, slot, cycle) : "";
  const time = slot ? `${slot.startTime} - ${slot.endTime}` : "";
  const room = slot?.room || "Online";
  const titleSuffix = date || time ? ` (${[date, time].filter(Boolean).join(" ")})` : "";
  return {
    title: `Buoi ${order}${titleSuffix}`,
    content: slot ? `Lich hoc du kien: ${slot.dayOfWeek}, ${time}, ${room}. Giang vien cap nhat ten buoi hoc va noi dung bai day tai day.` : "Giang vien cap nhat ten buoi hoc va noi dung bai day tai day.",
    duration: time ? `${time}${room ? ` | ${room}` : ""}` : "1 buoi"
  };
};
async function ensureCourseLessonsForSchedule(db, courseId2, count, schedule = [], openingDate) {
  const targetCount = Number(count || 0);
  if (!Number.isFinite(targetCount) || targetCount < 1) return;
  const existing = (await db.query(
    "SELECT lesson_order FROM lessons WHERE course_id = $1",
    [courseId2]
  )).rows;
  const existingOrders = new Set(existing.map((row) => Number(row.lesson_order)));
  for (let order = 1; order <= targetCount; order++) {
    if (existingOrders.has(order)) continue;
    const seed = buildLessonSeed(order, schedule, openingDate || void 0);
    await db.query(
      "INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [generateId2("lesson"), courseId2, seed.title, seed.content, null, order, seed.duration]
    );
  }
}
var isGeneratedSessionTopicForOrder = (topic, order) => {
  const normalized = normalizeDayText(topic).replace(/\s+/g, " ").trim();
  return normalized === `buoi ${order}` || normalized.startsWith(`buoi ${order}:`) || normalized.startsWith(`buoi ${order} `);
};
var generatedSessionOrder = (topic) => {
  const normalized = normalizeDayText(topic).replace(/\s+/g, " ").trim();
  const match = normalized.match(/^buoi\s+(\d+)(?::|\s|$)/);
  return match ? Number(match[1]) : null;
};
async function ensureSectionAttendanceSessionsForSchedule(db, section, schedule = []) {
  const targetCount = Number(section.number_of_sessions || 0);
  if (!Number.isFinite(targetCount) || targetCount < 1) return;
  const columns = (await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_sessions'"
  )).rows.map((row) => row.column_name);
  const hasDate = columns.includes("date");
  const hasSessionDate = columns.includes("session_date");
  const hasSectionId = columns.includes("section_id");
  const hasContent = columns.includes("content");
  if (!hasSectionId) return;
  const dateOrderExpression = hasDate && hasSessionDate ? "COALESCE(date::text, session_date::text)" : hasDate ? "date::text" : hasSessionDate ? "session_date::text" : "id";
  const existing = (await db.query(
    `SELECT * FROM attendance_sessions
     WHERE section_id = $1
     ORDER BY ${dateOrderExpression}, topic, id`,
    [section.id]
  )).rows;
  const usedIds = /* @__PURE__ */ new Set();
  for (let order = 1; order <= targetCount; order++) {
    const seed = buildScheduledSessionSeed(order, schedule, section.opening_date);
    const generatedMatch = existing.find((row) => !usedIds.has(row.id) && isGeneratedSessionTopicForOrder(row.topic, order));
    const fallbackMatch = existing[order - 1] && !usedIds.has(existing[order - 1].id) ? existing[order - 1] : null;
    const current = generatedMatch || fallbackMatch;
    if (current) {
      usedIds.add(current.id);
      const sets = ["teacher_id = $1"];
      const values2 = [section.teacher_id];
      let paramIndex = values2.length + 1;
      if (hasDate) {
        sets.push(`date = $${paramIndex++}`);
        values2.push(seed.date);
      }
      if (hasSessionDate) {
        sets.push(`session_date = $${paramIndex++}`);
        values2.push(seed.date.slice(0, 10));
      }
      if (isGeneratedSessionTopicForOrder(current.topic, order)) {
        sets.push(`topic = $${paramIndex++}`);
        values2.push(seed.topic);
      }
      if (hasContent && !current.content) {
        sets.push(`content = $${paramIndex++}`);
        values2.push(seed.content);
      }
      values2.push(current.id);
      await db.query(`UPDATE attendance_sessions SET ${sets.join(", ")} WHERE id = $${paramIndex}`, values2);
      continue;
    }
    const insertColumns = ["id", "course_id", "teacher_id", "topic"];
    const values = [generateId2("ats"), section.course_id, section.teacher_id, seed.topic];
    const placeholders = values.map((_, index) => `$${index + 1}`);
    if (hasDate) {
      insertColumns.push("date");
      values.push(seed.date);
      placeholders.push(`$${values.length}`);
    }
    if (hasSessionDate) {
      insertColumns.push("session_date");
      values.push(seed.date.slice(0, 10));
      placeholders.push(`$${values.length}`);
    }
    if (hasSectionId) {
      insertColumns.push("section_id");
      values.push(section.id);
      placeholders.push(`$${values.length}`);
    }
    if (hasContent) {
      insertColumns.push("content");
      values.push(seed.content);
      placeholders.push(`$${values.length}`);
    }
    await db.query(
      `INSERT INTO attendance_sessions (${insertColumns.join(", ")}) VALUES (${placeholders.join(", ")})`,
      values
    );
  }
  const excessGeneratedIds = existing.filter((row) => {
    const order = generatedSessionOrder(row.topic);
    return order !== null && (order > targetCount || !usedIds.has(row.id));
  }).map((row) => row.id);
  if (excessGeneratedIds.length > 0) {
    await db.query("DELETE FROM attendance_sessions WHERE id = ANY($1)", [excessGeneratedIds]);
  }
}
async function getCourseSectionColumnSet(db) {
  const rows = (await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'course_sections'"
  )).rows;
  return new Set(rows.map((row) => row.column_name));
}
async function upsertCourseSection(db, section) {
  const id = section.id || generateId2("section");
  const scheduleJson = JSON.stringify(section.schedule || []);
  const columns = await getCourseSectionColumnSet(db);
  const insertColumns = ["id", "course_id", "teacher_id", "section_code", "max_students", "status"];
  const values = [id, section.courseId, section.teacherId, section.sectionCode, Number(section.maxStudents), section.status];
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const updates = [
    "course_id = EXCLUDED.course_id",
    "teacher_id = EXCLUDED.teacher_id",
    "section_code = EXCLUDED.section_code",
    "max_students = EXCLUDED.max_students",
    "status = EXCLUDED.status"
  ];
  if (columns.has("schedule_json")) {
    insertColumns.push("schedule_json");
    values.push(scheduleJson);
    placeholders.push(`$${values.length}`);
    updates.push("schedule_json = EXCLUDED.schedule_json");
  }
  if (columns.has("schedule")) {
    insertColumns.push("schedule");
    values.push(scheduleJson);
    placeholders.push(`$${values.length}::jsonb`);
    updates.push("schedule = EXCLUDED.schedule");
  }
  if (columns.has("opening_date")) {
    insertColumns.push("opening_date");
    values.push(section.openingDate || null);
    placeholders.push(`$${values.length}`);
    updates.push("opening_date = EXCLUDED.opening_date");
  }
  if (columns.has("number_of_sessions")) {
    insertColumns.push("number_of_sessions");
    values.push(section.numberOfSessions || null);
    placeholders.push(`$${values.length}`);
    updates.push("number_of_sessions = EXCLUDED.number_of_sessions");
  }
  if (columns.has("meeting_url")) {
    insertColumns.push("meeting_url");
    values.push(section.meetingUrl || null);
    placeholders.push(`$${values.length}`);
    updates.push("meeting_url = EXCLUDED.meeting_url");
  }
  if (columns.has("group_chat_url")) {
    insertColumns.push("group_chat_url");
    values.push(section.groupChatUrl || null);
    placeholders.push(`$${values.length}`);
    updates.push("group_chat_url = EXCLUDED.group_chat_url");
  }
  const row = (await db.query(
    `INSERT INTO course_sections (${insertColumns.join(", ")})
     VALUES (${placeholders.join(", ")})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}
     RETURNING *`,
    values
  )).rows[0];
  await ensureCourseLessonsForSchedule(
    db,
    row.course_id,
    row.number_of_sessions,
    parseSchedule(row),
    row.opening_date || void 0
  );
  await ensureSectionAttendanceSessionsForSchedule(db, row, parseSchedule(row));
  return courseSectionFromRow(row);
}
async function ensureScheduledSessionsForAllSections(db) {
  const sectionColumns = await getCourseSectionColumnSet(db);
  const numberOfSessionsSelect = sectionColumns.has("number_of_sessions") ? "cs.number_of_sessions" : "NULL";
  const openingDateSelect = sectionColumns.has("opening_date") ? "cs.opening_date" : "NULL";
  const rows = (await db.query(
    `SELECT cs.*, ${numberOfSessionsSelect} AS resolved_number_of_sessions,
            ${openingDateSelect} AS resolved_opening_date,
            c.number_of_lessons AS course_number_of_lessons,
            c.opening_date AS course_opening_date
     FROM course_sections cs
     JOIN courses c ON c.id = cs.course_id`
  )).rows;
  for (const row of rows) {
    const targetCount = Number(row.resolved_number_of_sessions || row.course_number_of_lessons || 10);
    const openingDate = row.resolved_opening_date || row.course_opening_date || void 0;
    if (sectionColumns.has("number_of_sessions") && !row.resolved_number_of_sessions) {
      await db.query("UPDATE course_sections SET number_of_sessions = $1 WHERE id = $2", [targetCount, row.id]);
    }
    await ensureCourseLessonsForSchedule(db, row.course_id, targetCount, parseSchedule(row), openingDate);
    await ensureSectionAttendanceSessionsForSchedule(
      db,
      { ...row, number_of_sessions: targetCount, opening_date: openingDate },
      parseSchedule(row)
    );
  }
}

// src/server/services/catalogImport.ts
var mcnaCatalog = mcnaCatalog_default;
var courseId = (key) => `course_mcna_${key}`;
var lessonId = (key, order) => `lesson_mcna_${key}_${order}`;
function slotsInOpeningOrder(cls) {
  const [year, month, day] = cls.openingDate.split("-").map(Number);
  const openingDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return cls.days.map((name) => {
    const index = dayOfWeekIndex(name);
    if (index === null) throw new Error(`Unknown weekday "${name}" in class ${cls.course} ${cls.openingDate}.`);
    return { slot: { dayOfWeek: name, startTime: cls.startTime, endTime: cls.endTime, room: cls.room || "Online (Zoom)" }, offset: (index - openingDay + 7) % 7 };
  }).sort((a, b) => a.offset - b.offset).map((item) => item.slot);
}
async function resolveTeacher(db, teacherEmail) {
  const teacher = (await db.query("SELECT id, name, email FROM users WHERE lower(email) = lower($1) AND role = 'teacher'", [teacherEmail])).rows[0] || (await db.query("SELECT id, name, email FROM users WHERE role = 'teacher' ORDER BY created_at LIMIT 1")).rows[0];
  if (!teacher) throw new Error("No teacher account found. Create one or pass --teacher-email=<teacher email>.");
  return teacher;
}
async function importMcnaCatalog(db, options = {}) {
  const log = options.log || (() => void 0);
  const summary = { coursesCreated: 0, coursesUpdated: 0, lessons: 0, classesCreated: 0, classesSkipped: 0, otherCoursesHidden: 0 };
  const courseByKey = new Map(mcnaCatalog.courses.map((course) => [course.key, course]));
  for (const cls of mcnaCatalog.classes) {
    if (!courseByKey.has(cls.course)) throw new Error(`Class ${cls.openingDate} refers to unknown course "${cls.course}".`);
  }
  const teacher = await resolveTeacher(db, options.teacherEmail || "teacher@mcna.local");
  log(`Teacher: ${teacher.name} <${teacher.email}>`);
  for (const course of mcnaCatalog.courses) {
    const firstClass = mcnaCatalog.classes.filter((cls) => cls.course === course.key).map((cls) => cls.openingDate).sort()[0] || null;
    const description = [
      course.description,
      "",
      `T\xEAn ti\u1EBFng Anh: ${course.englishName}`,
      `M\xE3 kh\xF3a: ${course.code} \xB7 ${course.sessions.length} bu\u1ED5i \xB7 Online`,
      `Ngu\u1ED3n: ${course.sourceUrl}`
    ].join("\n");
    const result = await db.query(
      `INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at, opening_date, number_of_lessons)
       VALUES ($1, $2, $3, $4, 'published', $5, $6, $7, $8, $9, NULL, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         status = 'published',
         category = EXCLUDED.category,
         thumbnail = EXCLUDED.thumbnail,
         level = EXCLUDED.level,
         tags_json = EXCLUDED.tags_json,
         opening_date = EXCLUDED.opening_date,
         number_of_lessons = EXCLUDED.number_of_lessons,
         price = CASE WHEN courses.price IS NULL OR courses.price = 0 THEN EXCLUDED.price ELSE courses.price END
       RETURNING (xmax = 0) AS inserted`,
      [
        courseId(course.key),
        course.title,
        description,
        teacher.id,
        course.category,
        course.thumbnail,
        mcnaCatalog.defaultPrice,
        course.level,
        JSON.stringify(["mcna", course.code]),
        (/* @__PURE__ */ new Date()).toISOString(),
        firstClass,
        course.sessions.length
      ]
    );
    if (result.rows[0].inserted) summary.coursesCreated++;
    else summary.coursesUpdated++;
    for (const [index, session] of course.sessions.entries()) {
      const order = index + 1;
      await db.query(
        `INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration)
         VALUES ($1, $2, $3, $4, NULL, $5, $6)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, lesson_order = EXCLUDED.lesson_order, duration = EXCLUDED.duration`,
        [lessonId(course.key, order), courseId(course.key), `Bu\u1ED5i ${order}: ${session.title}`, session.content || session.title, order, "2 gi\u1EDD"]
      );
      summary.lessons++;
    }
  }
  for (const cls of mcnaCatalog.classes) {
    const course = courseByKey.get(cls.course);
    const [, month, day] = cls.openingDate.split("-");
    const sectionId = `section_mcna_${cls.course}_${cls.openingDate.replace(/-/g, "")}`;
    if ((await db.query("SELECT 1 FROM course_sections WHERE id = $1", [sectionId])).rowCount) {
      summary.classesSkipped++;
      continue;
    }
    await upsertCourseSection(db, {
      id: sectionId,
      courseId: courseId(course.key),
      teacherId: teacher.id,
      sectionCode: `${course.code}-${day}${month}`,
      maxStudents: mcnaCatalog.defaultMaxStudents,
      schedule: slotsInOpeningOrder(cls),
      status: "open",
      openingDate: cls.openingDate,
      numberOfSessions: course.sessions.length
    });
    const sessions = (await db.query(
      "SELECT id, date FROM attendance_sessions WHERE section_id = $1 ORDER BY date",
      [sectionId]
    )).rows;
    for (const [index, row] of sessions.entries()) {
      const syllabus = course.sessions[index];
      if (!syllabus) continue;
      await db.query(
        "UPDATE attendance_sessions SET topic = $1, content = $2 WHERE id = $3",
        [syllabus.title, syllabus.content || syllabus.title, row.id]
      );
    }
    const lastDate = sessions.length ? String(sessions[sessions.length - 1].date).slice(0, 10) : cls.openingDate;
    log(`  + ${course.code}-${day}${month}: ${cls.days.join(" & ")} ${cls.startTime}-${cls.endTime}, ${sessions.length} bu\u1ED5i, ${cls.openingDate} \u2192 ${lastDate}`);
    summary.classesCreated++;
  }
  if (options.hideOtherCourses) {
    const hidden = await db.query(
      "UPDATE courses SET status = 'draft' WHERE status = 'published' AND id NOT LIKE 'course_mcna_%' RETURNING id"
    );
    summary.otherCoursesHidden = hidden.rowCount || 0;
  }
  return summary;
}

// src/server/seedCore.ts
var seedDemoData = () => process.env.SEED_DEMO_DATA === "true";
function getSeedStore() {
  const store = getInitialStore();
  if (seedDemoData()) backfillMegaDemoData(store);
  return store;
}
async function seedCoreLearningData(db) {
  if (!seedDemoData()) {
    const catalogCount = Number((await db.query("SELECT COUNT(*) AS count FROM courses WHERE id LIKE 'course_mcna_%'")).rows[0].count);
    if (catalogCount === 0) {
      console.log("[Seeding] Importing the MCNA catalogue...");
      const summary = await importMcnaCatalog(db, { log: (message) => console.log(message) });
      console.log(`[Seeding] Catalogue ready: ${summary.coursesCreated} kh\xF3a h\u1ECDc, ${summary.lessons} b\xE0i h\u1ECDc, ${summary.classesCreated} l\u1EDBp.`);
    }
    return;
  }
  const store = getSeedStore();
  const initialCourseCount = Number((await db.query("SELECT COUNT(*) AS count FROM courses")).rows[0].count);
  const needsMegaBackfill = initialCourseCount < 40;
  if (initialCourseCount === 0 || needsMegaBackfill) {
    for (const c of store.courses) {
      await db.query(
        `INSERT INTO courses (id, title, description, teacher_id, status, category, thumbnail, price, level, tags_json, rejection_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.title, c.description, c.teacherId, c.status, c.category, c.thumbnail || null, c.price || 0, c.level || null, JSON.stringify(c.tags || []), c.rejectionReason || null, c.createdAt]
      );
    }
    for (const l of store.lessons) {
      await db.query(
        "INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
        [l.id, l.courseId, l.title, l.content, l.videoUrl || null, l.order, l.duration]
      );
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM enrollments")).rows[0].count) === 0) {
    for (const e of store.enrollments) {
      await db.query(
        "INSERT INTO enrollments (id, course_id, student_id, status, enrolled_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        [e.id, e.courseId, e.studentId, e.status, e.enrolledAt, e.completedAt || null]
      );
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM course_sections")).rows[0].count) === 0) {
    for (const section of store.courseSections || []) {
      await db.query(
        `INSERT INTO course_sections (id, course_id, teacher_id, section_code, max_students, schedule, schedule_json, status)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [
          section.id,
          section.courseId,
          section.teacherId,
          section.sectionCode,
          section.maxStudents,
          JSON.stringify(section.schedule || []),
          JSON.stringify(section.schedule || []),
          section.status
        ]
      );
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM section_schedules")).rows[0].count) === 0) {
    const fallbackDays = [2, 4, 3, 6];
    for (const section of store.courseSections || []) {
      for (const [index, slot] of (section.schedule || []).entries()) {
        await db.query(
          `INSERT INTO section_schedules (id, section_id, day_of_week, start_time, end_time, room)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO NOTHING`,
          [
            `sched_${section.id}_${index}`,
            section.id,
            fallbackDays[index % fallbackDays.length],
            slot.startTime,
            slot.endTime,
            slot.room || null
          ]
        );
      }
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM course_registrations")).rows[0].count) === 0) {
    for (const registration of store.courseRegistrations || []) {
      await db.query(
        `INSERT INTO course_registrations (
          id, student_id, section_id, status, registered_at, dropped_at,
          grade, letter_grade, grade_point, credits, is_retake, exam_ban, grade_posted_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING`,
        [
          registration.id,
          registration.studentId,
          registration.sectionId,
          registration.status,
          registration.registeredAt,
          registration.droppedAt || null,
          registration.grade || null,
          registration.letterGrade || null,
          registration.gradePoint ?? null,
          registration.credits || 0,
          Boolean(registration.isRetake),
          Boolean(registration.examBan),
          registration.gradePostedAt || null
        ]
      );
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM lesson_progress")).rows[0].count) === 0) {
    for (const p of store.lessonProgress) {
      await db.query(
        "INSERT INTO lesson_progress (id, enrollment_id, lesson_id, completed, completed_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING",
        [p.id, p.enrollmentId, p.lessonId, p.completed, p.completedAt || null]
      ).catch(() => void 0);
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM quizzes")).rows[0].count) === 0 || needsMegaBackfill) {
    for (const q of store.quizzes) {
      await db.query(
        "INSERT INTO quizzes (id, course_id, lesson_id, title, passing_score, time_limit, max_attempts) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
        [q.id, q.courseId, q.lessonId || null, q.title, q.passingScore, q.timeLimit, q.maxAttempts]
      );
    }
    for (const q of store.questions) {
      await db.query(
        "INSERT INTO questions (id, quiz_id, text, type, options_json, correct_answer) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
        [q.id, q.quizId, q.text, q.type, JSON.stringify(q.options || []), q.correctAnswer]
      );
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM assignments")).rows[0].count) === 0 || needsMegaBackfill) {
    for (const a of store.assignments) {
      await db.query(
        "INSERT INTO assignments (id, course_id, title, description, deadline, max_score, lesson_id, type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING",
        [a.id, a.courseId, a.title, a.description, a.deadline, a.maxScore, a.lessonId || null, a.type || null]
      );
    }
    for (const s of store.submissions) {
      await db.query(
        "INSERT INTO submissions (id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING",
        [s.id, s.assignmentId, s.studentId, s.content, s.score ?? null, s.feedback || null, s.submittedAt, s.gradedAt || null]
      ).catch(() => void 0);
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM attendance_sessions")).rows[0].count) === 0) {
    for (const session of store.attendanceSessions || []) {
      await db.query(
        `INSERT INTO attendance_sessions (id, course_id, section_id, teacher_id, date, topic)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [session.id, session.courseId, session.sectionId || null, session.teacherId, session.date, session.topic]
      );
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM session_materials")).rows[0].count) === 0) {
    const firstSession = (await db.query("SELECT id, section_id, course_id FROM attendance_sessions ORDER BY id LIMIT 1")).rows[0];
    if (firstSession) {
      await db.query(
        `INSERT INTO session_materials (id, session_id, section_id, course_id, type, title, url, storage_path, file_name, mime_type, size_bytes, sort_order, created_at)
         VALUES
         ($1, $2, $3, $4, 'youtube', 'B\xE0i gi\u1EA3ng gi\u1EDBi thi\u1EC7u m\xF4n h\u1ECDc (Video m\u1EABu)', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', NULL, NULL, NULL, NULL, 0, NOW()),
         ($5, $2, $3, $4, 'link', 'T\xE0i li\u1EC7u h\u01B0\u1EDBng d\u1EABn tr\u1EF1c tuy\u1EBFn (Link t\xE0i li\u1EC7u)', 'https://docs.mcna.edu.vn', NULL, NULL, NULL, NULL, 1, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [generateId2("mat"), firstSession.id, firstSession.section_id, firstSession.course_id, generateId2("mat")]
      ).catch(() => void 0);
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM attendance_records")).rows[0].count) === 0) {
    for (const record of store.attendanceRecords || []) {
      await db.query(
        `INSERT INTO attendance_records (id, session_id, student_id, status, note)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [record.id, record.sessionId, record.studentId, record.status, record.note || null]
      ).catch(() => void 0);
    }
  }
  if (Number((await db.query("SELECT COUNT(*) AS count FROM transactions")).rows[0].count) === 0) {
    for (const t of store.transactions || []) {
      await db.query(
        `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at, processed_at, processed_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [t.id, t.studentId, t.courseId, t.amount, t.status, t.paymentMethod, t.createdAt, t.processedAt || null, t.processedBy || null, t.notes || null]
      );
    }
  }
}
async function seedAuthUsers(db) {
  if (!seedDemoData()) {
    if (Number((await db.query("SELECT COUNT(*) AS count FROM users")).rows[0].count) === 0) {
      await usersRepository.seed(db, getInitialStore().users);
    }
  } else {
    const studentCount = Number((await db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'")).rows[0].count);
    const teacherCount = Number((await db.query("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher'")).rows[0].count);
    if (studentCount < 300 || teacherCount < 20) {
      await usersRepository.seed(db, getSeedStore().users);
    }
  }
  const unprovisionedStudents = (await db.query(
    "SELECT id, name FROM users WHERE role = 'student' AND (school_email IS NULL OR email_provisioned = false)"
  )).rows;
  if (unprovisionedStudents.length === 0) return;
  console.log("[Seeding] Backfilling school emails for seeded students...");
  for (const student of unprovisionedStudents) {
    const baseUsername = generateUsername(student.name);
    let suffix = "";
    let counter = 1;
    let schoolEmail = `${baseUsername}@mcna.edu.vn`;
    while (true) {
      schoolEmail = `${baseUsername}${suffix}@mcna.edu.vn`;
      const check = await db.query(
        "SELECT 1 FROM users WHERE school_email = $1 AND id != $2",
        [schoolEmail, student.id]
      );
      if (check.rowCount === 0) {
        break;
      }
      counter++;
      suffix = String(counter);
    }
    await db.query(
      "UPDATE users SET school_email = $1, email_provisioned = true, email_provisioned_at = NOW() WHERE id = $2",
      [schoolEmail, student.id]
    );
  }
  console.log(`[Seeding] Successfully backfilled ${unprovisionedStudents.length} students.`);
}

// src/server/repositories/courses.ts
var coursesRepository = {
  async list(db) {
    return (await db.query("SELECT * FROM courses ORDER BY created_at DESC")).rows.map(courseFromRow);
  },
  async listByTeacher(db, teacherId) {
    return (await db.query("SELECT * FROM courses WHERE teacher_id = $1 ORDER BY created_at DESC", [teacherId])).rows.map(courseFromRow);
  },
  async findById(db, id) {
    const row = (await db.query("SELECT * FROM courses WHERE id = $1", [id])).rows[0];
    return row ? courseFromRow(row) : null;
  },
  async create(db, input) {
    const course = { ...input, id: generateId2("course"), createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    await db.query(
      "INSERT INTO courses (id,title,description,teacher_id,status,category,thumbnail,price,level,tags_json,rejection_reason,created_at,opening_date,number_of_lessons,original_price) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
      [
        course.id,
        course.title,
        course.description,
        course.teacherId,
        course.status,
        course.category,
        course.thumbnail || null,
        course.price || 0,
        course.level || null,
        JSON.stringify(course.tags || []),
        course.rejectionReason || null,
        course.createdAt,
        course.openingDate || null,
        course.numberOfLessons || null,
        course.originalPrice ?? null
      ]
    );
    return course;
  },
  async updateDetails(db, id, input) {
    const row = (await db.query(
      `UPDATE courses
       SET title = $1,
           description = $2,
           category = $3,
           thumbnail = $4,
           price = $5,
           level = $6,
           tags_json = $7,
           opening_date = $8,
           number_of_lessons = $9,
           original_price = $10
       WHERE id = $11
       RETURNING *`,
      [
        input.title,
        input.description,
        input.category,
        input.thumbnail || null,
        input.price || 0,
        input.level || null,
        JSON.stringify(input.tags || []),
        input.openingDate || null,
        input.numberOfLessons || null,
        input.originalPrice ?? null,
        id
      ]
    )).rows[0];
    return row ? courseFromRow(row) : null;
  },
  async setStatus(db, id, status, rejectionReason) {
    const row = (await db.query("UPDATE courses SET status = $1, rejection_reason = $2 WHERE id = $3 RETURNING *", [status, rejectionReason || null, id])).rows[0];
    return row ? courseFromRow(row) : null;
  },
  async addLesson(db, input) {
    const lesson = { ...input, id: generateId2("lesson") };
    await db.query(
      "INSERT INTO lessons (id, course_id, title, content, video_url, lesson_order, duration) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [lesson.id, lesson.courseId, lesson.title, lesson.content, lesson.videoUrl || null, lesson.order, lesson.duration]
    );
    return lesson;
  },
  async updateLesson(db, id, input) {
    const row = (await db.query(
      "UPDATE lessons SET title = COALESCE($1, title), content = COALESCE($2, content), video_url = $3, lesson_order = COALESCE($4, lesson_order), duration = COALESCE($5, duration) WHERE id = $6 RETURNING *",
      [
        input.title || null,
        input.content || null,
        input.videoUrl || null,
        input.order !== void 0 ? input.order : null,
        input.duration || null,
        id
      ]
    )).rows[0];
    return row ? {
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      content: row.content,
      videoUrl: row.video_url || void 0,
      order: row.lesson_order,
      duration: row.duration
    } : null;
  },
  async deleteLesson(db, id) {
    await db.query("DELETE FROM lessons WHERE id = $1", [id]);
  },
  async teacherOwnsCourse(db, teacherId, courseId2) {
    return Boolean((await db.query("SELECT id FROM courses WHERE id = $1 AND teacher_id = $2", [courseId2, teacherId])).rows[0]);
  }
};

// src/server/repositories/enrollments.ts
var enrollmentsRepository = {
  async listForUser(db, user) {
    const result = user.role === "admin" ? await db.query("SELECT * FROM enrollments") : await db.query("SELECT * FROM enrollments WHERE student_id = $1", [user.id]);
    return result.rows.map(enrollmentFromRow);
  },
  async register(db, studentId, courseId2, isPaidCourse, extra = {}) {
    const enrollment = {
      id: generateId2("enroll"),
      courseId: courseId2,
      studentId,
      status: isPaidCourse ? "pending_payment" : "pending",
      enrolledAt: (/* @__PURE__ */ new Date()).toISOString(),
      requestedSectionId: extra.requestedSectionId,
      crmDealId: extra.crmDealId
    };
    await db.query(
      "INSERT INTO enrollments (id,course_id,student_id,status,enrolled_at,completed_at,requested_section_id,crm_deal_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [enrollment.id, enrollment.courseId, enrollment.studentId, enrollment.status, enrollment.enrolledAt, null, extra.requestedSectionId || null, extra.crmDealId || null]
    );
    return enrollment;
  },
  async findStudentEnrollment(db, studentId, enrollmentId) {
    return (await db.query("SELECT * FROM enrollments WHERE id = $1 AND student_id = $2", [enrollmentId, studentId])).rows[0] || null;
  },
  async existsForCourse(db, studentId, courseId2) {
    return Boolean((await db.query(
      "SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status IN ('pending', 'active', 'pending_payment')",
      [courseId2, studentId]
    )).rows[0]);
  },
  async toggleProgress(db, enrollmentId, lessonId2) {
    const validLesson = (await db.query(
      `SELECT l.id
       FROM lessons l
       JOIN enrollments e ON e.course_id = l.course_id
       WHERE e.id = $1 AND l.id = $2`,
      [enrollmentId, lessonId2]
    )).rows[0];
    if (!validLesson) return { error: "Lesson does not belong to this enrollment.", status: 400 };
    const existing = (await db.query("SELECT * FROM lesson_progress WHERE enrollment_id = $1 AND lesson_id = $2", [enrollmentId, lessonId2])).rows[0];
    if (existing) {
      const completed = !Boolean(existing.completed);
      const completedAt = completed ? (/* @__PURE__ */ new Date()).toISOString() : null;
      const row = (await db.query("UPDATE lesson_progress SET completed = $1, completed_at = $2 WHERE id = $3 RETURNING *", [completed, completedAt, existing.id])).rows[0];
      return { row: lessonProgressFromRow(row) };
    }
    const progress = { id: generateId2("prog"), enrollmentId, lessonId: lessonId2, completed: true, completedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await db.query("INSERT INTO lesson_progress (id,enrollment_id,lesson_id,completed,completed_at) VALUES ($1,$2,$3,$4,$5)", [progress.id, enrollmentId, lessonId2, true, progress.completedAt]);
    return { row: progress };
  },
  async activateEnrollment(db, id) {
    const row = (await db.query("UPDATE enrollments SET status = 'active' WHERE id = $1 RETURNING *", [id])).rows[0];
    return row ? enrollmentFromRow(row) : null;
  }
};

// src/server/services/email.ts
import nodemailer from "nodemailer";
import fs2 from "fs";
import path2 from "path";
var SMTP_HOST = process.env.SMTP_HOST || "";
var SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
var SMTP_USER = process.env.SMTP_USER || "";
var SMTP_PASS = process.env.SMTP_PASS || "";
var SMTP_FROM = process.env.SMTP_FROM || `"E16 LMS" <noreply@e16lms.edu.vn>`;
var TEST_RECEIVER_EMAIL = process.env.TEST_RECEIVER_EMAIL || "";
var isPlaceholderSmtp = () => {
  return !SMTP_USER || SMTP_USER.includes("your_email") || SMTP_USER.includes("example.com") || SMTP_PASS.includes("your_app_password");
};
var transporter = null;
var etherealCredentials = null;
async function getTransporter() {
  if (transporter) return transporter;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
    return transporter;
  }
  console.log("[Email Service] Creating Ethereal Email test account...");
  try {
    const testAccount = await nodemailer.createTestAccount();
    etherealCredentials = { user: testAccount.user, pass: testAccount.pass };
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log(`[Email Service] Ethereal Email test account created successfully!`);
    console.log(`[Email Service] Test SMTP User: ${testAccount.user}`);
    console.log(`[Email Service] Test SMTP Password: ${testAccount.pass}`);
    console.log(`[Email Service] View test emails at: https://ethereal.email/messages`);
    return transporter;
  } catch (err) {
    console.error("[Email Service] Failed to create Ethereal Email account, falling back to local file logging.", err);
    throw err;
  }
}
function logEmailMock(to, name, subject, htmlContent) {
  const scratchDir = path2.join(process.cwd(), "scratch");
  if (!fs2.existsSync(scratchDir)) {
    fs2.mkdirSync(scratchDir, { recursive: true });
  }
  const logFile = path2.join(scratchDir, "emails.log");
  const logEntry = `
========================================
[EMAIL MOCK DISPATCHED]
Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}
To: "${name}" <${to}>
Subject: ${subject}
----------------------------------------
${htmlContent}
========================================

`;
  fs2.appendFileSync(logFile, logEntry, "utf8");
  console.log(`[Email Mock] Sent to ${to}. Logged in scratch/emails.log`);
}
function logPreviewUrl(to, subject, previewUrl) {
  const scratchDir = path2.join(process.cwd(), "scratch");
  if (!fs2.existsSync(scratchDir)) {
    fs2.mkdirSync(scratchDir, { recursive: true });
  }
  const logFile = path2.join(scratchDir, "emails.log");
  const logEntry = `
========================================
[REAL EMAIL SENT (ETHEREAL)]
Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}
To: ${to}
Subject: ${subject}
Preview link (Ctrl+Click to view): ${previewUrl}
========================================

`;
  fs2.appendFileSync(logFile, logEntry, "utf8");
  console.log(`[Email Service] Real email sent. Preview URL: ${previewUrl}`);
}
function logRealEmailSent(to, subject, info) {
  const scratchDir = path2.join(process.cwd(), "scratch");
  if (!fs2.existsSync(scratchDir)) {
    fs2.mkdirSync(scratchDir, { recursive: true });
  }
  const logFile = path2.join(scratchDir, "emails.log");
  const logEntry = `
========================================
[REAL EMAIL SENT (SMTP PRODUCTION)]
Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}
To: ${to}
Subject: ${subject}
MessageID: ${info.messageId}
Response: ${info.response}
========================================

`;
  fs2.appendFileSync(logFile, logEntry, "utf8");
  console.log(`[Email Service] Real email sent to ${to}. MessageID: ${info.messageId}`);
}
function generateEmailHtml(name, message) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 30px 15px;
      box-sizing: border-box;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #4f46e5;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .content {
      padding: 32px 24px;
    }
    .content p {
      margin: 0 0 16px 0;
      font-size: 14px;
      line-height: 1.6;
    }
    .content p.greeting {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .message-box {
      background-color: #f1f5f9;
      border-left: 4px solid #4f46e5;
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
      color: #1e293b;
      margin: 20px 0;
      line-height: 1.6;
    }
    .button-container {
      text-align: center;
      margin: 24px 0 0 0;
    }
    .button {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      padding: 12px 28px;
      border-radius: 8px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>E16 LMS Portal</h1>
      </div>
      <div class="content">
        <p class="greeting">K\xEDnh g\u1EEDi ${name},</p>
        <p>H\u1EC7 th\u1ED1ng \u0110\xE0o t\u1EA1o & Qu\u1EA3n l\xFD H\u1ECDc v\u1EE5 E16 xin th\xF4ng b\xE1o b\u1EA1n c\xF3 m\u1ED9t c\u1EADp nh\u1EADt m\u1EDBi:</p>
        <div class="message-box">
          ${message}
        </div>
        <p>Vui l\xF2ng \u0111\u0103ng nh\u1EADp v\xE0o \u1EE9ng d\u1EE5ng \u0111\u1EC3 xem th\xF4ng tin chi ti\u1EBFt v\xE0 x\u1EED l\xFD k\u1ECBp th\u1EDDi.</p>
        <div class="button-container">
          <a href="http://localhost:5173" class="button" target="_blank">\u0110i t\u1EDBi ph\xF2ng h\u1ECDc v\u1EE5</a>
        </div>
      </div>
      <div class="footer">
        <p>\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} E16 Tech Corp. M\u1ECDi quy\u1EC1n \u0111\u01B0\u1EE3c b\u1EA3o l\u01B0u.</p>
        <p>\u0110\xE2y l\xE0 email th\xF4ng b\xE1o t\u1EF1 \u0111\u1ED9ng t\u1EEB h\u1EC7 th\u1ED1ng qu\u1EA3n l\xFD h\u1ECDc t\u1EADp E16. Vui l\xF2ng kh\xF4ng tr\u1EA3 l\u1EDDi th\u01B0 n\xE0y.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
async function sendEmailDirect(recipientEmail, recipientName, message) {
  try {
    let toEmail = recipientEmail;
    if (TEST_RECEIVER_EMAIL && !TEST_RECEIVER_EMAIL.includes("your_real_email")) {
      toEmail = TEST_RECEIVER_EMAIL;
      console.log(`[Email Service] Overriding recipient email from ${recipientEmail} to ${TEST_RECEIVER_EMAIL} for testing.`);
    }
    const subject = `[E16 LMS] Th\xF4ng b\xE1o m\u1EDBi t\u1EEB h\u1EC7 th\u1ED1ng`;
    const htmlContent = generateEmailHtml(recipientName || "H\u1ECDc vi\xEAn", message);
    if (isPlaceholderSmtp()) {
      logEmailMock(toEmail, recipientName || "H\u1ECDc vi\xEAn", subject, htmlContent);
      return;
    }
    try {
      const activeTransporter2 = await getTransporter();
      const info = await activeTransporter2.sendMail({
        from: SMTP_FROM,
        to: toEmail,
        subject,
        html: htmlContent,
        text: `K\xEDnh g\u1EEDi ${recipientName},

B\u1EA1n c\xF3 m\u1ED9t th\xF4ng b\xE1o m\u1EDBi t\u1EEB E16 LMS:

${message}

Vui l\xF2ng \u0111\u0103ng nh\u1EADp h\u1EC7 th\u1ED1ng \u0111\u1EC3 xem chi ti\u1EBFt.`
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logPreviewUrl(toEmail, subject, previewUrl);
      } else {
        logRealEmailSent(toEmail, subject, info);
      }
    } catch (smtpErr) {
      console.warn("[Email Service] SMTP dispatch failed, falling back to local file log.", smtpErr);
      logEmailMock(toEmail, recipientName || "H\u1ECDc vi\xEAn", subject, htmlContent);
    }
  } catch (err) {
    console.error(`[Email Service Error] Failed to process direct email notification to ${recipientEmail}:`, err);
  }
}

// src/server/emailProvisioning/emailWorker.ts
import nodemailer2 from "nodemailer";
import fs3 from "fs";
import path3 from "path";
import os from "os";

// src/server/repositories/audit.ts
var auditRepository = {
  async log(db, userId, action, target, detail) {
    try {
      await db.query(
        "INSERT INTO audit_logs (id, user_id, action, target, detail, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [generateId2("audit"), userId, action, target, detail, (/* @__PURE__ */ new Date()).toISOString()]
      );
    } catch {
    }
  },
  async listRecent(db, limit = 100) {
    try {
      return (await db.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1", [limit])).rows;
    } catch {
      return [];
    }
  }
};

// src/server/emailProvisioning/emailWorker.ts
var GOOGLE_SERVICE_ACCOUNT_JSON2 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
var SCHOOL_EMAIL_DOMAIN2 = process.env.SCHOOL_EMAIL_DOMAIN || "mcna.edu.vn";
var SMTP_HOST2 = process.env.SMTP_HOST || "smtp.gmail.com";
var SMTP_PORT2 = Number(process.env.SMTP_PORT) || 465;
var SMTP_USER2 = process.env.SMTP_USER || "";
var SMTP_PASS2 = process.env.SMTP_PASS || "";
var SMTP_FROM2 = process.env.SMTP_FROM || `"LMS MCNA" <${SMTP_USER2 || "noreply@mcna.vn"}>`;
function getSmtpUser() {
  return (process.env.SMTP_USER || "").trim();
}
function getSmtpPass() {
  return (process.env.SMTP_PASS || "").trim().replace(/\s+/g, "");
}
function getSmtpFrom() {
  const user = getSmtpUser();
  return process.env.SMTP_FROM || `"LMS MCNA" <${user || "noreply@mcna.vn"}>`;
}
var activeTransporter = null;
function hasSmtpConfig() {
  const user = getSmtpUser();
  const pass = getSmtpPass();
  if (user && pass && !user.includes("your_email") && !pass.includes("your_app_password")) {
    return true;
  }
  return hasSmtpOauth2Config();
}
function hasSmtpOauth2Config() {
  const user = getSmtpUser();
  const isPlaceholder = user.includes("your_email") || user.includes("example.com");
  return !isPlaceholder && hasGoogleCredentials() && !!process.env.SMTP_USER;
}
function getTransporter2() {
  if (activeTransporter) return activeTransporter;
  const user = getSmtpUser();
  const pass = getSmtpPass();
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  if (user && pass) {
    console.log(`[EmailWorker] Initializing standard SMTP transport for: ${user}`);
    const isGmail = host === "smtp.gmail.com" || user.endsWith("@gmail.com");
    activeTransporter = nodemailer2.createTransport(
      isGmail ? {
        service: "gmail",
        auth: {
          user,
          pass
        }
      } : {
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass
        }
      }
    );
    return activeTransporter;
  }
  if (hasSmtpOauth2Config()) {
    const creds = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON2);
    console.log(`[EmailWorker] Initializing OAuth2 SMTP transport for user: ${user}`);
    activeTransporter = nodemailer2.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        type: "OAuth2",
        user,
        serviceClient: creds.client_id,
        privateKey: creds.private_key.replace(/\\n/g, "\n")
      }
    });
    return activeTransporter;
  }
  throw new Error("SMTP credentials are not configured. Falling back to mock logging.");
}
function logEmailMock2(to, name, subject, htmlContent) {
  try {
    const baseDir = process.env.VERCEL ? os.tmpdir() : process.cwd();
    const scratchDir = path3.join(baseDir, "scratch");
    if (!fs3.existsSync(scratchDir)) {
      fs3.mkdirSync(scratchDir, { recursive: true });
    }
    const logFile = path3.join(scratchDir, "emails.log");
    const logEntry = `
========================================
[EMAIL MOCK DISPATCHED]
Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}
To: "${name}" <${to}>
Subject: ${subject}
----------------------------------------
${htmlContent}
========================================

`;
    fs3.appendFileSync(logFile, logEntry, "utf8");
  } catch {
  }
  console.log(`[Email Mock] Dispatched to ${to}: ${subject}`);
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
async function retryWithBackoff(fn, retries = 3, delays = [5e3, 3e4, 12e4]) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) {
        throw err;
      }
      const delay = delays[attempt - 1] || 5e3;
      console.warn(`[EmailWorker] Attempt ${attempt} failed. Retrying in ${delay}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
function wrapHtmlBody(title, contentHtml) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 30px 15px;
      box-sizing: border-box;
    }
    .card {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #4f46e5;
      padding: 24px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .content {
      padding: 32px 24px;
    }
    .content p {
      margin: 0 0 16px 0;
      font-size: 14px;
      line-height: 1.6;
    }
    .content p.greeting {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
    }
    .message-box {
      background-color: #f1f5f9;
      border-left: 4px solid #4f46e5;
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
      color: #1e293b;
      margin: 20px 0;
      line-height: 1.6;
    }
    .button-container {
      text-align: center;
      margin: 24px 0 0 0;
    }
    .button {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      padding: 12px 28px;
      border-radius: 8px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1>LMS E16-MCNA</h1>
      </div>
      <div class="content">
        ${contentHtml}
      </div>
      <div class="footer">
        <p>\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} E16 LMS. M\u1ECDi quy\u1EC1n \u0111\u01B0\u1EE3c b\u1EA3o l\u01B0u.</p>
        <p>\u0110\xE2y l\xE0 email th\xF4ng b\xE1o t\u1EF1 \u0111\u1ED9ng t\u1EEB h\u1EC7 th\u1ED1ng qu\u1EA3n l\xFD h\u1ECDc t\u1EADp E16. Vui l\xF2ng kh\xF4ng tr\u1EA3 l\u1EDDi th\u01B0 n\xE0y.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
async function sendWelcomeEmail(pool2, userId, params) {
  const subject = `[LMS E16] Ch\xE0o m\u1EEBng t\xE2n sinh vi\xEAn - C\u1EA5p t\xE0i kho\u1EA3n Email tr\u01B0\u1EDDng`;
  const htmlContent = wrapHtmlBody(
    "Ch\xE0o m\u1EEBng t\xE2n sinh vi\xEAn",
    `
      <p class="greeting">Ch\xE0o b\u1EA1n ${params.name},</p>
      <p>Ch\xFAc m\u1EEBng b\u1EA1n \u0111\xE3 gia nh\u1EADp tr\u01B0\u1EDDng h\u1ECDc E16-MCNA! T\xE0i kho\u1EA3n Email ch\xEDnh th\u1EE9c c\u1EE7a b\u1EA1n t\u1EA1i tr\u01B0\u1EDDng \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng:</p>
      <div class="message-box">
        <strong>Email tr\u01B0\u1EDDng:</strong> ${params.schoolEmail}<br/>
        ${params.tempPassword ? `<strong>M\u1EADt kh\u1EA9u t\u1EA1m th\u1EDDi:</strong> ${params.tempPassword}<br/>` : ""}
        <strong>Li\xEAn k\u1EBFt c\u1ED5ng th\xF4ng tin LMS:</strong> <a href="${params.lmsLoginUrl}">${params.lmsLoginUrl}</a>
      </div>
      <p><strong>H\u01B0\u1EDBng d\u1EABn k\xEDch ho\u1EA1t:</strong></p>
      <ol style="font-size: 14px; line-height: 1.6; padding-left: 20px;">
        <li>Truy c\u1EADp v\xE0o <a href="https://gmail.com" target="_blank">Gmail.com</a> v\xE0 \u0111\u0103ng nh\u1EADp b\u1EB1ng Email tr\u01B0\u1EDDng \u1EDF tr\xEAn.</li>
        <li>H\u1EC7 th\u1ED1ng Google s\u1EBD y\xEAu c\u1EA7u b\u1EA1n \u0111\u1ED5i m\u1EADt kh\u1EA9u m\u1EDBi trong l\u1EA7n \u0111\u0103ng nh\u1EADp \u0111\u1EA7u ti\xEAn. H\xE3y ch\u1ECDn m\u1EADt kh\u1EA9u b\u1EA3o m\u1EADt c\u1EE7a ri\xEAng b\u1EA1n.</li>
        <li>S\u1EED d\u1EE5ng Email tr\u01B0\u1EDDng n\xE0y \u0111\u1EC3 nh\u1EADn m\u1ECDi th\xF4ng b\xE1o, l\u1ECBch h\u1ECDc, \u0111i\u1EC3m thi v\xE0 h\u1ECDc ph\xED ti\u1EBFp theo t\u1EEB LMS.</li>
      </ol>
      <div class="button-container">
        <a href="${params.lmsLoginUrl}" class="button" target="_blank">\u0110\u0103ng nh\u1EADp LMS</a>
      </div>
    `
  );
  const action = async () => {
    if (hasSmtpConfig()) {
      const transporter2 = getTransporter2();
      await transporter2.sendMail({
        from: getSmtpFrom(),
        to: params.to,
        subject,
        html: htmlContent,
        text: `Ch\xE0o m\u1EEBng ${params.name},

T\xE0i kho\u1EA3n email tr\u01B0\u1EDDng c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o:
Email: ${params.schoolEmail}
Password t\u1EA1m th\u1EDDi: ${params.tempPassword || "\u0110\xE3 c\u1EA5u h\xECnh"}

Vui l\xF2ng \u0111\u0103ng nh\u1EADp Gmail v\xE0 c\u1ED5ng th\xF4ng tin LMS.`
      });
      console.log(`[EmailWorker] Welcome email dispatched successfully to: ${params.to}`);
    } else {
      logEmailMock2(params.to, params.name, subject, htmlContent);
    }
  };
  try {
    await retryWithBackoff(action);
    await auditRepository.log(pool2, userId, "welcome_email_sent", "email", `G\u1EEDi email ch\xE0o m\u1EEBng t\u1EDBi ${params.to}`);
  } catch (err) {
    console.error(`[EmailWorker] Failed to send welcome email after retries to: ${params.to}`, err);
    await auditRepository.log(
      pool2,
      userId,
      "welcome_email_failed",
      "email",
      `L\u1ED7i g\u1EEDi email ch\xE0o m\u1EEBng: ${String(err.message || err)}`
    );
    throw err;
  }
}
async function sendLmsNotification(pool2, userId, params) {
  const prefixMap = {
    grade: "[\u0110i\u1EC3m]",
    course: "[Kh\xF3a h\u1ECDc]",
    deadline: "[H\u1EA1n ch\xF3t]",
    tuition: "[H\u1ECDc ph\xED]",
    finance: "[T\xE0i ch\xEDnh]",
    warning: "[C\u1EA3nh b\xE1o]",
    danger: "[Kh\u1EA9n c\u1EA5p]",
    info: "[Th\xF4ng b\xE1o]",
    success: "[Th\xE0nh c\xF4ng]"
  };
  const prefix = prefixMap[params.type] || "[LMS E16]";
  const finalSubject = `${prefix} ${params.subject}`;
  const htmlContent = wrapHtmlBody(
    params.subject,
    `
      <p class="greeting">Ch\xE0o h\u1ECDc vi\xEAn,</p>
      <p>H\u1EC7 th\u1ED1ng LMS th\xF4ng b\xE1o c\u1EADp nh\u1EADt m\u1EDBi li\xEAn quan \u0111\u1EBFn t\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n:</p>
      <div class="message-box">
        ${params.body}
      </div>
      <p>Vui l\xF2ng \u0111\u0103ng nh\u1EADp c\u1ED5ng th\xF4ng tin LMS \u0111\u1EC3 bi\u1EBFt th\xEAm chi ti\u1EBFt.</p>
    `
  );
  const action = async () => {
    if (hasSmtpConfig()) {
      const transporter2 = getTransporter2();
      await transporter2.sendMail({
        from: getSmtpFrom(),
        to: params.to,
        subject: finalSubject,
        html: htmlContent,
        text: params.body
      });
      console.log(`[EmailWorker] Notification email dispatched successfully to: ${params.to}`);
    } else {
      logEmailMock2(params.to, "H\u1ECDc vi\xEAn", finalSubject, htmlContent);
    }
  };
  try {
    await retryWithBackoff(action);
    await auditRepository.log(pool2, userId, "notification_email_sent", "email", `G\u1EEDi th\xF4ng b\xE1o lo\u1EA1i [${params.type}] t\u1EDBi ${params.to}`);
  } catch (err) {
    console.error(`[EmailWorker] Failed to send notification email after retries to: ${params.to}`, err);
    await auditRepository.log(
      pool2,
      userId,
      "notification_email_failed",
      "email",
      `L\u1ED7i g\u1EEDi th\xF4ng b\xE1o [${params.type}]: ${String(err.message || err)}`
    );
    throw err;
  }
}
async function sendPasswordResetLinkEmail(pool2, userId, params) {
  const subject = `[LMS E16] Li\xEAn k\u1EBFt \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u`;
  const safeName = escapeHtml(params.name);
  const safeResetUrl = escapeHtml(params.resetUrl);
  const expiresAt = new Date(params.expiresAt).toLocaleString("vi-VN");
  const htmlContent = wrapHtmlBody(
    "\u0110\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u t\xE0i kho\u1EA3n",
    `
      <p class="greeting">Ch\xE0o b\u1EA1n ${safeName},</p>
      <p>Ch\xFAng t\xF4i nh\u1EADn \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u cho t\xE0i kho\u1EA3n LMS c\u1EE7a b\u1EA1n. Vui l\xF2ng d\xF9ng li\xEAn k\u1EBFt m\u1ED9t l\u1EA7n d\u01B0\u1EDBi \u0111\xE2y \u0111\u1EC3 thi\u1EBFt l\u1EADp m\u1EADt kh\u1EA9u m\u1EDBi. N\u1EBFu b\u1EA1n kh\xF4ng y\xEAu c\u1EA7u, h\xE3y b\u1ECF qua email n\xE0y.</p>
      <div class="message-box" style="font-size: 16px; text-align: center;">
        <a href="${safeResetUrl}" style="display: inline-block; color: #ffffff; background: #4f46e5; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 700;">\u0110\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u</a>
      </div>
      <p>N\u1EBFu n\xFAt kh\xF4ng ho\u1EA1t \u0111\u1ED9ng, h\xE3y sao ch\xE9p li\xEAn k\u1EBFt n\xE0y v\xE0o tr\xECnh duy\u1EC7t:</p>
      <p style="word-break: break-all; font-family: monospace; font-size: 12px;">${safeResetUrl}</p>
      <p style="color: #ef4444; font-weight: 600;">L\u01B0u \xFD b\u1EA3o m\u1EADt: Li\xEAn k\u1EBFt h\u1EBFt h\u1EA1n l\xFAc ${expiresAt} v\xE0 ch\u1EC9 d\xF9ng \u0111\u01B0\u1EE3c m\u1ED9t l\u1EA7n.</p>
    `
  );
  const action = async () => {
    if (hasSmtpConfig()) {
      const transporter2 = getTransporter2();
      await transporter2.sendMail({
        from: getSmtpFrom(),
        to: params.to,
        subject,
        html: htmlContent,
        text: `Ch\xE0o b\u1EA1n ${params.name},

D\xF9ng li\xEAn k\u1EBFt sau \u0111\u1EC3 \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u LMS. Li\xEAn k\u1EBFt h\u1EBFt h\u1EA1n l\xFAc ${expiresAt} v\xE0 ch\u1EC9 d\xF9ng \u0111\u01B0\u1EE3c m\u1ED9t l\u1EA7n:
${params.resetUrl}`
      });
      console.log(`[EmailWorker] Password reset link email dispatched successfully to: ${params.to}`);
    } else {
      logEmailMock2(params.to, params.name, subject, htmlContent);
    }
  };
  try {
    await retryWithBackoff(action);
    await auditRepository.log(pool2, userId, "password_reset_link_email_sent", "email", `G\u1EEDi email li\xEAn k\u1EBFt \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u t\u1EDBi ${params.to}`);
  } catch (err) {
    console.error(`[EmailWorker] Failed to send password reset link email to: ${params.to}`, err);
    await auditRepository.log(
      pool2,
      userId,
      "password_reset_link_email_failed",
      "email",
      `L\u1ED7i g\u1EEDi email li\xEAn k\u1EBFt \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u: ${String(err.message || err)}`
    );
    throw err;
  }
}
async function deliverEmail(params) {
  if (hasSmtpConfig()) {
    await getTransporter2().sendMail({ from: getSmtpFrom(), to: params.to, subject: params.subject, html: params.html, text: params.text });
    console.log(`[EmailWorker] "${params.subject}" dispatched to: ${params.to}`);
  } else {
    logEmailMock2(params.to, params.name, params.subject, params.html);
  }
}
async function sendTemporaryPasswordEmail(pool2, userId, params) {
  const subject = `[LMS MCNA] Th\xF4ng tin \u0111\u0103ng nh\u1EADp t\xE0i kho\u1EA3n h\u1ECDc vi\xEAn`;
  const safeName = escapeHtml(params.name);
  const safeEmail = escapeHtml(params.to);
  const safePassword = escapeHtml(params.temporaryPassword);
  const safeLoginUrl = escapeHtml(params.loginUrl);
  const html = wrapHtmlBody(
    "Th\xF4ng tin \u0111\u0103ng nh\u1EADp",
    `
      <p class="greeting">Ch\xE0o b\u1EA1n ${safeName},</p>
      <p>T\xE0i kho\u1EA3n h\u1ECDc vi\xEAn LMS c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o b\u1EB1ng \u0111\u1ECBa ch\u1EC9 email n\xE0y. Th\xF4ng tin \u0111\u0103ng nh\u1EADp:</p>
      <div class="message-box">
        <strong>Email \u0111\u0103ng nh\u1EADp:</strong> ${safeEmail}<br/>
        <strong>M\u1EADt kh\u1EA9u t\u1EA1m th\u1EDDi:</strong> <span style="font-family: monospace; font-size: 16px;">${safePassword}</span>
      </div>
      <p style="color: #ef4444; font-weight: 600;">V\xEC l\xFD do b\u1EA3o m\u1EADt, h\u1EC7 th\u1ED1ng s\u1EBD y\xEAu c\u1EA7u b\u1EA1n \u0111\u1ED5i m\u1EADt kh\u1EA9u ngay trong l\u1EA7n \u0111\u0103ng nh\u1EADp \u0111\u1EA7u ti\xEAn.</p>
      <div class="button-container">
        <a href="${safeLoginUrl}" class="button" target="_blank">\u0110\u0103ng nh\u1EADp LMS</a>
      </div>
      <p>N\u1EBFu b\u1EA1n kh\xF4ng y\xEAu c\u1EA7u t\u1EA1o t\xE0i kho\u1EA3n, h\xE3y b\u1ECF qua email n\xE0y.</p>
    `
  );
  try {
    await retryWithBackoff(
      () => deliverEmail({
        to: params.to,
        name: params.name,
        subject,
        html,
        text: `Ch\xE0o b\u1EA1n ${params.name},

T\xE0i kho\u1EA3n h\u1ECDc vi\xEAn LMS c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o.
Email \u0111\u0103ng nh\u1EADp: ${params.to}
M\u1EADt kh\u1EA9u t\u1EA1m th\u1EDDi: ${params.temporaryPassword}

B\u1EA1n s\u1EBD \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u \u0111\u1ED5i m\u1EADt kh\u1EA9u \u1EDF l\u1EA7n \u0111\u0103ng nh\u1EADp \u0111\u1EA7u ti\xEAn: ${params.loginUrl}`
      }),
      2,
      [3e3]
    );
    await auditRepository.log(pool2, userId, "temporary_password_email_sent", "email", `G\u1EEDi m\u1EADt kh\u1EA9u t\u1EA1m th\u1EDDi t\u1EDBi ${params.to}`);
  } catch (err) {
    console.error(`[EmailWorker] Failed to send temporary password email to: ${params.to}`, err);
    throw err;
  }
}
async function sendAccountExistsEmail(pool2, userId, params) {
  const subject = `[LMS MCNA] B\u1EA1n \u0111\xE3 c\xF3 t\xE0i kho\u1EA3n LMS`;
  const safeName = escapeHtml(params.name);
  const safeLoginUrl = escapeHtml(params.loginUrl);
  const html = wrapHtmlBody(
    "B\u1EA1n \u0111\xE3 c\xF3 t\xE0i kho\u1EA3n",
    `
      <p class="greeting">Ch\xE0o b\u1EA1n ${safeName},</p>
      <p>C\xF3 m\u1ED9t y\xEAu c\u1EA7u t\u1EA1o t\xE0i kho\u1EA3n LMS m\u1EDBi b\u1EB1ng \u0111\u1ECBa ch\u1EC9 email n\xE0y, nh\u01B0ng email \u0111\xE3 \u0111\u01B0\u1EE3c d\xF9ng cho m\u1ED9t t\xE0i kho\u1EA3n hi\u1EC7n c\xF3.</p>
      <p>H\xE3y \u0111\u0103ng nh\u1EADp b\u1EB1ng m\u1EADt kh\u1EA9u hi\u1EC7n t\u1EA1i. N\u1EBFu qu\xEAn m\u1EADt kh\u1EA9u, ch\u1ECDn <strong>Qu\xEAn m\u1EADt kh\u1EA9u</strong> \u1EDF trang \u0111\u0103ng nh\u1EADp \u0111\u1EC3 nh\u1EADn li\xEAn k\u1EBFt \u0111\u1EB7t l\u1EA1i.</p>
      <div class="button-container">
        <a href="${safeLoginUrl}" class="button" target="_blank">\u0110\u1EBFn trang \u0111\u0103ng nh\u1EADp</a>
      </div>
      <p>N\u1EBFu kh\xF4ng ph\u1EA3i b\u1EA1n th\u1EF1c hi\u1EC7n, b\u1EA1n c\xF3 th\u1EC3 b\u1ECF qua email n\xE0y.</p>
    `
  );
  await retryWithBackoff(
    () => deliverEmail({
      to: params.to,
      name: params.name,
      subject,
      html,
      text: `Ch\xE0o b\u1EA1n ${params.name},

Email n\xE0y \u0111\xE3 c\xF3 t\xE0i kho\u1EA3n LMS. H\xE3y \u0111\u0103ng nh\u1EADp ho\u1EB7c d\xF9ng "Qu\xEAn m\u1EADt kh\u1EA9u" t\u1EA1i ${params.loginUrl}`
    }),
    2,
    [3e3]
  );
  await auditRepository.log(pool2, userId, "account_exists_email_sent", "email", `B\xE1o t\xE0i kho\u1EA3n \u0111\xE3 t\u1ED3n t\u1EA1i t\u1EDBi ${params.to}`);
}

// src/server/emailProvisioning/provisioningService.ts
var LMS_LOGIN_URL = process.env.LMS_LOGIN_URL || "http://localhost:3000";
var provisioningService = {
  /**
   * Provision a Google Workspace email account for a student user
   */
  async provisionStudentEmail(pool2, userId) {
    console.log(`[ProvisioningService] Beginning provisioning for student user ID: ${userId}`);
    const userRes = await pool2.query(
      "SELECT id, email, name, role, email_provisioned, school_email FROM users WHERE id = $1",
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    if (user.role !== "student") {
      console.log(`[ProvisioningService] User ${userId} is not a student (${user.role}). Skipping provisioning.`);
      return;
    }
    if (user.email_provisioned) {
      console.log(`[ProvisioningService] User ${userId} is already provisioned (${user.school_email}). Skipping.`);
      return;
    }
    const { schoolEmail, tempPassword } = await createSchoolEmail(pool2, {
      id: user.id,
      name: user.name,
      email: user.email
    });
    await pool2.query(
      `UPDATE users
       SET school_email = $1, email_provisioned = true, email_provisioned_at = NOW()
       WHERE id = $2`,
      [schoolEmail, userId]
    );
    console.log(`[ProvisioningService] Updated user table for ${userId} with email ${schoolEmail}.`);
    try {
      await sendWelcomeEmail(pool2, userId, {
        to: user.email,
        name: user.name,
        schoolEmail,
        tempPassword,
        lmsLoginUrl: LMS_LOGIN_URL
      });
    } catch (welcomeErr) {
      console.error(`[ProvisioningService] Welcome email dispatch failed for ${userId}:`, welcomeErr);
    }
    try {
      await notificationsRepository.create(pool2, {
        userId,
        type: "success",
        message: `T\xE0i kho\u1EA3n email tr\u01B0\u1EDDng \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o th\xE0nh c\xF4ng: ${schoolEmail}. Vui l\xF2ng ki\u1EC3m tra h\u1ED9p th\u01B0 c\xE1 nh\xE2n \u0111\u1EC3 nh\u1EADn m\u1EADt kh\u1EA9u \u0111\u0103ng nh\u1EADp.`
      });
    } catch (notifErr) {
      console.error(`[ProvisioningService] Internal notification creation failed for ${userId}:`, notifErr);
    }
    await auditRepository.log(
      pool2,
      userId,
      "email_provisioning_completed",
      "email",
      `\u0110\xE3 ho\xE0n th\xE0nh t\u1EA1o email tr\u01B0\u1EDDng ${schoolEmail}`
    );
  },
  /**
   * Send notification to a student's school email if provisioned
   */
  async sendNotificationEmail(pool2, userId, payload) {
    const userRes = await pool2.query(
      "SELECT school_email, email_provisioned, role FROM users WHERE id = $1",
      [userId]
    );
    const user = userRes.rows[0];
    if (!user) {
      console.warn(`[ProvisioningService] User ${userId} not found for sending notification email.`);
      return;
    }
    if (user.role !== "student") {
      return;
    }
    if (!user.email_provisioned || !user.school_email) {
      console.log(`[ProvisioningService] Student ${userId} email is not provisioned yet. Skipping notification email.`);
      return;
    }
    await sendLmsNotification(pool2, userId, {
      to: user.school_email,
      subject: payload.subject,
      body: payload.body,
      type: payload.type
    });
  }
};

// src/server/repositories/notifications.ts
var notificationsRepository = {
  async listForUser(db, userId, unreadOnly = false) {
    const res = unreadOnly ? await db.query("SELECT * FROM notifications WHERE user_id = $1 AND is_read = false ORDER BY created_at DESC", [userId]) : await db.query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      message: row.message,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at
    }));
  },
  async create(db, input) {
    const notification = {
      id: generateId2("noti"),
      userId: input.userId,
      type: input.type || "info",
      message: input.message,
      isRead: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    let userEmail = null;
    let userName = null;
    let userRole = null;
    let emailProvisioned = false;
    try {
      const userRes = await db.query(
        "SELECT email, name, role, email_provisioned FROM users WHERE id = $1",
        [notification.userId]
      );
      if (userRes.rows[0]) {
        userEmail = userRes.rows[0].email;
        userName = userRes.rows[0].name;
        userRole = userRes.rows[0].role;
        emailProvisioned = Boolean(userRes.rows[0].email_provisioned);
      }
    } catch (dbErr) {
      console.error("[Notifications Repository] Synchronous user email fetch failed:", dbErr);
    }
    await db.query(
      `INSERT INTO notifications (id, user_id, type, message, is_read, created_at, related_entity_type, related_entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        notification.id,
        notification.userId,
        notification.type,
        notification.message,
        Boolean(notification.isRead),
        notification.createdAt,
        input.relatedEntityType || null,
        input.relatedEntityId || null
      ]
    );
    if (userRole === "student") {
      if (emailProvisioned) {
        provisioningService.sendNotificationEmail(db, notification.userId, {
          subject: "C\u1EADp nh\u1EADt th\xF4ng b\xE1o t\u1EEB LMS",
          body: notification.message,
          type: notification.type
        }).catch((err) => {
          console.error("[Notifications Repository] School email notification dispatch error:", err);
        });
      } else {
        console.log(`[Notifications Repository] Skipping email for unprovisioned student ${notification.userId}`);
      }
    } else {
      if (userEmail) {
        sendEmailDirect(userEmail, userName || "H\u1ECDc vi\xEAn", notification.message).catch((err) => {
          console.error("[Email Notification dispatch error]:", err);
        });
      }
    }
    return notification;
  },
  async createBulk(db, notifications) {
    for (const notification of notifications) {
      await this.create(db, notification);
    }
  },
  async createNotification(db, userId, type, message) {
    return this.create(db, { userId, type, message });
  },
  async markRead(db, notificationId, userId) {
    if (userId) {
      await db.query("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2", [notificationId, userId]);
      return;
    }
    await db.query("UPDATE notifications SET is_read = true WHERE id = $1", [notificationId]);
  },
  async markAllRead(db, userId) {
    await db.query("UPDATE notifications SET is_read = true WHERE user_id = $1", [userId]);
  },
  async markAllReadForUser(db, userId) {
    await this.markAllRead(db, userId);
  }
};

// src/server/notify.ts
async function notifyUsers(db, userIds, notification) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return;
  await notificationsRepository.createBulk(
    db,
    uniqueIds.map((userId) => ({ userId, type: notification.type || "info", ...notification }))
  );
}
async function notifyStudent(db, studentId, message, meta = {}) {
  await notifyUsers(db, [studentId], { type: "info", message, ...meta });
}
async function notifyRole(db, role, message, meta = {}) {
  const users = await db.query("SELECT id FROM users WHERE role = $1 AND is_active = true", [role]);
  await notifyUsers(db, users.rows.map((row) => row.id), { type: "info", message, ...meta });
}

// src/server/repositories/quizzes.ts
var quizzesRepository = {
  async create(db, input) {
    const quiz = { ...input, id: generateId2("quiz") };
    await db.query(
      "INSERT INTO quizzes (id, course_id, lesson_id, session_id, title, passing_score, time_limit, max_attempts, deadline) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [quiz.id, quiz.courseId, quiz.lessonId || null, quiz.sessionId || null, quiz.title, quiz.passingScore, quiz.timeLimit, quiz.maxAttempts, quiz.deadline || null]
    );
    return quiz;
  },
  async addQuestion(db, input) {
    const question = { ...input, id: generateId2("question"), createdAt: input.createdAt || (/* @__PURE__ */ new Date()).toISOString() };
    await db.query(
      "INSERT INTO questions (id, quiz_id, text, type, options_json, correct_answer, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [question.id, question.quizId, question.text, question.type, JSON.stringify(question.options || []), question.correctAnswer, question.createdAt]
    );
    return question;
  },
  async updateQuestion(db, questionId, input) {
    await db.query(
      "UPDATE questions SET text = $1, type = $2, options_json = $3, correct_answer = $4 WHERE id = $5",
      [input.text, input.type, JSON.stringify(input.options || []), input.correctAnswer, questionId]
    );
    return { id: questionId, ...input };
  },
  async deleteQuestion(db, questionId) {
    await db.query("DELETE FROM questions WHERE id = $1", [questionId]);
    return { id: questionId };
  },
  async findById(db, quizId) {
    const row = (await db.query("SELECT * FROM quizzes WHERE id = $1", [quizId])).rows[0];
    return row ? quizFromRow(row) : null;
  },
  async listQuestions(db, quizId) {
    return (await db.query("SELECT * FROM questions WHERE quiz_id = $1", [quizId])).rows.map(questionFromRow);
  },
  async submitAttempt(db, quizId, studentId, answers, startedAt) {
    const quiz = await this.findById(db, quizId);
    if (!quiz) return null;
    const enrollment = (await db.query(
      "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
      [studentId, quiz.courseId]
    )).rows[0];
    if (!enrollment) return { error: "Active enrollment required to submit this quiz.", status: 403 };
    if (quiz.maxAttempts && quiz.maxAttempts > 0) {
      const attemptsCountRes = await db.query(
        "SELECT COUNT(*) AS count FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2",
        [quizId, studentId]
      );
      const attemptCount = Number(attemptsCountRes.rows[0].count);
      if (attemptCount >= quiz.maxAttempts) {
        return { error: `\u0110\xE3 v\u01B0\u1EE3t qu\xE1 s\u1ED1 l\u01B0\u1EE3t l\xE0m b\xE0i t\u1ED1i \u0111a cho ph\xE9p (${quiz.maxAttempts} l\u01B0\u1EE3t).`, status: 403 };
      }
    }
    if (quiz.timeLimit && quiz.timeLimit > 0 && startedAt) {
      const startTime = new Date(startedAt).getTime();
      const endTime = Date.now();
      const elapsedMinutes = (endTime - startTime) / (1e3 * 60);
      if (elapsedMinutes > quiz.timeLimit + 0.2) {
        return { error: `Th\u1EDDi gian l\xE0m b\xE0i thi tr\u1EAFc nghi\u1EC7m \u0111\xE3 v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n cho ph\xE9p (${quiz.timeLimit} ph\xFAt).`, status: 403 };
      }
    }
    if (quiz.deadline) {
      const deadlineDate = new Date(quiz.deadline);
      if (/* @__PURE__ */ new Date() > deadlineDate) {
        return { error: "Kh\xF4ng th\u1EC3 n\u1ED9p b\xE0i tr\u1EAFc nghi\u1EC7m do \u0111\xE3 qu\xE1 h\u1EA1n n\u1ED9p b\xE0i (deadline).", status: 400 };
      }
    }
    const questions = await this.listQuestions(db, quizId);
    let correctCount = 0;
    for (const question of questions) {
      const studentAnswer = answers[question.id] || "";
      if (question.type === "text" && question.correctAnswer.toLowerCase().split(",").map((key) => key.trim()).some((key) => studentAnswer.toLowerCase().includes(key))) {
        correctCount++;
      } else if (question.type === "multiple") {
        const sortedStudent = studentAnswer.split(",").map((x) => x.trim()).filter(Boolean).sort().join(",");
        const sortedCorrect = question.correctAnswer.split(",").map((x) => x.trim()).filter(Boolean).sort().join(",");
        if (sortedStudent === sortedCorrect) correctCount++;
      } else if (question.type === "single" && studentAnswer === question.correctAnswer) {
        correctCount++;
      }
    }
    const score = Math.round(correctCount / (questions.length || 1) * 100);
    const passed = score >= quiz.passingScore;
    const attempt = { id: generateId2("attempt"), quizId, studentId, answers, score, passed, startedAt: startedAt || (/* @__PURE__ */ new Date()).toISOString(), submittedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await db.query(
      "INSERT INTO quiz_attempts (id,quiz_id,student_id,answers_json,score,passed,started_at,submitted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [attempt.id, quizId, studentId, JSON.stringify(answers), score, passed ? 1 : 0, attempt.startedAt, attempt.submittedAt]
    );
    await notifyStudent(
      db,
      studentId,
      `B\xE0i thi tr\u1EAFc nghi\u1EC7m "${quiz.title}" \u0111\u1EA1t \u0111i\u1EC3m s\u1ED1: ${score}%${passed ? " \u2014 \u0110\u1EA1t" : " \u2014 Kh\xF4ng \u0111\u1EA1t"}.`,
      { relatedEntityType: "quiz", relatedEntityId: quizId }
    );
    return { row: { ...attempt, correctAnswers: correctCount, total: questions.length } };
  },
  async update(db, id, input) {
    const row = (await db.query(
      "UPDATE quizzes SET title = COALESCE($1, title), lesson_id = COALESCE($2, lesson_id), session_id = COALESCE($3, session_id), passing_score = COALESCE($4, passing_score), time_limit = COALESCE($5, time_limit), max_attempts = COALESCE($6, max_attempts), deadline = COALESCE($7, deadline) WHERE id = $8 RETURNING *",
      [
        input.title || null,
        input.lessonId !== void 0 ? input.lessonId : null,
        input.sessionId !== void 0 ? input.sessionId : null,
        input.passingScore !== void 0 ? input.passingScore : null,
        input.timeLimit !== void 0 ? input.timeLimit : null,
        input.maxAttempts !== void 0 ? input.maxAttempts : null,
        input.deadline !== void 0 ? input.deadline : null,
        id
      ]
    )).rows[0];
    return row ? quizFromRow(row) : null;
  },
  async delete(db, id) {
    await db.query("DELETE FROM questions WHERE quiz_id = $1", [id]);
    await db.query("DELETE FROM quizzes WHERE id = $1", [id]);
    return { id };
  }
};

// src/server/repositories/assignments.ts
var hasEnsuredColumns = false;
async function ensureAssignmentSchema(db) {
  if (hasEnsuredColumns) return;
  try {
    await db.query(`
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_url TEXT;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS session_id TEXT;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id TEXT;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS type TEXT;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attachment_url TEXT;
      ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS attachment_url TEXT;
      ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS session_id TEXT;
    `);
    hasEnsuredColumns = true;
  } catch (err) {
  }
}
var assignmentsRepository = {
  async create(db, input) {
    await ensureAssignmentSchema(db);
    const assignment = { ...input, id: generateId2("assign") };
    try {
      await db.query(
        "INSERT INTO assignments (id, course_id, title, description, deadline, max_score, attachment_url, lesson_id, type, session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          assignment.id,
          assignment.courseId,
          assignment.title,
          assignment.description,
          assignment.deadline,
          assignment.maxScore,
          assignment.attachmentUrl || null,
          assignment.lessonId || null,
          assignment.type || null,
          assignment.sessionId || null
        ]
      );
    } catch (err) {
      if (err?.code === "42703" || err?.message?.includes("does not exist") || err?.message?.includes("attachment_url")) {
        hasEnsuredColumns = false;
        await db.query(`
          ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_url TEXT;
          ALTER TABLE assignments ADD COLUMN IF NOT EXISTS session_id TEXT;
          ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id TEXT;
          ALTER TABLE assignments ADD COLUMN IF NOT EXISTS type TEXT;
        `);
        hasEnsuredColumns = true;
        await db.query(
          "INSERT INTO assignments (id, course_id, title, description, deadline, max_score, attachment_url, lesson_id, type, session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [
            assignment.id,
            assignment.courseId,
            assignment.title,
            assignment.description,
            assignment.deadline,
            assignment.maxScore,
            assignment.attachmentUrl || null,
            assignment.lessonId || null,
            assignment.type || null,
            assignment.sessionId || null
          ]
        );
      } else {
        throw err;
      }
    }
    return assignment;
  },
  async submit(db, studentId, assignmentId, content, attachmentUrl) {
    await ensureAssignmentSchema(db);
    const assignment = (await db.query("SELECT course_id, deadline FROM assignments WHERE id = $1", [assignmentId])).rows[0];
    if (!assignment) return { error: "Assignment not found.", status: 404 };
    if (assignment.deadline) {
      const deadlineDate = new Date(assignment.deadline);
      if (/* @__PURE__ */ new Date() > deadlineDate) {
        return { error: "Kh\xF4ng th\u1EC3 n\u1ED9p ho\u1EB7c ch\u1EC9nh s\u1EEDa b\xE0i t\u1EADp t\u1EF1 lu\u1EADn do \u0111\xE3 qu\xE1 h\u1EA1n n\u1ED9p b\xE0i (deadline).", status: 400 };
      }
    }
    const enrollment = (await db.query(
      "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
      [studentId, assignment.course_id]
    )).rows[0];
    if (!enrollment) return { error: "Active enrollment required to submit this assignment.", status: 403 };
    const existing = (await db.query(
      "SELECT id FROM submissions WHERE student_id = $1 AND assignment_id = $2",
      [studentId, assignmentId]
    )).rows[0];
    try {
      if (existing) {
        const submittedAt = (/* @__PURE__ */ new Date()).toISOString();
        const updated = (await db.query(
          "UPDATE submissions SET content = $1, submitted_at = $2, attachment_url = COALESCE($4, attachment_url) WHERE id = $3 RETURNING attachment_url",
          [content, submittedAt, existing.id, attachmentUrl || null]
        )).rows[0];
        return { row: { id: existing.id, assignmentId, studentId, content, submittedAt, attachmentUrl: updated?.attachment_url || void 0 } };
      } else {
        const submission = { id: generateId2("sub"), assignmentId, studentId, content, submittedAt: (/* @__PURE__ */ new Date()).toISOString(), attachmentUrl };
        await db.query(
          "INSERT INTO submissions (id, assignment_id, student_id, content, submitted_at, attachment_url) VALUES ($1,$2,$3,$4,$5,$6)",
          [submission.id, assignmentId, studentId, content, submission.submittedAt, attachmentUrl || null]
        );
        return { row: submission };
      }
    } catch (err) {
      if (err?.code === "42703" || err?.message?.includes("attachment_url")) {
        await db.query("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attachment_url TEXT;");
        if (existing) {
          const submittedAt = (/* @__PURE__ */ new Date()).toISOString();
          const updated = (await db.query(
            "UPDATE submissions SET content = $1, submitted_at = $2, attachment_url = COALESCE($4, attachment_url) WHERE id = $3 RETURNING attachment_url",
            [content, submittedAt, existing.id, attachmentUrl || null]
          )).rows[0];
          return { row: { id: existing.id, assignmentId, studentId, content, submittedAt, attachmentUrl: updated?.attachment_url || void 0 } };
        } else {
          const submission = { id: generateId2("sub"), assignmentId, studentId, content, submittedAt: (/* @__PURE__ */ new Date()).toISOString(), attachmentUrl };
          await db.query(
            "INSERT INTO submissions (id, assignment_id, student_id, content, submitted_at, attachment_url) VALUES ($1,$2,$3,$4,$5,$6)",
            [submission.id, assignmentId, studentId, content, submission.submittedAt, attachmentUrl || null]
          );
          return { row: submission };
        }
      }
      throw err;
    }
  },
  async findSubmissionForGrading(db, submissionId) {
    return (await db.query("SELECT s.*, a.max_score, c.teacher_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN courses c ON c.id = a.course_id WHERE s.id = $1", [submissionId])).rows[0] || null;
  },
  async grade(db, submissionId, score, feedback) {
    await db.query("UPDATE submissions SET score = $1, feedback = $2, graded_at = $3 WHERE id = $4", [score, feedback, (/* @__PURE__ */ new Date()).toISOString(), submissionId]);
    const submission = (await db.query(
      `SELECT s.student_id, a.title, a.max_score
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       WHERE s.id = $1`,
      [submissionId]
    )).rows[0];
    if (submission) {
      const feedbackText = feedback?.trim() ? ` Nh\u1EADn x\xE9t: ${feedback.trim()}` : "";
      await notifyStudent(
        db,
        submission.student_id,
        `B\xE0i t\u1EF1 lu\u1EADn "${submission.title}" \u0111\xE3 \u0111\u01B0\u1EE3c ch\u1EA5m: ${score}/${submission.max_score}.${feedbackText}`,
        { relatedEntityType: "submission", relatedEntityId: submissionId }
      );
    }
    return { id: submissionId, score, feedback };
  },
  async update(db, id, input) {
    const sets = [];
    const values = [];
    let paramIndex = 1;
    for (const [key, val] of Object.entries(input)) {
      let dbCol = "";
      if (key === "title") dbCol = "title";
      else if (key === "description") dbCol = "description";
      else if (key === "deadline") dbCol = "deadline";
      else if (key === "maxScore") dbCol = "max_score";
      else if (key === "attachmentUrl") dbCol = "attachment_url";
      else if (key === "lessonId") dbCol = "lesson_id";
      else if (key === "sessionId") dbCol = "session_id";
      else if (key === "type") dbCol = "type";
      if (dbCol) {
        sets.push(`${dbCol} = $${paramIndex++}`);
        values.push(val === void 0 ? null : val);
      }
    }
    if (sets.length > 0) {
      values.push(id);
      await db.query(`UPDATE assignments SET ${sets.join(", ")} WHERE id = $${paramIndex}`, values);
    }
    const row = (await db.query("SELECT * FROM assignments WHERE id = $1", [id])).rows[0];
    return row ? {
      id: row.id,
      courseId: row.course_id,
      sessionId: row.session_id || void 0,
      title: row.title,
      description: row.description,
      deadline: row.deadline,
      maxScore: Number(row.max_score),
      attachmentUrl: row.attachment_url || void 0,
      lessonId: row.lesson_id || void 0,
      type: row.type || void 0
    } : null;
  },
  async delete(db, id) {
    await db.query("DELETE FROM assignments WHERE id = $1", [id]);
    return { id };
  }
};

// src/server/repositories/finance.ts
var financeRepository = {
  async reviewTransaction(db, txId, status, reviewerId, notes) {
    const tx = (await db.query("SELECT * FROM transactions WHERE id = $1 FOR UPDATE", [txId])).rows[0];
    if (!tx) return null;
    if (tx.status !== "pending") return { error: "Transaction already reviewed.", status: 409 };
    const processedAt = (/* @__PURE__ */ new Date()).toISOString();
    const reviewNote = notes || (status === "approved" ? "Payment confirmed and learning flow updated." : "Payment rejected by payment operator.");
    const row = (await db.query(
      `UPDATE transactions
       SET status = $2, processed_at = $3, processed_by = $4, notes = $5
       WHERE id = $1
       RETURNING *`,
      [txId, status, processedAt, reviewerId, reviewNote]
    )).rows[0];
    if (tx.course_id) {
      await db.query(
        `UPDATE enrollments
         SET status = $3
         WHERE student_id = $1 AND course_id = $2 AND status = 'pending_payment'`,
        [tx.student_id, tx.course_id, status === "approved" ? "pending" : "pending_payment"]
      );
    }
    return row;
  }
};

// src/server/repositories/storeSnapshot.ts
var cachedSnapshot = null;
var lastCacheTime = 0;
var cacheGeneration = 0;
var CACHE_TTL = 15e3;
function invalidateStoreCache() {
  cachedSnapshot = null;
  lastCacheTime = 0;
  cacheGeneration++;
}
async function storeSnapshotFromDb(db, forceBypassCache = false) {
  const now = Date.now();
  if (!forceBypassCache && cachedSnapshot && now - lastCacheTime < CACHE_TTL) {
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
    db.query("SELECT * FROM users"),
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
  const lessons = lessonsRes.rows.map((row) => ({ id: row.id, courseId: row.course_id, title: row.title, content: row.content, videoUrl: row.video_url || void 0, order: row.lesson_order, duration: row.duration }));
  const enrollments = enrollmentsRes.rows.map(enrollmentFromRow);
  const lessonProgress = lessonProgressRes.rows.map((row) => ({ id: row.id, enrollmentId: row.enrollment_id, lessonId: row.lesson_id, completed: Boolean(row.completed), completedAt: row.completed_at || void 0 }));
  const quizzes = quizzesRes.rows.map(quizFromRow);
  const questions = questionsRes.rows.map(questionFromRow);
  const quizAttempts = quizAttemptsRes.rows.map(quizAttemptFromRow);
  const assignments = assignmentsRes.rows.map(assignmentFromRow);
  const submissions = submissionsRes.rows.map(submissionFromRow);
  const auditLogs = auditLogsRes.rows.map((row) => ({ id: row.id, userId: row.user_id, action: row.action, target: row.target, detail: row.detail || "", createdAt: row.created_at }));
  const attendanceSessions = attendanceSessionsRes.rows.map((row) => ({
    id: row.id,
    courseId: row.course_id,
    sectionId: row.section_id || void 0,
    teacherId: row.teacher_id,
    date: row.date || row.session_date,
    topic: row.topic,
    videoUrl: row.video_url || void 0,
    recordingUrl: row.recording_url || void 0,
    content: row.content || void 0,
    code: row.code || void 0,
    expiresAt: row.expires_at || void 0
  }));
  const attendanceRecords = attendanceRecordsRes.rows.map((row) => ({ id: row.id, sessionId: row.session_id, studentId: row.student_id, status: row.status, note: row.note || void 0, checkedInAt: row.checked_in_at || void 0, checkinMethod: row.checkin_method || void 0 }));
  const sessionMaterials = sessionMaterialsRes.rows.map(sessionMaterialFromRow);
  const notifications = notificationsRes.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    relatedEntityType: row.related_entity_type || void 0,
    relatedEntityId: row.related_entity_id || void 0
  }));
  const transactions = transactionsRes.rows.map((row) => ({ id: row.id, studentId: row.student_id, courseId: row.course_id || "", amount: Number(row.amount), status: row.status, paymentMethod: row.payment_method, createdAt: row.created_at, processedAt: row.processed_at || void 0, processedBy: row.processed_by || void 0, notes: row.notes || void 0 }));
  const courseSections = courseSectionsRes.rows.map(courseSectionFromRow);
  const courseRegistrations = courseRegistrationsRes.rows.map((row) => ({ id: row.id, studentId: row.student_id, sectionId: row.section_id, status: row.status, registeredAt: row.registered_at, droppedAt: row.dropped_at || void 0, grade: row.grade || void 0, letterGrade: row.letter_grade || void 0, gradePoint: row.grade_point === null ? void 0 : Number(row.grade_point), credits: row.credits, isRetake: Boolean(row.is_retake) }));
  const certificates = certificatesRes.rows.map((row) => ({ id: row.id, enrollmentId: row.enrollment_id, studentId: row.student_id, courseId: row.course_id, issuedAt: row.issued_at, certificateCode: row.certificate_code }));
  const forumReplies = forumRepliesRes.rows.map((row) => ({ id: row.id, postId: row.post_id, authorId: row.author_id, content: row.content, createdAt: row.created_at }));
  const forumPosts = forumPostsRes.rows.map((row) => {
    const postReplies = forumReplies.filter((r) => r.postId === row.id);
    return { id: row.id, courseId: row.course_id, sectionId: row.section_id || void 0, authorId: row.author_id, title: row.title, content: row.content, replies: postReplies, createdAt: row.created_at };
  });
  const teacherAttendance = teacherAttendanceRes.rows.map((row) => ({
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
function limitStoreForRole(store, user) {
  const safeUser = (item) => ({ ...item, passwordHash: "" });
  const sanitizeQuestion = (item) => ({ ...item, correctAnswer: "" });
  const sanitizeLessonPreview = (item) => ({ ...item, content: "", videoUrl: void 0 });
  const sanitizeAttendanceSession = (item) => ({ ...item, code: void 0 });
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
    const teacherCourseIds = new Set(store.courses.filter((course) => course.teacherId === user.id).map((course) => course.id));
    const visibleEnrollments = store.enrollments.filter((item) => teacherCourseIds.has(item.courseId));
    const visibleStudentIds = new Set(visibleEnrollments.map((item) => item.studentId));
    const mySections = new Set(
      (store.courseSections || []).filter((cs) => cs.teacherId === user.id).map((cs) => cs.id)
    );
    const visibleQuizIds = new Set(store.quizzes.filter((quiz) => teacherCourseIds.has(quiz.courseId)).map((quiz) => quiz.id));
    const visibleAssignmentIds = new Set(store.assignments.filter((assignment) => teacherCourseIds.has(assignment.courseId)).map((assignment) => assignment.id));
    const visibleSessionIds = new Set((store.attendanceSessions || []).filter((session) => teacherCourseIds.has(session.courseId) || mySections.has(session.sectionId)).map((session) => session.id));
    const visibleUserIds = /* @__PURE__ */ new Set([user.id]);
    visibleStudentIds.forEach((studentId) => visibleUserIds.add(studentId));
    return {
      ...baseScopedStore(),
      users: store.users.filter((item) => visibleUserIds.has(item.id)).map(safeUser),
      courses: store.courses.filter((course) => teacherCourseIds.has(course.id)),
      lessons: store.lessons.filter((lesson) => teacherCourseIds.has(lesson.courseId)),
      enrollments: visibleEnrollments,
      lessonProgress: store.lessonProgress.filter((item) => visibleEnrollments.some((enroll) => enroll.id === item.enrollmentId)),
      quizzes: store.quizzes.filter((quiz) => teacherCourseIds.has(quiz.courseId)),
      questions: store.questions.filter((question) => visibleQuizIds.has(question.quizId)),
      quizAttempts: store.quizAttempts.filter((attempt) => visibleStudentIds.has(attempt.studentId) && visibleQuizIds.has(attempt.quizId)),
      assignments: store.assignments.filter((assignment) => teacherCourseIds.has(assignment.courseId)),
      submissions: store.submissions.filter((submission) => visibleStudentIds.has(submission.studentId) && visibleAssignmentIds.has(submission.assignmentId)),
      attendanceSessions: (store.attendanceSessions || []).filter((session) => visibleSessionIds.has(session.id)),
      sessionMaterials: (store.sessionMaterials || []).filter((material) => visibleSessionIds.has(material.sessionId)),
      attendanceRecords: (store.attendanceRecords || []).filter((record) => visibleSessionIds.has(record.sessionId) && visibleStudentIds.has(record.studentId)),
      notifications: (store.notifications || []).filter((item) => item.userId === user.id),
      courseSections: (store.courseSections || []).filter((section) => mySections.has(section.id)),
      courseRegistrations: (store.courseRegistrations || []).filter((registration) => visibleStudentIds.has(registration.studentId) || mySections.has(registration.sectionId)),
      teacherAttendance: (store.teacherAttendance || []).filter((ta) => ta.teacherId === user.id),
      certificates: (store.certificates || []).filter((cert) => teacherCourseIds.has(cert.courseId)),
      forumPosts: (store.forumPosts || []).filter((post) => teacherCourseIds.has(post.courseId) && (!post.sectionId || mySections.has(post.sectionId)))
    };
  }
  if (user.role === "student") {
    const myEnrollments = store.enrollments.filter((item) => item.studentId === user.id);
    const myCourseIds = new Set(myEnrollments.map((item) => item.courseId));
    const activeCourseIds = new Set(myEnrollments.filter((item) => item.status === "active" || item.status === "completed").map((item) => item.courseId));
    const publicCourseIds = new Set(store.courses.filter((course) => course.status === "published").map((course) => course.id));
    const visibleCourseIds = /* @__PURE__ */ new Set([...publicCourseIds, ...myCourseIds]);
    const visibleQuizzes = store.quizzes.filter((quiz) => activeCourseIds.has(quiz.courseId));
    const visibleQuizIds = new Set(visibleQuizzes.map((quiz) => quiz.id));
    const visibleAssignmentIds = new Set(store.assignments.filter((assignment) => activeCourseIds.has(assignment.courseId)).map((assignment) => assignment.id));
    const myRegisteredSections = new Set(
      (store.courseRegistrations || []).filter((cr) => cr.studentId === user.id && cr.status === "registered").map((cr) => cr.sectionId)
    );
    const visibleSessionIds = new Set((store.attendanceSessions || []).filter((session) => activeCourseIds.has(session.courseId) && (!session.sectionId || myRegisteredSections.has(session.sectionId))).map((session) => session.id));
    const visibleTeacherIds = new Set(store.courses.filter((course) => visibleCourseIds.has(course.id)).map((course) => course.teacherId));
    return {
      ...baseScopedStore(),
      users: store.users.filter((item) => item.id === user.id || visibleTeacherIds.has(item.id)).map(safeUser),
      courses: store.courses.filter((course) => visibleCourseIds.has(course.id)),
      lessons: store.lessons.filter((lesson) => visibleCourseIds.has(lesson.courseId)).map((lesson) => activeCourseIds.has(lesson.courseId) ? lesson : sanitizeLessonPreview(lesson)),
      enrollments: myEnrollments,
      lessonProgress: store.lessonProgress.filter((item) => myEnrollments.some((enroll) => enroll.id === item.enrollmentId)),
      quizzes: visibleQuizzes,
      questions: store.questions.filter((question) => visibleQuizIds.has(question.quizId)).map(sanitizeQuestion),
      quizAttempts: store.quizAttempts.filter((item) => item.studentId === user.id),
      submissions: store.submissions.filter((item) => item.studentId === user.id),
      assignments: store.assignments.filter((item) => visibleAssignmentIds.has(item.id)),
      attendanceSessions: (store.attendanceSessions || []).filter((session) => visibleSessionIds.has(session.id)).map(sanitizeAttendanceSession),
      sessionMaterials: (store.sessionMaterials || []).filter((material) => visibleSessionIds.has(material.sessionId)),
      attendanceRecords: (store.attendanceRecords || []).filter((record) => record.studentId === user.id),
      notifications: store.notifications.filter((item) => item.userId === user.id),
      transactions: (store.transactions || []).filter((item) => item.studentId === user.id),
      // Every open class is listed for registration, but meeting/group links only reach learners placed in that class.
      courseSections: (store.courseSections || []).filter((section) => visibleCourseIds.has(section.courseId) || myRegisteredSections.has(section.id)).map((section) => myRegisteredSections.has(section.id) ? section : { ...section, meetingUrl: void 0, groupChatUrl: void 0 }),
      courseRegistrations: (store.courseRegistrations || []).filter((item) => item.studentId === user.id),
      teacherAttendance: (store.teacherAttendance || []).filter((item) => activeCourseIds.has(item.courseId) && (!item.sectionId || myRegisteredSections.has(item.sectionId))),
      certificates: (store.certificates || []).filter((cert) => cert.studentId === user.id),
      forumPosts: (store.forumPosts || []).filter((post) => myCourseIds.has(post.courseId) && (!post.sectionId || myRegisteredSections.has(post.sectionId)))
    };
  }
  return {
    ...baseScopedStore(),
    users: store.users.filter((item) => item.id === user.id).map(safeUser)
  };
}

// src/server/eventBus.ts
var EventBus = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  on(event, handler2) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler2);
  }
  async emit(event, payload, pool2) {
    try {
      const eventId = generateId2("evt");
      const triggeredAt = (/* @__PURE__ */ new Date()).toISOString();
      const payloadJson = JSON.stringify(payload || {});
      await pool2.query(
        `INSERT INTO system_events (id, type, payload, triggered_at, processed)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventId, event, payloadJson, triggeredAt, false]
      );
    } catch (err) {
      console.error(`[EventBus] Failed to log system event "${event}" to DB:`, err);
    }
    const handlers = this.listeners.get(event) || [];
    for (const handler2 of handlers) {
      try {
        await handler2(payload, pool2);
      } catch (err) {
        console.error(`[EventBus] Handler error for "${event}":`, err);
      }
    }
  }
};
var eventBus = new EventBus();

// src/server/repositories/courseRegistrations.ts
var scheduleDateOnly = (slot) => {
  const value = slot?.specificDate || slot?.specific_date;
  return value ? String(value).slice(0, 10) : "";
};
var scheduleDay = (slot) => String(slot?.dayOfWeek || slot?.day_of_week || "").toLowerCase();
var schedulesCanOverlap = (targetSlot, existingSlot) => {
  const targetDate = scheduleDateOnly(targetSlot);
  const existingDate = scheduleDateOnly(existingSlot);
  if (targetDate && existingDate) return targetDate === existingDate;
  const targetDay = scheduleDay(targetSlot);
  const existingDay = scheduleDay(existingSlot);
  return Boolean(targetDay && existingDay && targetDay === existingDay);
};
var DEFAULT_REGISTRATION_CREDITS = 3;
var courseRegistrationsRepository = {
  async register(db, studentId, sectionId) {
    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");
      const section = (await client2.query("SELECT * FROM course_sections WHERE id = $1 FOR UPDATE", [sectionId])).rows[0];
      if (!section) {
        await client2.query("ROLLBACK");
        return { error: "Section not found.", status: 404 };
      }
      if (section.status !== "open") {
        await client2.query("ROLLBACK");
        return { error: "L\u1EDBp h\u1ECDc ph\u1EA7n n\xE0y hi\u1EC7n kh\xF4ng \u1EDF tr\u1EA1ng th\xE1i m\u1EDF \u0111\u0103ng k\xFD.", status: 403 };
      }
      const course = (await client2.query("SELECT price FROM courses WHERE id = $1", [section.course_id])).rows[0];
      if (Number(course?.price || 0) > 0) {
        const activeEnrollment = (await client2.query(
          "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
          [studentId, section.course_id]
        )).rows[0];
        if (!activeEnrollment) {
          await client2.query("ROLLBACK");
          return { error: "Payment confirmation and admin class placement are required before joining this paid class.", status: 403 };
        }
      }
      const existing = (await client2.query(
        "SELECT * FROM course_registrations WHERE student_id = $1 AND section_id = $2 AND status IN ('registered', 'waitlisted')",
        [studentId, sectionId]
      )).rows[0];
      if (existing) {
        await client2.query("ROLLBACK");
        return { error: "Student is already registered or waitlisted for this section.", status: 409 };
      }
      const targetSchedule = parseSchedule(section);
      const currentRegs = (await client2.query(
        `SELECT cs.* 
         FROM course_registrations cr
         JOIN course_sections cs ON cr.section_id = cs.id
         WHERE cr.student_id = $1 AND cr.status = 'registered'`,
        [studentId]
      )).rows;
      const existingSchedules = currentRegs.flatMap((r) => parseSchedule(r));
      const timeToMinutes2 = (timeStr) => {
        const [hrs, mins] = timeStr.split(":").map(Number);
        return hrs * 60 + mins;
      };
      let hasConflict = false;
      for (const t of targetSchedule) {
        for (const e of existingSchedules) {
          if (schedulesCanOverlap(t, e)) {
            const tStart = timeToMinutes2(t.startTime || t.start_time);
            const tEnd = timeToMinutes2(t.endTime || t.end_time);
            const eStart = timeToMinutes2(e.startTime || e.start_time);
            const eEnd = timeToMinutes2(e.endTime || e.end_time);
            if (Math.max(tStart, eStart) < Math.min(tEnd, eEnd)) {
              hasConflict = true;
              break;
            }
          }
        }
        if (hasConflict) break;
      }
      if (hasConflict) {
        await client2.query("ROLLBACK");
        return { error: "Schedule conflict detected", status: 409 };
      }
      const count = Number((await client2.query(
        "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
        [sectionId]
      )).rows[0].count);
      const status = count >= Number(section.max_students) ? "waitlisted" : "registered";
      const credits = DEFAULT_REGISTRATION_CREDITS;
      const row = (await client2.query(
        `INSERT INTO course_registrations (id, student_id, section_id, status, registered_at, credits, is_retake)
         VALUES ($1,$2,$3,$4,$5,$6,false)
         RETURNING *`,
        [generateId2("reg"), studentId, sectionId, status, (/* @__PURE__ */ new Date()).toISOString(), credits]
      )).rows[0];
      await client2.query("COMMIT");
      await notifyUsers(db, [section.teacher_id], { type: "info", message: `H\u1ECDc vi\xEAn \u0111\xE3 \u0111\u0103ng k\xFD v\xE0o l\u1EDBp h\u1ECDc ph\u1EA7n ${section.section_code}.`, relatedEntityType: "course_registration", relatedEntityId: row.id });
      return { row };
    } catch (error) {
      await client2.query("ROLLBACK");
      throw error;
    } finally {
      client2.release();
    }
  },
  async drop(db, registrationId, studentId) {
    const reg = (await db.query(
      `SELECT cr.*, cs.teacher_id
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.id = $1 AND cr.student_id = $2`,
      [registrationId, studentId]
    )).rows[0];
    if (!reg) return null;
    const registeredTime = new Date(reg.registered_at).getTime();
    const dropDeadline = registeredTime + 14 * 24 * 60 * 60 * 1e3;
    const nextStatus = Date.now() <= dropDeadline ? "dropped" : "withdrawn";
    const grade = nextStatus === "withdrawn" ? "W" : null;
    const row = (await db.query(
      "UPDATE course_registrations SET status = $2, dropped_at = $3, grade = COALESCE($4, grade), letter_grade = COALESCE($4, letter_grade) WHERE id = $1 RETURNING *",
      [registrationId, nextStatus, (/* @__PURE__ */ new Date()).toISOString(), grade]
    )).rows[0];
    const promoted = (await db.query(
      `UPDATE course_registrations
       SET status = 'registered'
       WHERE id = (
         SELECT id FROM course_registrations
         WHERE section_id = $1 AND status = 'waitlisted'
         ORDER BY registered_at ASC
         LIMIT 1
       )
       RETURNING *`,
      [reg.section_id]
    )).rows[0];
    if (promoted) await notifyStudent(db, promoted.student_id, "B\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c chuy\u1EC3n t\u1EEB danh s\xE1ch ch\u1EDD sang \u0111\u0103ng k\xFD ch\xEDnh th\u1EE9c th\xE0nh c\xF4ng.", { relatedEntityType: "course_registration", relatedEntityId: promoted.id });
    await notifyUsers(db, [reg.teacher_id], { type: "info", message: "M\u1ED9t h\u1ECDc vi\xEAn \u0111\xE3 h\u1EE7y \u0111\u0103ng k\xFD ho\u1EB7c r\xFAt lui kh\u1ECFi l\u1EDBp h\u1ECDc ph\u1EA7n c\u1EE7a b\u1EA1n.", relatedEntityType: "course_registration", relatedEntityId: registrationId });
    await eventBus.emit("registration.dropped", { registrationId, studentId, status: nextStatus }, pool);
    return row;
  }
};

// src/server/repositories/attendance.ts
var attendanceRepository = {
  async createSession(db, session) {
    const columns = (await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_sessions' AND column_name IN ('date', 'session_date', 'section_id', 'video_url', 'recording_url', 'content')"
    )).rows.map((row) => row.column_name);
    const sessionDateOnly = session.date.slice(0, 10);
    if (columns.includes("session_date") && columns.includes("date")) {
      await db.query(
        `INSERT INTO attendance_sessions (id, course_id, teacher_id, session_date, date, topic)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [session.id, session.courseId, session.teacherId, sessionDateOnly, session.date, session.topic]
      );
    } else if (columns.includes("session_date")) {
      await db.query(
        "INSERT INTO attendance_sessions (id, course_id, teacher_id, session_date, topic) VALUES ($1,$2,$3,$4,$5)",
        [session.id, session.courseId, session.teacherId, sessionDateOnly, session.topic]
      );
    } else {
      await db.query(
        "INSERT INTO attendance_sessions (id, course_id, teacher_id, date, topic) VALUES ($1,$2,$3,$4,$5)",
        [session.id, session.courseId, session.teacherId, session.date, session.topic]
      );
    }
    if (columns.includes("section_id") && session.sectionId) {
      await db.query("UPDATE attendance_sessions SET section_id = $1 WHERE id = $2", [session.sectionId, session.id]);
    }
    if (columns.includes("video_url") && session.videoUrl !== void 0) {
      await db.query("UPDATE attendance_sessions SET video_url = $1 WHERE id = $2", [session.videoUrl || null, session.id]);
    }
    if (columns.includes("recording_url") && session.recordingUrl !== void 0) {
      await db.query("UPDATE attendance_sessions SET recording_url = $1 WHERE id = $2", [session.recordingUrl || null, session.id]);
    }
    if (columns.includes("content") && session.content !== void 0) {
      await db.query("UPDATE attendance_sessions SET content = $1 WHERE id = $2", [session.content || null, session.id]);
    }
    return session;
  },
  async bulkMarkRecords(db, records) {
    for (const r of records) {
      await db.query(
        `INSERT INTO attendance_records (id, session_id, student_id, status, note, checked_in_at, checkin_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           note = EXCLUDED.note,
           checked_in_at = COALESCE(EXCLUDED.checked_in_at, attendance_records.checked_in_at),
           checkin_method = COALESCE(EXCLUDED.checkin_method, attendance_records.checkin_method)`,
        [r.id, r.sessionId, r.studentId, r.status, r.note || null, r.checkedInAt || null, r.checkinMethod || null]
      );
    }
    if (records.length) {
      const session = (await db.query("SELECT course_id FROM attendance_sessions WHERE id = $1", [records[0].sessionId])).rows[0];
      if (session) await eventBus.emit("attendance.session.saved", { sessionId: records[0].sessionId, courseId: session.course_id, records }, pool);
    }
  },
  async saveAttendanceSession(db, session, records) {
    await this.createSession(db, session);
    await this.bulkMarkRecords(db, records);
    return session;
  },
  async calcAttendancePercent(db, studentId, courseId2) {
    const sessionsRes = await db.query("SELECT id FROM attendance_sessions WHERE course_id = $1", [courseId2]);
    const sessionIds = sessionsRes.rows.map((row) => row.id);
    if (sessionIds.length === 0) return 100;
    const recordsRes = await db.query(
      "SELECT status FROM attendance_records WHERE student_id = $1 AND session_id = ANY($2)",
      [studentId, sessionIds]
    );
    const attended = recordsRes.rows.filter((r) => r.status === "present" || r.status === "late" || r.status === "excused").length;
    return Math.round(attended / sessionIds.length * 100);
  },
  async updateSession(db, id, input) {
    const columns = (await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_sessions' AND column_name IN ('date', 'session_date', 'video_url', 'recording_url', 'content')"
    )).rows.map((row2) => row2.column_name);
    const sets = [];
    const values = [];
    let paramIndex = 1;
    if (input.topic !== void 0) {
      sets.push(`topic = $${paramIndex++}`);
      values.push(input.topic);
    }
    if (input.date !== void 0) {
      sets.push(`date = $${paramIndex++}`);
      values.push(input.date);
      if (columns.includes("session_date")) {
        sets.push(`session_date = $${paramIndex++}`);
        values.push(input.date.slice(0, 10));
      }
    }
    if (input.videoUrl !== void 0 && columns.includes("video_url")) {
      sets.push(`video_url = $${paramIndex++}`);
      values.push(input.videoUrl || null);
    }
    if (input.recordingUrl !== void 0 && columns.includes("recording_url")) {
      sets.push(`recording_url = $${paramIndex++}`);
      values.push(input.recordingUrl || null);
    }
    if (input.content !== void 0 && columns.includes("content")) {
      sets.push(`content = $${paramIndex++}`);
      values.push(input.content || null);
    }
    if (sets.length > 0) {
      values.push(id);
      await db.query(
        `UPDATE attendance_sessions SET ${sets.join(", ")} WHERE id = $${paramIndex}`,
        values
      );
    }
    const row = (await db.query("SELECT * FROM attendance_sessions WHERE id = $1", [id])).rows[0];
    return row ? {
      id: row.id,
      courseId: row.course_id,
      sectionId: row.section_id || void 0,
      teacherId: row.teacher_id,
      date: row.date || row.session_date,
      topic: row.topic,
      videoUrl: row.video_url || void 0,
      recordingUrl: row.recording_url || void 0,
      content: row.content || void 0,
      code: row.code || void 0,
      expiresAt: row.expires_at || void 0
    } : null;
  }
};

// src/server/repositories/forum.ts
var forumRepository = {
  async createPost(db, input) {
    const post = {
      id: generateId2("post"),
      courseId: input.courseId,
      sectionId: input.sectionId,
      authorId: input.authorId,
      title: input.title,
      content: input.content,
      replies: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await db.query(
      `INSERT INTO forum_posts (id, course_id, section_id, author_id, title, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [post.id, post.courseId, post.sectionId || null, post.authorId, post.title, post.content, post.createdAt]
    );
    return post;
  },
  async createReply(db, input) {
    const reply = {
      id: generateId2("reply"),
      postId: input.postId,
      authorId: input.authorId,
      content: input.content,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await db.query(
      `INSERT INTO forum_replies (id, post_id, author_id, content, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [reply.id, reply.postId, reply.authorId, reply.content, reply.createdAt]
    );
    return reply;
  }
};

// src/server/repositories/sessionMaterials.ts
var sessionMaterialsRepository = {
  newId() {
    return generateId2("mat");
  },
  async listBySession(db, sessionId) {
    return (await db.query(
      "SELECT * FROM session_materials WHERE session_id = $1 ORDER BY sort_order, created_at",
      [sessionId]
    )).rows.map(sessionMaterialFromRow);
  },
  async listRowsBySession(db, sessionId) {
    return (await db.query(
      "SELECT * FROM session_materials WHERE session_id = $1 ORDER BY sort_order, created_at",
      [sessionId]
    )).rows;
  },
  /** Raw row including storage_path; server-side use only. */
  async findRowById(db, id) {
    return (await db.query("SELECT * FROM session_materials WHERE id = $1", [id])).rows[0] || null;
  },
  async create(db, input) {
    const row = (await db.query(
      `INSERT INTO session_materials (id, session_id, section_id, course_id, type, title, url, storage_path, file_name, mime_type, size_bytes, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM session_materials WHERE session_id = $2),
               $12)
       RETURNING *`,
      [
        input.id || generateId2("mat"),
        input.sessionId,
        input.sectionId || null,
        input.courseId,
        input.type,
        input.title,
        input.url || null,
        input.storagePath || null,
        input.fileName || null,
        input.mimeType || null,
        input.sizeBytes ?? null,
        input.createdBy || null
      ]
    )).rows[0];
    return sessionMaterialFromRow(row);
  },
  async update(db, id, input) {
    const row = (await db.query(
      "UPDATE session_materials SET title = COALESCE($1, title), url = COALESCE($2, url) WHERE id = $3 RETURNING *",
      [input.title ?? null, input.url ?? null, id]
    )).rows[0];
    return row ? sessionMaterialFromRow(row) : null;
  },
  async remove(db, id) {
    return (await db.query("DELETE FROM session_materials WHERE id = $1 RETURNING *", [id])).rows[0] || null;
  },
  async reorder(db, sessionId, orderedIds) {
    for (const [index, id] of orderedIds.entries()) {
      await db.query(
        "UPDATE session_materials SET sort_order = $1 WHERE id = $2 AND session_id = $3",
        [index + 1, id, sessionId]
      );
    }
    return this.listBySession(db, sessionId);
  },
  /** Storage objects of every uploaded file in a class, so they can be removed with the class. */
  async listStoragePathsForSection(db, sectionId) {
    return (await db.query(
      "SELECT storage_path FROM session_materials WHERE section_id = $1 AND storage_path IS NOT NULL",
      [sectionId]
    )).rows.map((row) => row.storage_path);
  }
};

// src/server/services/storage.ts
import fs4 from "fs";
import path4 from "path";
import os2 from "os";
import { createClient } from "@supabase/supabase-js";
var SIGNED_URL_TTL_SECONDS = 60;
var client = null;
var bucketVerified = false;
var tableEnsured = false;
async function ensureMaterialFilesTable() {
  if (tableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_files (
        storage_path TEXT PRIMARY KEY,
        file_data BYTEA NOT NULL,
        mime_type TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    tableEnsured = true;
  } catch (err) {
    console.warn("[Storage] Table creation notice:", err.message);
  }
}
function getClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  if (!client) {
    client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
function bucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || "lms-materials";
}
function getStorageRoot() {
  if (process.env.MATERIALS_DIR && !process.env.VERCEL) {
    return path4.resolve(process.env.MATERIALS_DIR);
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path4.join(os2.tmpdir(), "lms_materials");
  }
  return path4.resolve(process.env.MATERIALS_DIR || path4.join(process.cwd(), "storage", "materials"));
}
function localPathFor(objectPath) {
  const root = getStorageRoot();
  const resolved = path4.resolve(root, objectPath);
  if (!resolved.startsWith(root + path4.sep) && resolved !== root) {
    throw new Error("Invalid storage path.");
  }
  return resolved;
}
var materialStorage = {
  isRemote() {
    return Boolean(getClient());
  },
  async put(objectPath, body, contentType) {
    const supabase = getClient();
    if (supabase) {
      const bucketName = bucket();
      try {
        if (!bucketVerified) {
          const { data: buckets } = await supabase.storage.listBuckets();
          const exists = (buckets || []).some((b) => b.name === bucketName);
          if (!exists) {
            await supabase.storage.createBucket(bucketName, { public: false }).catch(() => void 0);
          }
          bucketVerified = true;
        }
        const { error } = await supabase.storage.from(bucketName).upload(objectPath, body, { contentType, upsert: true });
        if (!error) return;
        if (error.message?.toLowerCase().includes("not found") || error.statusCode === 404) {
          await supabase.storage.createBucket(bucketName, { public: false }).catch(() => void 0);
          const retry = await supabase.storage.from(bucketName).upload(objectPath, body, { contentType, upsert: true });
          if (!retry.error) return;
        }
        console.warn(`[Storage] Supabase upload failed: ${error.message}. Falling back to DB/local storage.`);
      } catch (supaErr) {
        console.warn(`[Storage] Supabase error: ${supaErr.message}. Falling back to DB/local storage.`);
      }
    }
    try {
      await ensureMaterialFilesTable();
      await pool.query(
        `INSERT INTO material_files (storage_path, file_data, mime_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (storage_path) DO UPDATE SET file_data = EXCLUDED.file_data, mime_type = EXCLUDED.mime_type`,
        [objectPath, body, contentType]
      );
    } catch (dbErr) {
      console.warn("[Storage] DB persistence notice:", dbErr.message);
    }
    try {
      const target = localPathFor(objectPath);
      await fs4.promises.mkdir(path4.dirname(target), { recursive: true });
      await fs4.promises.writeFile(target, body);
    } catch (fsErr) {
      console.warn("[Storage] Local filesystem write notice:", fsErr.message);
    }
  },
  async getDownload(objectPath, fileName, options) {
    const supabase = getClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.storage.from(bucket()).createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, options?.inline ? void 0 : { download: fileName });
        if (!error && data?.signedUrl) {
          return { kind: "redirect", url: data.signedUrl };
        }
      } catch (err) {
        console.warn("[Storage] Supabase download error:", err.message);
      }
    }
    try {
      await ensureMaterialFilesTable();
      const res = await pool.query("SELECT file_data, mime_type FROM material_files WHERE storage_path = $1", [objectPath]);
      if (res.rows[0]?.file_data) {
        return {
          kind: "buffer",
          buffer: Buffer.from(res.rows[0].file_data),
          mimeType: res.rows[0].mime_type || void 0
        };
      }
    } catch (dbErr) {
      console.warn("[Storage] DB retrieve error:", dbErr.message);
    }
    try {
      const localPath = localPathFor(objectPath);
      if (fs4.existsSync(localPath)) {
        return { kind: "local", absolutePath: localPath };
      }
    } catch {
    }
    return { kind: "local", absolutePath: localPathFor(objectPath) };
  },
  async remove(objectPaths) {
    if (objectPaths.length === 0) return;
    const supabase = getClient();
    if (supabase) {
      try {
        await supabase.storage.from(bucket()).remove(objectPaths);
      } catch {
      }
    }
    try {
      await pool.query("DELETE FROM material_files WHERE storage_path = ANY($1)", [objectPaths]);
    } catch {
    }
    for (const objectPath of objectPaths) {
      try {
        await fs4.promises.rm(localPathFor(objectPath), { force: true });
      } catch {
      }
    }
  }
};

// src/server/crm/signature.ts
import crypto2 from "crypto";
function signCrmPayload(secret, timestamp, body) {
  return crypto2.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}
function verifyCrmSignature(secret, timestampHeader, signatureHeader, rawBody, toleranceSeconds) {
  if (!timestampHeader || !signatureHeader) {
    return { status: 401, error: "Missing timestamp or signature header." };
  }
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return { status: 400, error: "Timestamp header must be Unix time in seconds." };
  if (Math.abs(Date.now() / 1e3 - timestamp) > toleranceSeconds) {
    return { status: 401, error: "Request timestamp is outside the allowed window." };
  }
  const expected = Buffer.from(signCrmPayload(secret, timestampHeader, rawBody), "utf8");
  const received = Buffer.from(signatureHeader.startsWith("sha256=") ? signatureHeader.slice("sha256=".length) : signatureHeader, "utf8");
  if (expected.length !== received.length || !crypto2.timingSafeEqual(expected, received)) {
    return { status: 401, error: "Invalid request signature." };
  }
  return null;
}

// src/server/crm/crmOutbox.ts
var MAX_ATTEMPTS = 10;
var BATCH_SIZE = 20;
var DELIVERY_TIMEOUT_MS = 1e4;
async function enqueueCrmEvent(db, type, data, origin = "lms") {
  const id = generateId2("crmevt");
  const payload = { id, type, origin, occurredAt: (/* @__PURE__ */ new Date()).toISOString(), data };
  await db.query(
    "INSERT INTO crm_outbox (id, event_type, payload, created_at) VALUES ($1, $2, $3, clock_timestamp())",
    [id, type, JSON.stringify(payload)]
  );
  setTimeout(() => {
    void deliverPendingCrmEvents().catch((err) => {
      console.warn("[crm-outbox] opportunistic delivery error:", err?.message || err);
    });
  }, 500);
  return id;
}
async function buildEnrollmentEventData(db, enrollmentId) {
  const row = (await db.query(
    `SELECT e.id, e.status, e.enrolled_at, e.crm_deal_id, e.requested_section_id,
            u.id AS student_id, u.name AS student_name, u.email AS student_email, u.phone AS student_phone, u.crm_contact_id,
            c.id AS course_id, c.title AS course_title, COALESCE(c.price, 0) AS course_price,
            rs.section_code AS requested_section_code,
            placed.section_id AS placed_section_id, ps.section_code AS placed_section_code
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN course_sections rs ON rs.id = e.requested_section_id
     LEFT JOIN LATERAL (
       SELECT cr.section_id
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.student_id = e.student_id AND cs.course_id = e.course_id AND cr.status = 'registered'
       ORDER BY cr.registered_at DESC
       LIMIT 1
     ) placed ON true
     LEFT JOIN course_sections ps ON ps.id = placed.section_id
     WHERE e.id = $1`,
    [enrollmentId]
  )).rows[0];
  if (!row) return null;
  const payment = (await db.query(
    `SELECT id, amount, status
     FROM transactions
     WHERE student_id = $1 AND course_id = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [row.student_id, row.course_id]
  )).rows[0];
  return {
    enrollmentId: row.id,
    status: row.status,
    enrolledAt: row.enrolled_at,
    crmDealId: row.crm_deal_id || null,
    student: {
      lmsUserId: row.student_id,
      name: row.student_name,
      email: row.student_email,
      phone: row.student_phone || null,
      crmContactId: row.crm_contact_id || null
    },
    course: { id: row.course_id, title: row.course_title, price: Number(row.course_price) },
    requestedSection: row.requested_section_id ? { id: row.requested_section_id, code: row.requested_section_code } : null,
    placedSection: row.placed_section_id ? { id: row.placed_section_id, code: row.placed_section_code } : null,
    payment: payment ? { transactionId: payment.id, amount: Number(payment.amount), status: payment.status } : null
  };
}
async function enqueueEnrollmentEvent(db, type, enrollmentId, origin = "lms") {
  const data = await buildEnrollmentEventData(db, enrollmentId);
  if (data) await enqueueCrmEvent(db, type, data, origin);
}
async function enqueueCertificateIssuedEvent(db, certificateId, origin = "lms") {
  const row = (await db.query(
    `SELECT cert.id, cert.certificate_code, cert.issued_at,
            u.id AS student_id, u.name AS student_name, u.email AS student_email, u.phone AS student_phone,
            u.crm_contact_id, c.id AS course_id, c.title AS course_title
     FROM certificates cert
     JOIN users u ON u.id = cert.student_id
     JOIN courses c ON c.id = cert.course_id
     WHERE cert.id = $1`,
    [certificateId]
  )).rows[0];
  if (!row) return null;
  return enqueueCrmEvent(db, "certificate.issued", {
    certificateId: row.id,
    certificateCode: row.certificate_code,
    issuedAt: row.issued_at,
    student: {
      lmsUserId: row.student_id,
      name: row.student_name,
      email: row.student_email,
      phone: row.student_phone || null,
      crmContactId: row.crm_contact_id || null
    },
    course: { id: row.course_id, title: row.course_title }
  }, origin);
}
async function enqueueCourseCompletedEvent(db, enrollmentId, origin = "lms") {
  const data = await buildEnrollmentEventData(db, enrollmentId);
  if (!data) return null;
  return enqueueCrmEvent(db, "course.completed", {
    ...data,
    completedAt: (/* @__PURE__ */ new Date()).toISOString()
  }, origin);
}
var retryDelaySeconds = (attempt) => Math.min(60 * 2 ** (attempt - 1), 6 * 60 * 60);
var delivering = false;
async function deliverPendingCrmEvents() {
  const url = process.env.CRM_WEBHOOK_URL;
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (!url || !secret || delivering) return { sent: 0, failed: 0 };
  delivering = true;
  let sent = 0;
  let failed = 0;
  try {
    const rows = (await pool.query(
      `WITH leased AS (
         UPDATE crm_outbox
         SET next_attempt_at = NOW() + INTERVAL '5 minutes'
         WHERE id IN (
           SELECT id FROM crm_outbox
           WHERE status = 'pending' AND next_attempt_at <= NOW()
           ORDER BY created_at
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *
       )
       SELECT * FROM leased ORDER BY created_at, id`,
      [BATCH_SIZE]
    )).rows;
    for (const row of rows) {
      const body = JSON.stringify(row.payload);
      const timestamp = String(Math.floor(Date.now() / 1e3));
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-LMS-Event": row.event_type,
            "X-LMS-Event-Id": row.id,
            "X-LMS-Timestamp": timestamp,
            "X-LMS-Signature": `sha256=${signCrmPayload(secret, timestamp, body)}`
          },
          body,
          signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS)
        });
        if (!response.ok) throw new Error(`CRM responded with HTTP ${response.status}`);
        await pool.query(
          "UPDATE crm_outbox SET status = 'sent', attempts = attempts + 1, sent_at = NOW(), last_error = NULL WHERE id = $1",
          [row.id]
        );
        sent++;
      } catch (error) {
        const attempts = Number(row.attempts) + 1;
        const giveUp = attempts >= MAX_ATTEMPTS;
        await pool.query(
          `UPDATE crm_outbox
           SET attempts = $2, status = $3, last_error = $4, next_attempt_at = NOW() + ($5::text || ' seconds')::interval
           WHERE id = $1`,
          [row.id, attempts, giveUp ? "failed" : "pending", String(error?.message || error).slice(0, 1e3), String(retryDelaySeconds(attempts))]
        );
        if (giveUp) console.error(`[crm-outbox] giving up on ${row.event_type} ${row.id} after ${attempts} attempts:`, error);
        failed++;
      }
    }
  } finally {
    delivering = false;
  }
  return { sent, failed };
}

// src/server/repositories/sections.ts
var scheduleDateOnly2 = (slot) => {
  const value = slot?.specificDate || slot?.specific_date;
  return value ? String(value).slice(0, 10) : "";
};
var scheduleDay2 = (slot) => String(slot?.dayOfWeek || slot?.day_of_week || "").toLowerCase();
var schedulesCanOverlap2 = (targetSlot, existingSlot) => {
  const targetDate = scheduleDateOnly2(targetSlot);
  const existingDate = scheduleDateOnly2(existingSlot);
  if (targetDate && existingDate) return targetDate === existingDate;
  const targetDay = scheduleDay2(targetSlot);
  const existingDay = scheduleDay2(existingSlot);
  return Boolean(targetDay && existingDay && targetDay === existingDay);
};
var sectionsRepository = {
  async createSection(db, section) {
    await db.query(
      `INSERT INTO course_sections (id, course_id, teacher_id, section_code, max_students, schedule, status, opening_date, number_of_sessions, meeting_url, group_chat_url)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)`,
      [section.id, section.courseId, section.teacherId, section.sectionCode, section.maxStudents, JSON.stringify(section.schedule), section.status, section.openingDate || null, section.numberOfSessions || null, section.meetingUrl || null, section.groupChatUrl || null]
    );
    return section;
  },
  async listSections(db, courseId2) {
    const res = courseId2 ? await db.query("SELECT * FROM course_sections WHERE course_id = $1", [courseId2]) : await db.query("SELECT * FROM course_sections");
    return res.rows.map(courseSectionFromRow);
  },
  async registerToSection(db, reg) {
    await db.query(
      `INSERT INTO course_registrations (id, student_id, section_id, status, registered_at, dropped_at, grade, letter_grade, grade_point, credits, is_retake)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [reg.id, reg.studentId, reg.sectionId, reg.status, reg.registeredAt, reg.droppedAt || null, reg.grade || null, reg.letterGrade || null, reg.gradePoint ?? null, reg.credits, reg.isRetake || false]
    );
    return reg;
  },
  async conflictCheck(db, studentId, sectionId) {
    const targetRes = await db.query("SELECT * FROM course_sections WHERE id = $1", [sectionId]);
    if (!targetRes.rows[0]) return false;
    const targetRow = targetRes.rows[0];
    const targetSchedule = parseSchedule(targetRow);
    const currentRegs = await db.query(
      `SELECT cs.* 
       FROM course_registrations cr
       JOIN course_sections cs ON cr.section_id = cs.id
       WHERE cr.student_id = $1 AND cr.status NOT IN ('dropped', 'waitlisted', 'withdrawn')`,
      [studentId]
    );
    const existingSchedules = currentRegs.rows.flatMap((r) => {
      return parseSchedule(r);
    });
    for (const t of targetSchedule) {
      for (const e of existingSchedules) {
        if (schedulesCanOverlap2(t, e)) {
          const tStart = this.timeToMinutes(t.startTime);
          const tEnd = this.timeToMinutes(t.endTime);
          const eStart = this.timeToMinutes(e.startTime);
          const eEnd = this.timeToMinutes(e.endTime);
          if (Math.max(tStart, eStart) < Math.min(tEnd, eEnd)) {
            return true;
          }
        }
      }
    }
    return false;
  },
  async promoteWaitlist(db, sectionId) {
    const secRes = await db.query("SELECT max_students FROM course_sections WHERE id = $1", [sectionId]);
    if (!secRes.rows[0]) return;
    const cap = secRes.rows[0].max_students;
    const countRes = await db.query("SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'", [sectionId]);
    const enrolled = Number(countRes.rows[0].count);
    if (enrolled < cap) {
      const wlRes = await db.query(
        "SELECT id FROM course_registrations WHERE section_id = $1 AND status = 'waitlisted' ORDER BY registered_at ASC LIMIT 1",
        [sectionId]
      );
      if (wlRes.rows[0]) {
        await db.query("UPDATE course_registrations SET status = 'registered' WHERE id = $1", [wlRes.rows[0].id]);
      }
    }
  },
  timeToMinutes(timeStr) {
    const [hrs, mins] = timeStr.split(":").map(Number);
    return hrs * 60 + mins;
  }
};

// src/server/services/enrollmentService.ts
var DEFAULT_REGISTRATION_CREDITS2 = 3;
var isServiceError = (value) => Boolean(value && typeof value === "object" && "error" in value && "status" in value);
async function requestEnrollment(input) {
  const course = await coursesRepository.findById(pool, input.courseId);
  if (!course || course.status !== "published") return { error: "Published course not found.", status: 404 };
  if (await enrollmentsRepository.existsForCourse(pool, input.studentId, course.id)) {
    return { error: "Enrollment already exists.", status: 409 };
  }
  const price = Number(course.price || 0);
  const isPaid = price > 0;
  let section = null;
  if (input.sectionId) {
    section = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [input.sectionId])).rows[0];
    if (!section) return { error: "Selected class section not found.", status: 404 };
    if (section.course_id !== course.id) return { error: "Selected section does not belong to this course.", status: 400 };
    if (section.status !== "open") return { error: "L\u1EDBp h\u1ECDc n\xE0y hi\u1EC7n kh\xF4ng m\u1EDF \u0111\u0103ng k\xFD.", status: 400 };
    const registered = Number((await pool.query(
      "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
      [section.id]
    )).rows[0].count);
    if (registered >= Number(section.max_students)) {
      return { error: "L\u1EDBp h\u1ECDc ph\u1EA7n n\xE0y \u0111\xE3 \u0111\u1EA1t s\u0129 s\u1ED1 t\u1ED1i \u0111a. Vui l\xF2ng ch\u1ECDn l\u1EDBp kh\xE1c.", status: 400 };
    }
    if (await sectionsRepository.conflictCheck(pool, input.studentId, section.id)) {
      return { error: "L\u1EDBp h\u1ECDc ph\u1EA7n n\xE0y b\u1ECB tr\xF9ng l\u1ECBch h\u1ECDc v\u1EDBi c\xE1c l\u1EDBp kh\xE1c b\u1EA1n \u0111\xE3 \u0111\u0103ng k\xFD.", status: 400 };
    }
  }
  const client2 = await pool.connect();
  try {
    await client2.query("BEGIN");
    const enrollment = await enrollmentsRepository.register(client2, input.studentId, course.id, isPaid, {
      requestedSectionId: section?.id,
      crmDealId: input.crmDealId
    });
    let transactionId;
    if (isPaid) {
      transactionId = generateId2("tx");
      await client2.query(
        `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6)`,
        [
          transactionId,
          input.studentId,
          course.id,
          price,
          input.origin === "crm" ? "CRM MCNA" : "Chuy\u1EC3n kho\u1EA3n Ng\xE2n h\xE0ng (QR)",
          (/* @__PURE__ */ new Date()).toISOString()
        ]
      );
    }
    let registrationId;
    if (section && !isPaid) {
      registrationId = generateId2("reg");
      await client2.query(
        `INSERT INTO course_registrations (id, student_id, section_id, status, registered_at, credits, is_retake)
         VALUES ($1, $2, $3, 'waitlisted', $4, $5, false)`,
        [registrationId, input.studentId, section.id, (/* @__PURE__ */ new Date()).toISOString(), DEFAULT_REGISTRATION_CREDITS2]
      );
    }
    await enqueueEnrollmentEvent(client2, "enrollment.requested", enrollment.id, input.origin);
    await client2.query("COMMIT");
    return {
      enrollment,
      course: { id: course.id, title: course.title, price },
      section: section ? { id: section.id, sectionCode: section.section_code } : null,
      transactionId,
      registrationId
    };
  } catch (error) {
    await client2.query("ROLLBACK");
    if (error?.code === "23505") return { error: "Enrollment already exists.", status: 409 };
    throw error;
  } finally {
    client2.release();
  }
}
async function hasConfirmedPaymentForCoursePlacement(db, studentId, courseId2) {
  const course = (await db.query("SELECT price FROM courses WHERE id = $1", [courseId2])).rows[0];
  if (!course) return false;
  if (Number(course.price || 0) <= 0) return true;
  const approvedPayment = (await db.query(
    `SELECT id
     FROM transactions
     WHERE student_id = $1
       AND course_id = $2
       AND status = 'approved'
     LIMIT 1`,
    [studentId, courseId2]
  )).rows[0];
  return Boolean(approvedPayment);
}
async function placeEnrollment(client2, enrollmentId, sectionId, origin) {
  const enrollmentRow = (await client2.query("SELECT * FROM enrollments WHERE id = $1 FOR UPDATE", [enrollmentId])).rows[0];
  if (!enrollmentRow) return { error: "Enrollment not found.", status: 404 };
  if (!await hasConfirmedPaymentForCoursePlacement(client2, enrollmentRow.student_id, enrollmentRow.course_id)) {
    return { error: "Payment must be confirmed before class placement.", status: 400 };
  }
  const enrollment = (await client2.query(
    "UPDATE enrollments SET status = 'active' WHERE id = $1 RETURNING *",
    [enrollmentId]
  )).rows[0];
  let registration = null;
  if (sectionId) {
    const section = (await client2.query("SELECT * FROM course_sections WHERE id = $1 FOR UPDATE", [sectionId])).rows[0];
    if (!section) return { error: "Course section not found.", status: 404 };
    if (section.course_id !== enrollment.course_id) return { error: "Selected section does not belong to this course.", status: 400 };
    const count = Number((await client2.query(
      "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
      [sectionId]
    )).rows[0].count);
    if (count >= section.max_students) {
      return { error: "L\u1EDBp h\u1ECDc ph\u1EA7n n\xE0y \u0111\xE3 \u0111\u1EA1t s\u0129 s\u1ED1 t\u1ED1i \u0111a. Kh\xF4ng th\u1EC3 x\u1EBFp th\xEAm h\u1ECDc vi\xEAn.", status: 400 };
    }
    const existingRegistration = (await client2.query(
      `SELECT cr.id, cr.status
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.student_id = $1
         AND cs.course_id = $2
         AND cr.status IN ('registered', 'waitlisted')`,
      [enrollment.student_id, enrollment.course_id]
    )).rows[0];
    if (!existingRegistration) {
      registration = (await client2.query(
        `INSERT INTO course_registrations (id, student_id, section_id, status, registered_at, credits, is_retake)
         VALUES ($1, $2, $3, 'registered', $4, $5, false)
         RETURNING *`,
        [generateId2("reg"), enrollment.student_id, sectionId, (/* @__PURE__ */ new Date()).toISOString(), DEFAULT_REGISTRATION_CREDITS2]
      )).rows[0];
    } else {
      registration = (await client2.query(
        "UPDATE course_registrations SET section_id = $1, status = 'registered' WHERE id = $2 RETURNING *",
        [sectionId, existingRegistration.id]
      )).rows[0];
    }
  }
  await enqueueEnrollmentEvent(client2, "enrollment.status_changed", enrollmentId, origin);
  return { enrollment, registration };
}
async function confirmCoursePayment(client2, enrollmentId, input, origin) {
  const enrollment = (await client2.query(
    `SELECT e.*, COALESCE(c.price, 0) AS course_price
     FROM enrollments e
     JOIN courses c ON c.id = e.course_id
     WHERE e.id = $1
     FOR UPDATE OF e`,
    [enrollmentId]
  )).rows[0];
  if (!enrollment) return { error: "Enrollment not found.", status: 404 };
  if (enrollment.status === "cancelled") return { error: "Enrollment was cancelled.", status: 409 };
  if (Number(enrollment.course_price) <= 0) return { transactionId: null };
  const existing = (await client2.query(
    `SELECT id, status
     FROM transactions
     WHERE student_id = $1 AND course_id = $2 AND status IN ('approved', 'pending')
     ORDER BY (status = 'approved') DESC, created_at DESC
     LIMIT 1`,
    [enrollment.student_id, enrollment.course_id]
  )).rows[0];
  if (existing?.status === "approved") return { transactionId: existing.id };
  const note = `Payment confirmed via ${origin === "crm" ? "CRM MCNA" : "LMS"}${input.reference ? ` (ref: ${input.reference})` : ""}.`;
  let transactionId;
  if (existing) {
    const reviewed = await financeRepository.reviewTransaction(client2, existing.id, "approved", null, note);
    if (!reviewed) return { error: "Transaction not found.", status: 404 };
    if ("error" in reviewed) return { error: reviewed.error, status: reviewed.status };
    transactionId = existing.id;
  } else {
    transactionId = generateId2("tx");
    const paidAt = input.paidAt || (/* @__PURE__ */ new Date()).toISOString();
    await client2.query(
      `INSERT INTO transactions (id, student_id, course_id, amount, status, payment_method, created_at, processed_at, notes)
       VALUES ($1, $2, $3, $4, 'approved', $5, $6, $6, $7)`,
      [transactionId, enrollment.student_id, enrollment.course_id, input.amount ?? Number(enrollment.course_price), origin === "crm" ? "CRM MCNA" : "LMS", paidAt, note]
    );
    await client2.query("UPDATE enrollments SET status = 'pending' WHERE id = $1 AND status = 'pending_payment'", [enrollmentId]);
  }
  await enqueueEnrollmentEvent(client2, "enrollment.status_changed", enrollmentId, origin);
  return { transactionId };
}

// src/server/services/sepayService.ts
import crypto3 from "crypto";
function sha256Hex(input) {
  return crypto3.createHash("sha256").update(input).digest("hex");
}
function extractPaymentCodes(content, codeField) {
  const text = `${codeField || ""} ${content || ""}`.trim();
  const result = { rawKeywords: [] };
  if (!text) return result;
  const directTxMatch = text.match(/\b(tx_[a-f0-9]{6,16})\b/i);
  if (directTxMatch) {
    result.txIdFull = directTxMatch[1].toLowerCase();
    result.rawKeywords.push(result.txIdFull);
  }
  const mcnaTwoWordMatch = text.match(/MCNA\s*[:.\-_]?\s*([A-Za-z0-9]{4,12})\s+([A-Za-z0-9]{4,12})/i);
  if (mcnaTwoWordMatch) {
    result.studentHex = mcnaTwoWordMatch[1].toLowerCase();
    result.txHex = mcnaTwoWordMatch[2].toLowerCase();
    result.rawKeywords.push(result.studentHex, result.txHex);
    return result;
  }
  const mcnaCompactMatch = text.match(/MCNA\s*[:.\-_]?\s*([A-Fa-f0-9]{12})\b/i);
  if (mcnaCompactMatch) {
    result.studentHex = mcnaCompactMatch[1].slice(0, 6).toLowerCase();
    result.txHex = mcnaCompactMatch[1].slice(6, 12).toLowerCase();
    result.rawKeywords.push(result.studentHex, result.txHex);
    return result;
  }
  const mcnaSingleMatch = text.match(/MCNA\s*[:.\-_]?\s*([A-Za-z0-9_]{5,24})\b/i);
  if (mcnaSingleMatch) {
    const code = mcnaSingleMatch[1].toLowerCase();
    if (code.startsWith("tx_")) {
      result.txIdFull = code;
    } else if (/^[0-9]{9,11}$/.test(code)) {
      result.phone = code;
    } else if (code.includes("@")) {
      result.email = code;
    } else {
      result.txHex = code;
    }
    result.rawKeywords.push(code);
  }
  const phoneMatch = text.match(/\b(0[35789][0-9]{8})\b/);
  if (phoneMatch && !result.phone) {
    result.phone = phoneMatch[1];
  }
  const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (emailMatch && !result.email) {
    result.email = emailMatch[1].toLowerCase();
  }
  return result;
}
async function findMatchingPendingTransaction(db, info) {
  if (info.txIdFull) {
    const row = (await db.query(
      `SELECT t.id, t.student_id, t.course_id, t.amount, t.status,
              e.id AS enrollment_id, e.requested_section_id, e.status AS enrollment_status,
              c.title AS course_title
       FROM transactions t
       JOIN enrollments e ON e.student_id = t.student_id AND e.course_id = t.course_id
       JOIN courses c ON c.id = t.course_id
       WHERE t.status = 'pending' AND t.id ILIKE $1
       LIMIT 1`,
      [info.txIdFull]
    )).rows[0];
    if (row) return row;
  }
  if (info.studentHex && info.txHex) {
    const row = (await db.query(
      `SELECT t.id, t.student_id, t.course_id, t.amount, t.status,
              e.id AS enrollment_id, e.requested_section_id, e.status AS enrollment_status,
              c.title AS course_title
       FROM transactions t
       JOIN enrollments e ON e.student_id = t.student_id AND e.course_id = t.course_id
       JOIN courses c ON c.id = t.course_id
       WHERE t.status = 'pending'
         AND (
           (t.id ILIKE 'tx_' || $1 || '%' AND t.student_id ILIKE 'user_' || $2 || '%')
           OR (t.id ILIKE 'tx_' || $2 || '%' AND t.student_id ILIKE 'user_' || $1 || '%')
           OR (t.id ILIKE 'tx_' || $1 || '%')
           OR (t.id ILIKE 'tx_' || $2 || '%')
         )
       ORDER BY
         (t.id ILIKE 'tx_' || $1 || '%' AND t.student_id ILIKE 'user_' || $2 || '%') DESC,
         (t.id ILIKE 'tx_' || $2 || '%' AND t.student_id ILIKE 'user_' || $1 || '%') DESC,
         t.created_at DESC
       LIMIT 1`,
      [info.txHex, info.studentHex]
    )).rows[0];
    if (row) return row;
  }
  if (info.txHex) {
    const row = (await db.query(
      `SELECT t.id, t.student_id, t.course_id, t.amount, t.status,
              e.id AS enrollment_id, e.requested_section_id, e.status AS enrollment_status,
              c.title AS course_title
       FROM transactions t
       JOIN enrollments e ON e.student_id = t.student_id AND e.course_id = t.course_id
       JOIN courses c ON c.id = t.course_id
       WHERE t.status = 'pending'
         AND (t.id ILIKE 'tx_' || $1 || '%' OR t.id ILIKE $1)
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [info.txHex]
    )).rows[0];
    if (row) return row;
  }
  if (info.phone || info.email) {
    const row = (await db.query(
      `SELECT t.id, t.student_id, t.course_id, t.amount, t.status,
              e.id AS enrollment_id, e.requested_section_id, e.status AS enrollment_status,
              c.title AS course_title
       FROM transactions t
       JOIN users u ON u.id = t.student_id
       JOIN enrollments e ON e.student_id = t.student_id AND e.course_id = t.course_id
       JOIN courses c ON c.id = t.course_id
       WHERE t.status = 'pending'
         AND (
           ($1 <> '' AND u.phone = $1)
           OR ($2 <> '' AND u.email ILIKE $2)
         )
       ORDER BY t.created_at DESC
       LIMIT 1`,
      [info.phone || "", info.email || ""]
    )).rows[0];
    if (row) return row;
  }
  return null;
}
async function processSepayWebhook(payload, rawBody, onSuccessfulPayment) {
  if (payload.transferType && String(payload.transferType).toLowerCase() !== "in") {
    return {
      success: true,
      matched: false,
      message: "B\u1ECF qua giao d\u1ECBch ti\u1EC1n ra kh\u1ECFi t\xE0i kho\u1EA3n."
    };
  }
  const eventId = `sepay_${payload.id}`;
  const existingEvent = (await pool.query(
    "SELECT event_id, transaction_id, processing_status FROM payment_webhook_events WHERE event_id = $1",
    [eventId]
  )).rows[0];
  if (existingEvent && existingEvent.processing_status === "processed") {
    return {
      success: true,
      matched: true,
      duplicate: true,
      transactionId: existingEvent.transaction_id,
      message: "Giao d\u1ECBch SePay n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c h\u1EC7 th\u1ED1ng x\u1EED l\xFD th\xE0nh c\xF4ng tr\u01B0\u1EDBc \u0111\xF3."
    };
  }
  const info = extractPaymentCodes(payload.content, payload.code);
  const matchedTx = await findMatchingPendingTransaction(pool, info);
  if (!matchedTx) {
    return {
      success: true,
      matched: false,
      message: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n h\xE0ng h\u1ECDc ph\xED pending ph\xF9 h\u1EE3p v\u1EDBi n\u1ED9i dung chuy\u1EC3n kho\u1EA3n."
    };
  }
  const receivedAmount = Number(payload.transferAmount || 0);
  const requiredAmount = Number(matchedTx.amount || 0);
  if (receivedAmount < requiredAmount) {
    const diff = requiredAmount - receivedAmount;
    await pool.query(
      `UPDATE transactions
       SET notes = $2
       WHERE id = $1`,
      [
        matchedTx.id,
        `SePay: Nh\u1EADn ${receivedAmount.toLocaleString("vi-VN")} \u0111 (thi\u1EBFu ${diff.toLocaleString("vi-VN")} \u0111 so v\u1EDBi h\u1ECDc ph\xED ${requiredAmount.toLocaleString("vi-VN")} \u0111). GD #${payload.id}.`
      ]
    );
    await notificationsRepository.create(pool, {
      userId: matchedTx.student_id,
      type: "warning",
      message: `MCNA \u0111\xE3 nh\u1EADn ${receivedAmount.toLocaleString("vi-VN")} \u0111 h\u1ECDc ph\xED m\xF4n ${matchedTx.course_title}, nh\u01B0ng s\u1ED1 ti\u1EC1n quy \u0111\u1ECBnh l\xE0 ${requiredAmount.toLocaleString("vi-VN")} \u0111 (c\xF2n thi\u1EBFu ${diff.toLocaleString("vi-VN")} \u0111). Vui l\xF2ng chuy\u1EC3n b\u1ED5 sung \u0111\u1EC3 ho\xE0n t\u1EA5t k\xEDch ho\u1EA1t l\u1EDBp h\u1ECDc.`
    });
    return {
      success: true,
      matched: true,
      underpaid: true,
      transactionId: matchedTx.id,
      message: `Giao d\u1ECBch chuy\u1EC3n thi\u1EBFu ti\u1EC1n (${receivedAmount.toLocaleString("vi-VN")} \u0111 / ${requiredAmount.toLocaleString("vi-VN")} \u0111). \u0110\xE3 l\u01B0u ghi ch\xFA.`
    };
  }
  const client2 = await pool.connect();
  let placedSectionId = null;
  let placementError = null;
  const payloadSha256 = sha256Hex(rawBody || JSON.stringify(payload));
  try {
    await client2.query("BEGIN");
    const payment = await confirmCoursePayment(
      client2,
      matchedTx.enrollment_id,
      {
        amount: receivedAmount,
        reference: `SePay #${payload.id} (${payload.gateway || "MBBank"}${payload.referenceCode ? ` - ${payload.referenceCode}` : ""})`,
        paidAt: payload.transactionDate || (/* @__PURE__ */ new Date()).toISOString()
      },
      "lms"
    );
    if (isServiceError(payment)) {
      await client2.query("ROLLBACK");
      return {
        success: false,
        matched: true,
        message: payment.error,
        transactionId: matchedTx.id
      };
    }
    const sectionId = matchedTx.requested_section_id;
    if (sectionId && matchedTx.enrollment_status !== "active" && matchedTx.enrollment_status !== "completed") {
      await client2.query("SAVEPOINT sepay_placement");
      const placement = await placeEnrollment(client2, matchedTx.enrollment_id, sectionId, "lms");
      if (isServiceError(placement)) {
        await client2.query("ROLLBACK TO SAVEPOINT sepay_placement");
        placementError = placement.error;
      } else {
        placedSectionId = sectionId;
      }
    }
    await client2.query(
      `INSERT INTO payment_webhook_events (
         event_id, transaction_id, status, event_timestamp, payload_sha256, processing_status, processed_at
       ) VALUES ($1, $2, 'approved', CURRENT_TIMESTAMP, $3, 'processed', CURRENT_TIMESTAMP)
       ON CONFLICT (event_id) DO UPDATE
         SET processing_status = 'processed',
             processed_at = CURRENT_TIMESTAMP,
             transaction_id = $2`,
      [eventId, matchedTx.id, payloadSha256]
    );
    await client2.query("COMMIT");
  } catch (err) {
    await client2.query("ROLLBACK");
    throw err;
  } finally {
    client2.release();
  }
  onSuccessfulPayment?.();
  if (placedSectionId) {
    await notificationsRepository.create(pool, {
      userId: matchedTx.student_id,
      type: "success",
      message: `Thanh to\xE1n h\u1ECDc ph\xED kh\xF3a h\u1ECDc "${matchedTx.course_title}" \u0111\xE3 \u0111\u01B0\u1EE3c x\xE1c nh\u1EADn t\u1EF1 \u0111\u1ED9ng qua SePay! B\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c x\u1EBFp v\xE0o l\u1EDBp h\u1ECDc v\xE0 c\xF3 th\u1EC3 b\u1EAFt \u0111\u1EA7u h\u1ECDc t\u1EADp ngay.`
    });
  } else {
    await notificationsRepository.create(pool, {
      userId: matchedTx.student_id,
      type: "success",
      message: `Thanh to\xE1n h\u1ECDc ph\xED kh\xF3a h\u1ECDc "${matchedTx.course_title}" \u0111\xE3 \u0111\u01B0\u1EE3c x\xE1c nh\u1EADn t\u1EF1 \u0111\u1ED9ng qua SePay! B\u1EA1n vui l\xF2ng ch\u1EDD qu\u1EA3n tr\u1ECB vi\xEAn x\u1EBFp l\u1EDBp h\u1ECDc ph\u1EA7n.`
    });
  }
  return {
    success: true,
    matched: true,
    transactionId: matchedTx.id,
    enrollmentId: matchedTx.enrollment_id,
    placedSectionId,
    placementError,
    message: "X\xE1c nh\u1EADn thanh to\xE1n t\u1EF1 \u0111\u1ED9ng qua SePay th\xE0nh c\xF4ng."
  };
}

// src/server/eventHandlers.ts
function registerEventHandlers() {
  eventBus.on("grade.saved", async ({ studentId, courseRegistrationId, grade }, pool2) => {
    await notifyStudent(pool2, studentId, `\u0110i\u1EC3m s\u1ED1 m\u1EDBi \u0111\xE3 \u0111\u01B0\u1EE3c c\xF4ng b\u1ED1: ${grade}`, { relatedEntityType: "course_registration", relatedEntityId: courseRegistrationId });
  });
  eventBus.on("user.created", async (user, pool2) => {
    if (user.role !== "student") return;
    if (user.signupSource && user.signupSource !== "admin") return;
    try {
      await provisioningService.provisionStudentEmail(pool2, user.id);
    } catch (err) {
      console.error("[email-provisioning] failed for", user.id, err);
      try {
        await auditRepository.log(
          pool2,
          user.id,
          "email_provisioning_failed",
          "email",
          String(err.message || err)
        );
      } catch (logErr) {
        console.error("[email-provisioning] failed to log audit error:", logErr);
      }
    }
  });
}

// src/server/scheduler.ts
function startScheduler() {
  setInterval(() => {
    void runSchedulerTask("crm outbox", runCrmOutboxJob);
  }, 30 * 1e3);
}
async function runCrmOutboxJob() {
  return deliverPendingCrmEvents();
}
async function runSchedulerTask(name, task) {
  try {
    await task();
  } catch (error) {
    console.error(`[scheduler] ${name} failed`, error);
  }
}

// src/gradeUtils.ts
function percentToLetterGrade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
function percentToGradePoint(letterGrade) {
  const map = { A: 4, B: 3, C: 2, D: 1, F: 0, W: 0 };
  return map[letterGrade] ?? 0;
}

// src/server/reporting.ts
import ExcelJS from "exceljs";
var addFilter = (conditions, values, sql, value) => {
  values.push(value);
  conditions.push(sql.replace("$VALUE", `$${values.length}`));
};
var actorScope = (actor, conditions, values) => {
  if (actor.role === "teacher") {
    values.push(actor.id);
    conditions.push(`cs.teacher_id = $${values.length}`);
  }
};
async function getAttendanceReportRows(db, actor, filters = {}) {
  const values = [];
  const conditions = ["cr.status = 'registered'"];
  actorScope(actor, conditions, values);
  if (filters.courseId) addFilter(conditions, values, "c.id = $VALUE", filters.courseId);
  if (filters.sectionId) addFilter(conditions, values, "cs.id = $VALUE", filters.sectionId);
  const dateFromParam = filters.from ? (values.push(filters.from), values.length) : null;
  const dateToParam = filters.to ? (values.push(filters.to), values.length) : null;
  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length} OR cs.section_code ILIKE $${values.length})`);
  }
  const result = await db.query(
    `SELECT
       u.id AS student_id,
       u.name AS student_name,
       u.email AS student_email,
       u.phone AS student_phone,
       c.id AS course_id,
       c.title AS course_title,
       cs.id AS section_id,
       cs.section_code,
       COUNT(DISTINCT ats.id)::int AS total_sessions,
       COUNT(DISTINCT ats.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))::int AS attended_sessions,
       COUNT(DISTINCT ats.id) FILTER (WHERE ar.status = 'present')::int AS present_sessions,
       COUNT(DISTINCT ats.id) FILTER (WHERE ar.status = 'late')::int AS late_sessions,
       COUNT(DISTINCT ats.id) FILTER (WHERE ar.status = 'absent' OR ar.id IS NULL)::int AS absent_sessions,
       COUNT(DISTINCT ats.id) FILTER (WHERE ar.status = 'excused')::int AS excused_sessions,
       COALESCE(ROUND(
         COUNT(DISTINCT ats.id) FILTER (WHERE ar.status IN ('present', 'late', 'excused'))::numeric
         * 100 / NULLIF(COUNT(DISTINCT ats.id), 0)
       ), 100)::int AS attendance_percent
     FROM course_registrations cr
     JOIN users u ON u.id = cr.student_id
     JOIN course_sections cs ON cs.id = cr.section_id
     JOIN courses c ON c.id = cs.course_id
     LEFT JOIN attendance_sessions ats
       ON ats.course_id = c.id
      AND (ats.section_id = cs.id OR ats.section_id IS NULL)
      ${dateFromParam || dateToParam ? `AND ${dateFromParam ? `substring(ats.date from '^\\d{4}-\\d{2}-\\d{2}')::date >= $${dateFromParam}::date` : "TRUE"} ${dateToParam ? `AND substring(ats.date from '^\\d{4}-\\d{2}-\\d{2}')::date <= $${dateToParam}::date` : ""}` : ""}
     LEFT JOIN attendance_records ar ON ar.session_id = ats.id AND ar.student_id = cr.student_id
     WHERE ${conditions.filter((item) => !item.includes("substring(ats.date")).join(" AND ")}
     GROUP BY u.id, u.name, u.email, u.phone, c.id, c.title, cs.id, cs.section_code
     ORDER BY c.title, cs.section_code, u.name`,
    values
  );
  return result.rows.map((row) => ({
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    studentPhone: row.student_phone || "",
    courseId: row.course_id,
    courseTitle: row.course_title,
    sectionId: row.section_id,
    sectionCode: row.section_code,
    totalSessions: Number(row.total_sessions || 0),
    attendedSessions: Number(row.attended_sessions || 0),
    presentSessions: Number(row.present_sessions || 0),
    lateSessions: Number(row.late_sessions || 0),
    absentSessions: Number(row.absent_sessions || 0),
    excusedSessions: Number(row.excused_sessions || 0),
    attendancePercent: Number(row.attendance_percent ?? 100)
  }));
}
async function getGradebookReportRows(db, actor, filters = {}) {
  const values = [];
  const conditions = ["cr.status = 'registered'"];
  actorScope(actor, conditions, values);
  if (filters.courseId) addFilter(conditions, values, "c.id = $VALUE", filters.courseId);
  if (filters.sectionId) addFilter(conditions, values, "cs.id = $VALUE", filters.sectionId);
  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length} OR cs.section_code ILIKE $${values.length})`);
  }
  const result = await db.query(
    `WITH lesson_counts AS (
       SELECT course_id, COUNT(*)::int AS total_lessons FROM lessons GROUP BY course_id
     ), progress_counts AS (
       SELECT e.id AS enrollment_id, COUNT(*) FILTER (WHERE lp.completed)::int AS completed_lessons
       FROM enrollments e
       LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id
       GROUP BY e.id
     ), assignment_scores AS (
       SELECT a.course_id, s.student_id,
              ROUND(AVG((s.score::numeric / NULLIF(a.max_score, 0)) * 100), 2) AS assignment_percent
       FROM assignments a
       JOIN submissions s ON s.assignment_id = a.id
       WHERE s.score IS NOT NULL
       GROUP BY a.course_id, s.student_id
     ), quiz_scores AS (
       SELECT q.course_id, qa.student_id, ROUND(AVG(qa.score), 2) AS quiz_percent
       FROM quizzes q
       JOIN LATERAL (
         SELECT DISTINCT ON (student_id, quiz_id) student_id, quiz_id, score
         FROM quiz_attempts
         WHERE quiz_id = q.id
         ORDER BY student_id, quiz_id, score DESC, submitted_at DESC
       ) qa ON TRUE
       GROUP BY q.course_id, qa.student_id
     )
     SELECT u.id AS student_id, u.name AS student_name, u.email AS student_email, u.phone AS student_phone,
            c.id AS course_id, c.title AS course_title, cs.id AS section_id, cs.section_code,
            COALESCE(lp.completed_lessons, 0)::int AS completed_lessons,
            COALESCE(lc.total_lessons, 0)::int AS total_lessons,
            ascore.assignment_percent, qscore.quiz_percent,
            CASE
              WHEN ascore.assignment_percent IS NOT NULL AND qscore.quiz_percent IS NOT NULL THEN ROUND(ascore.assignment_percent * 0.3 + qscore.quiz_percent * 0.7, 2)
              ELSE COALESCE(ascore.assignment_percent, qscore.quiz_percent)
            END AS final_percent,
            cr.letter_grade, cr.grade_point
     FROM course_registrations cr
     JOIN users u ON u.id = cr.student_id
     JOIN course_sections cs ON cs.id = cr.section_id
     JOIN courses c ON c.id = cs.course_id
     LEFT JOIN progress_counts lp ON lp.enrollment_id = (
       SELECT e.id FROM enrollments e WHERE e.student_id = cr.student_id AND e.course_id = c.id ORDER BY e.enrolled_at DESC LIMIT 1
     )
     LEFT JOIN lesson_counts lc ON lc.course_id = c.id
     LEFT JOIN assignment_scores ascore ON ascore.course_id = c.id AND ascore.student_id = u.id
     LEFT JOIN quiz_scores qscore ON qscore.course_id = c.id AND qscore.student_id = u.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY c.title, cs.section_code, u.name`,
    values
  );
  return result.rows.map((row) => ({
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    studentPhone: row.student_phone || "",
    courseId: row.course_id,
    courseTitle: row.course_title,
    sectionId: row.section_id,
    sectionCode: row.section_code,
    completedLessons: Number(row.completed_lessons || 0),
    totalLessons: Number(row.total_lessons || 0),
    assignmentPercent: row.assignment_percent === null ? null : Number(row.assignment_percent),
    quizPercent: row.quiz_percent === null ? null : Number(row.quiz_percent),
    finalPercent: row.final_percent === null ? null : Number(row.final_percent),
    letterGrade: row.letter_grade || "",
    gradePoint: row.grade_point === null ? null : Number(row.grade_point)
  }));
}
function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
function toCsv(headers, rows, keys) {
  return `\uFEFF${headers.map(csvCell).join(",")}\r
${rows.map((row) => keys.map((key) => csvCell(row[key])).join(",")).join("\r\n")}\r
`;
}
async function toXlsx(sheetName, headers, rows, keys) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MCNA LMS";
  workbook.created = /* @__PURE__ */ new Date();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = headers.map((header, index) => ({ header, key: keys[index], width: Math.min(Math.max(header.length + 4, 14), 32) }));
  rows.forEach((row) => sheet.addRow(Object.fromEntries(keys.map((key) => [key, row[key] ?? ""]))));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
  headerRow.alignment = { vertical: "middle" };
  sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + Math.min(headers.length, 26))}1` };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// server.ts
var uploadDir = process.env.UPLOAD_DIR || path5.join(process.cwd(), "public", "uploads");
try {
  if (!fs5.existsSync(uploadDir)) {
    fs5.mkdirSync(uploadDir, { recursive: true });
  }
} catch (error) {
  console.warn(`Could not create ${uploadDir}, falling back to OS temp dir for uploads.`);
  uploadDir = path5.join(os3.tmpdir(), "lms_uploads");
  if (!fs5.existsSync(uploadDir)) {
    fs5.mkdirSync(uploadDir, { recursive: true });
  }
}
var storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path5.extname(file.originalname).toLowerCase();
    const base = path5.basename(file.originalname, path5.extname(file.originalname)).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) || "upload";
    cb(null, `${uniqueSuffix}-${base}${ext}`);
  }
});
var MAX_UPLOAD_FILE_BYTES2 = 50 * 1024 * 1024;
var allowedUploadExtensions = /* @__PURE__ */ new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".txt",
  ".md",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm"
]);
var allowedUploadMimeTypes = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm"
]);
var uploadFileFilter = (_req, file, cb) => {
  const ext = path5.extname(file.originalname).toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();
  const blockedExtensions = /* @__PURE__ */ new Set([".svg", ".html", ".htm", ".js", ".svgz"]);
  const blockedMimeTypes = /* @__PURE__ */ new Set(["image/svg+xml", "text/html", "application/javascript", "text/javascript"]);
  if (blockedExtensions.has(ext) || blockedMimeTypes.has(mime)) {
    const err2 = new Error("Unsupported file type. Security restrictions explicitly block SVG, HTML, and Javascript files.");
    err2.status = 400;
    cb(err2, false);
    return;
  }
  if (allowedUploadExtensions.has(ext) && allowedUploadMimeTypes.has(mime)) {
    cb(null, true);
    return;
  }
  const err = new Error("Unsupported file type. Allowed uploads: raster images, PDF, office documents, text/CSV/Markdown, ZIP archives, and video files.");
  err.status = 400;
  cb(err, false);
};
var upload = multer({ storage, fileFilter: uploadFileFilter, limits: { fileSize: MAX_UPLOAD_FILE_BYTES2 } });
var MATERIAL_MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".pbix": "application/octet-stream",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed"
};
var materialUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ext = path5.extname(Buffer.from(file.originalname, "latin1").toString("utf8")).toLowerCase();
    if (MATERIAL_MIME_BY_EXT[ext]) return cb(null, true);
    const err = new Error("T\xE0i li\u1EC7u bu\u1ED5i h\u1ECDc ch\u1EC9 nh\u1EADn t\u1EC7p .ppt, .pptx, .pdf, .doc, .docx, .xlsx, .xls, .csv, .pbix, .zip, .rar.");
    err.status = 400;
    cb(err);
  },
  limits: { fileSize: MAX_UPLOAD_FILE_BYTES2 }
});
var MATERIAL_FILE_EXTENSIONS = {
  slide: /* @__PURE__ */ new Set([".ppt", ".pptx", ".pdf"]),
  document: /* @__PURE__ */ new Set([".doc", ".docx", ".pdf", ".xlsx", ".xls", ".csv", ".pbix", ".zip", ".rar"])
};
dotenv2.config();
var app = express();
app.set("trust proxy", 1);
var PORT = Number(process.env.PORT || 3e3);
var JWT_SECRET = process.env.JWT_SECRET || "mcna-prod-fallback-jwt-secret-92f3e380913d";
if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET not set - using fallback secret. Set JWT_SECRET in Vercel/production environment variables.");
}
var JWT_SECRET_VALUE = JWT_SECRET || "dev-only-e16-lms-secret-do-not-use-in-prod";
var csrfSafeMethods = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
var PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET;
var PAYMENT_WEBHOOK_SECRET_VALUE = PAYMENT_WEBHOOK_SECRET;
if (!PAYMENT_WEBHOOK_SECRET) {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") {
    PAYMENT_WEBHOOK_SECRET_VALUE = crypto4.randomBytes(32).toString("hex");
    console.warn("WARNING: PAYMENT_WEBHOOK_SECRET environment variable is not set. Using a secure random value generated at runtime; payment webhooks will be rejected.");
  } else {
    PAYMENT_WEBHOOK_SECRET_VALUE = "dev-only-payment-webhook-secret-do-not-use-in-prod";
  }
}
var configuredWebhookToleranceSeconds = Number(process.env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS || 300);
var PAYMENT_WEBHOOK_TOLERANCE_SECONDS = Number.isFinite(configuredWebhookToleranceSeconds) && configuredWebhookToleranceSeconds > 0 ? configuredWebhookToleranceSeconds : 300;
var configuredPasswordResetTokenTtlMinutes = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30);
var PASSWORD_RESET_TOKEN_TTL_MINUTES = Number.isFinite(configuredPasswordResetTokenTtlMinutes) && configuredPasswordResetTokenTtlMinutes > 0 ? configuredPasswordResetTokenTtlMinutes : 30;
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString("utf8");
  }
}));
function asyncHandler(handler2) {
  return (req, res, next) => {
    handler2(req, res, next).catch(next);
  };
}
var UPLOAD_MIME_BY_EXT = {
  ...MATERIAL_MIME_BY_EXT,
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};
async function handleServeUpload(req, res) {
  const filename = path5.basename(req.params.filename);
  const localFile = path5.join(uploadDir, filename);
  if (fs5.existsSync(localFile)) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    const ext = path5.extname(filename).toLowerCase();
    const mime = UPLOAD_MIME_BY_EXT[ext];
    if (mime) res.setHeader("Content-Type", mime);
    return res.sendFile(localFile);
  }
  try {
    const download = await materialStorage.getDownload(`uploads/${filename}`, filename, { inline: true });
    if (download.kind === "redirect") {
      return res.redirect(302, download.url);
    }
    if (download.kind === "buffer") {
      const ext = path5.extname(filename).toLowerCase();
      const mime = download.mimeType || UPLOAD_MIME_BY_EXT[ext] || "application/octet-stream";
      res.setHeader("Content-Type", mime);
      res.setHeader("X-Content-Type-Options", "nosniff");
      const encodedName = encodeURIComponent(filename);
      const asciiName = filename.replace(/[^\x20-\x7E]/g, "_");
      res.setHeader("Content-Disposition", `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
      return res.send(download.buffer);
    }
    if (download.kind === "local" && fs5.existsSync(download.absolutePath)) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      const ext = path5.extname(filename).toLowerCase();
      const mime = UPLOAD_MIME_BY_EXT[ext];
      if (mime) res.setHeader("Content-Type", mime);
      return res.sendFile(download.absolutePath);
    }
  } catch (err) {
    console.warn(`[uploads] Storage lookup notice for ${filename}:`, err?.message || err);
  }
  return res.status(404).json({ error: "T\u1EC7p \u0111\xEDnh k\xE8m kh\xF4ng t\u1ED3n t\u1EA1i ho\u1EB7c \u0111\xE3 b\u1ECB x\xF3a." });
}
app.use("/uploads", express.static(uploadDir, {
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
}));
app.get("/uploads/:filename", asyncHandler(handleServeUpload));
app.get("/api/uploads/:filename", asyncHandler(handleServeUpload));
app.post("/api/upload", requireCsrf, requireAuth, upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const fileBuffer = await fs5.promises.readFile(req.file.path);
    const ext = path5.extname(req.file.filename).toLowerCase();
    const mime = req.file.mimetype || UPLOAD_MIME_BY_EXT[ext] || "application/octet-stream";
    await materialStorage.put(`uploads/${req.file.filename}`, fileBuffer, mime);
  } catch (persistErr) {
    console.warn("[upload] Persistent storage notice:", persistErr?.message || persistErr);
  }
  res.json({ url: `/uploads/${req.file.filename}` });
}));
app.use((req, _res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    invalidateStoreCache();
  }
  next();
});
async function createUserAccount(db, input, password) {
  const credential3 = hashPassword(password);
  const user = {
    id: generateId2("user"),
    email: input.email.toLowerCase().trim(),
    passwordHash: credential3.hash,
    passwordSalt: credential3.salt,
    name: input.name.trim(),
    role: input.role,
    isActive: true,
    phone: input.phone,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  return usersRepository.create(db, user);
}
function generateTemporaryPassword() {
  return `Lms-${crypto4.randomBytes(8).toString("base64url")}-1`;
}
async function createStudentWithTemporaryPassword(input, source, loginUrl) {
  const temporaryPassword = generateTemporaryPassword();
  const client2 = await pool.connect();
  let user;
  try {
    await client2.query("BEGIN");
    const created = await createUserAccount(client2, { email: input.email, name: input.name, role: "student", phone: input.phone }, temporaryPassword);
    await client2.query(
      "UPDATE users SET must_change_password = true, signup_source = $1, crm_contact_id = $2 WHERE id = $3",
      [source, input.crmContactId || null, created.id]
    );
    await client2.query("COMMIT");
    user = { ...created, mustChangePassword: true, signupSource: source, crmContactId: input.crmContactId };
  } catch (error) {
    await client2.query("ROLLBACK");
    if (error?.code === "23505") return { error: "Email ho\u1EB7c m\xE3 li\xEAn h\u1EC7 CRM \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng.", status: 409 };
    throw error;
  } finally {
    client2.release();
  }
  try {
    await sendTemporaryPasswordEmail(pool, user.id, { to: user.email, name: user.name, temporaryPassword, loginUrl });
  } catch {
    const cleanup = await pool.connect();
    try {
      await cleanup.query("BEGIN");
      await cleanup.query("DELETE FROM audit_logs WHERE user_id = $1", [user.id]);
      await cleanup.query("DELETE FROM users WHERE id = $1", [user.id]);
      await cleanup.query("COMMIT");
    } catch (cleanupError) {
      await cleanup.query("ROLLBACK");
      console.error("[account] failed to remove account after email failure:", user.id, cleanupError);
    } finally {
      cleanup.release();
    }
    return { error: "Kh\xF4ng g\u1EEDi \u0111\u01B0\u1EE3c email m\u1EADt kh\u1EA9u. Vui l\xF2ng ki\u1EC3m tra \u0111\u1ECBa ch\u1EC9 email v\xE0 th\u1EED l\u1EA1i sau.", status: 503 };
  }
  await enqueueCrmEvent(pool, "contact.registered", {
    lmsUserId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    signupSource: source,
    crmContactId: input.crmContactId || null,
    createdAt: user.createdAt
  }, source === "crm" ? "crm" : "lms");
  return { user, temporaryPassword };
}
function sha256Hex2(input) {
  return crypto4.createHash("sha256").update(input).digest("hex");
}
function generatePasswordResetToken() {
  return crypto4.randomBytes(32).toString("base64url");
}
function lmsBaseUrl(req) {
  return (process.env.LMS_LOGIN_URL || `${req.protocol}://${req.get("host") || "localhost:3000"}`).replace(/\/$/, "");
}
function passwordResetUrl(req, token) {
  return `${lmsBaseUrl(req)}/?resetToken=${encodeURIComponent(token)}`;
}
async function issuePasswordResetToken(userId, createdBy) {
  const resetToken = generatePasswordResetToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1e3).toISOString();
  const client2 = await pool.connect();
  try {
    await client2.query("BEGIN");
    await client2.query(
      "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL",
      [userId]
    );
    await client2.query(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [generateId2("pwd_reset"), userId, sha256Hex2(resetToken), createdBy, expiresAt]
    );
    await client2.query("COMMIT");
  } catch (error) {
    await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
  return { resetToken, expiresAt };
}
function parseWebhookTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1e10 ? value : value * 1e3;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return parseWebhookTimestamp(asNumber);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
function isWebhookTimestampFresh(timestamp) {
  return Math.abs(Date.now() - timestamp.getTime()) <= PAYMENT_WEBHOOK_TOLERANCE_SECONDS * 1e3;
}
async function logSystemAudit(action, target, detail) {
  const user = (await pool.query(
    "SELECT id FROM users WHERE id = 'user_admin' OR lower(email) = 'admin@mcna.local' ORDER BY CASE WHEN id = 'user_admin' THEN 0 ELSE 1 END LIMIT 1"
  )).rows[0];
  if (!user?.id) return;
  await auditRepository.log(pool, user.id, action, target, detail);
}
function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}
function signToken(user) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1e3) + 60 * 60 * 8
  }));
  const unsigned = `${header}.${payload}`;
  const signature = crypto4.createHmac("sha256", JWT_SECRET_VALUE).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}
async function verifyToken(token) {
  if (await safeRedis(() => redis.exists(`revoked:${token}`), 0) === 1) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto4.createHmac("sha256", JWT_SECRET_VALUE).update(`${header}.${payload}`).digest("base64url");
  const sigBuffer = Buffer.from(signature, "base64url");
  const expBuffer = Buffer.from(expected, "base64url");
  if (sigBuffer.byteLength !== expBuffer.byteLength) return null;
  if (!crypto4.timingSafeEqual(sigBuffer, expBuffer)) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1e3)) return null;
  return parsed;
}
function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging" ? "; Secure" : "";
  const domain = process.env.COOKIE_DOMAIN ? `; Domain=${process.env.COOKIE_DOMAIN}` : "";
  res.setHeader("Set-Cookie", [
    `mcna_lms_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}${secure}${domain}`,
    `e16_lms_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}${secure}${domain}`
  ]);
}
function setCsrfCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging" ? "; Secure" : "";
  const domain = process.env.COOKIE_DOMAIN ? `; Domain=${process.env.COOKIE_DOMAIN}` : "";
  res.append("Set-Cookie", [
    `mcna_lms_csrf=${token}; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}${secure}${domain}`,
    `e16_lms_csrf=${token}; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 8}${secure}${domain}`
  ]);
}
function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", [
    "mcna_lms_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    "mcna_lms_csrf=; SameSite=Lax; Path=/; Max-Age=0",
    "e16_lms_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    "e16_lms_csrf=; SameSite=Lax; Path=/; Max-Age=0"
  ]);
}
function extractBearerToken(req) {
  const header = req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  const match = (req.header("Cookie") || "").match(/(?:^|;\s*)(?:mcna_lms_session|e16_lms_session)=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
function extractCookie(req, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = (req.header("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
function createIpRateLimiter(name, max, windowSec, message) {
  return async (req, res, next) => {
    try {
      if (process.env.DISABLE_RATE_LIMIT === "true") return next();
      const key = `ratelimit:${name}:${req.ip || req.socket.remoteAddress || "unknown"}`;
      const current = await safeRedis(async () => {
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSec);
        return count;
      }, 1);
      if (current > max) {
        const ttl = await safeRedis(() => redis.ttl(key), windowSec);
        res.setHeader("Retry-After", String(ttl));
        return res.status(429).json({ error: message });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
var rateLimitPublicCatalog = createIpRateLimiter("public-catalog", 120, 60, "Qu\xE1 nhi\u1EC1u y\xEAu c\u1EA7u, vui l\xF2ng th\u1EED l\u1EA1i sau \xEDt ph\xFAt.");
var rateLimitRegister = createIpRateLimiter("register", 5, 60 * 60, "B\u1EA1n \u0111\xE3 g\u1EEDi qu\xE1 nhi\u1EC1u y\xEAu c\u1EA7u t\u1EA1o t\xE0i kho\u1EA3n. Vui l\xF2ng th\u1EED l\u1EA1i sau.");
var rateLimitForgotPassword = createIpRateLimiter("forgot-password", 5, 15 * 60, "Qu\xE1 nhi\u1EC1u y\xEAu c\u1EA7u qu\xEAn m\u1EADt kh\u1EA9u. Vui l\xF2ng th\u1EED l\u1EA1i sau.");
var rateLimitCrmIntegration = createIpRateLimiter("crm-integration", 300, 60, "Too many CRM integration requests.");
var rateLimitCertificateVerify = createIpRateLimiter("certificate-verify", 60, 60, "Qu\xE1 nhi\u1EC1u y\xEAu c\u1EA7u x\xE1c th\u1EF1c ch\u1EE9ng ch\u1EC9, vui l\xF2ng th\u1EED l\u1EA1i sau \xEDt ph\xFAt.");
async function rateLimitLogin(req, res, next) {
  try {
    if (process.env.DISABLE_RATE_LIMIT === "true") return next();
    const key = `ratelimit:login:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const max = 10;
    const windowSec = 15 * 60;
    const current = await safeRedis(async () => {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSec);
      return count;
    }, 1);
    if (current > max) {
      const ttl = await safeRedis(() => redis.ttl(key), windowSec);
      res.setHeader("Retry-After", String(ttl));
      return res.status(429).json({ error: "Too many login attempts. Please try again later." });
    }
    next();
  } catch (error) {
    next(error);
  }
}
async function rateLimitResetPassword(req, res, next) {
  try {
    if (process.env.DISABLE_RATE_LIMIT === "true") return next();
    const key = `ratelimit:resetpwd:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const max = 5;
    const windowSec = 15 * 60;
    const current = await safeRedis(async () => {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSec);
      return count;
    }, 1);
    if (current > max) {
      const ttl = await safeRedis(() => redis.ttl(key), windowSec);
      res.setHeader("Retry-After", String(ttl));
      return res.status(429).json({ error: "Too many password reset attempts. Please try again later." });
    }
    next();
  } catch (error) {
    next(error);
  }
}
async function rateLimitBulkImport(req, res, next) {
  try {
    if (process.env.DISABLE_RATE_LIMIT === "true") return next();
    const key = `ratelimit:bulkimport:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const max = 3;
    const windowSec = 15 * 60;
    const current = await safeRedis(async () => {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSec);
      return count;
    }, 1);
    if (current > max) {
      const ttl = await safeRedis(() => redis.ttl(key), windowSec);
      res.setHeader("Retry-After", String(ttl));
      return res.status(429).json({ error: "Too many bulk import attempts. Please try again later." });
    }
    next();
  } catch (error) {
    next(error);
  }
}
function requireCsrf(req, res, next) {
  if (csrfSafeMethods.has(req.method)) return next();
  if (req.path === "/auth/login" || req.path === "/api/auth/login") return next();
  if (req.path === "/auth/reset-password/complete" || req.path === "/api/auth/reset-password/complete") return next();
  if (req.path === "/auth/register" || req.path === "/api/auth/register") return next();
  if (req.path === "/auth/forgot-password" || req.path === "/api/auth/forgot-password") return next();
  if (req.path.startsWith("/integrations/crm/")) return next();
  if (req.path === "/payments/webhook" || req.path === "/webhooks/payment" || req.path === "/api/payments/webhook" || req.path === "/api/webhooks/payment" || req.path === "/api/payments/sepay/webhook" || req.path === "/api/webhooks/sepay" || req.path === "/payments/sepay/webhook" || req.path === "/webhooks/sepay") return next();
  const secFetchSite = req.header("Sec-Fetch-Site");
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
    return next();
  }
  const cookieToken = extractCookie(req, "mcna_lms_csrf") || extractCookie(req, "e16_lms_csrf");
  const headerToken = req.header("X-CSRF-Token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.warn(`[CSRF] Rejected ${req.method} ${req.originalUrl} \u2014 cookie=${cookieToken ? "present" : "MISSING"}, header=${headerToken ? "present" : "MISSING"}, match=${cookieToken === headerToken}`);
    return res.status(403).json({ error: "Invalid CSRF token.", debug: { hasCookie: !!cookieToken, hasHeader: !!headerToken } });
  }
  next();
}
var PASSWORD_CHANGE_ALLOWED_PATHS = /* @__PURE__ */ new Set(["/api/auth/me", "/api/auth/logout", "/api/users/change-password"]);
async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing session." });
    const payload = await verifyToken(token);
    if (!payload) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "Invalid or expired session." });
    }
    const mockUser = isDevMockDb ? (devMockStore || getInitialStore()).users.find((item) => item.id === payload.sub) : null;
    const user = mockUser ? { ...mockUser, passwordHash: "", passwordSalt: void 0 } : await usersRepository.findById(pool, payload.sub);
    if (!user || !user.isActive) {
      clearAuthCookie(res);
      return res.status(401).json({ error: "User is not available." });
    }
    req.user = user;
    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED_PATHS.has(req.originalUrl.split("?")[0])) {
      return res.status(403).json({ error: "B\u1EA1n c\u1EA7n \u0111\u1ED5i m\u1EADt kh\u1EA9u t\u1EA1m th\u1EDDi tr\u01B0\u1EDBc khi ti\u1EBFp t\u1EE5c.", code: "PASSWORD_CHANGE_REQUIRED" });
    }
    next();
  } catch (error) {
    next(error);
  }
}
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Permission denied." });
    next();
  };
}
async function audit(req, action, target, detail) {
  if (!req.user) return;
  await auditRepository.log(pool, req.user.id, action, target, detail);
}
function certificateFromRow(row) {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    studentId: row.student_id,
    courseId: row.course_id,
    issuedAt: row.issued_at,
    certificateCode: row.certificate_code
  };
}
async function generateCertificateCode(db) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const raw = crypto4.randomBytes(4).toString("hex").toUpperCase();
    const code = `MCNA-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    const existing = await db.query("SELECT 1 FROM certificates WHERE certificate_code = $1", [code]);
    if (existing.rowCount === 0) return code;
  }
  return `MCNA-${Date.now().toString(36).toUpperCase()}`;
}
async function maybePostFinalCourseGrade(db, studentId, courseId2) {
  const assignments = (await db.query(
    `SELECT a.id, a.max_score, s.score
     FROM assignments a
     LEFT JOIN LATERAL (
       SELECT score
       FROM submissions
       WHERE assignment_id = a.id
         AND student_id = $2
         AND score IS NOT NULL
       ORDER BY graded_at DESC NULLS LAST, submitted_at DESC
       LIMIT 1
     ) s ON true
     WHERE a.course_id = $1`,
    [courseId2, studentId]
  )).rows;
  const quizzes = (await db.query(
    `SELECT q.id, qa.score
     FROM quizzes q
     LEFT JOIN LATERAL (
       SELECT score
       FROM quiz_attempts
       WHERE quiz_id = q.id
         AND student_id = $2
       ORDER BY score DESC, submitted_at DESC
       LIMIT 1
     ) qa ON true
     WHERE q.course_id = $1`,
    [courseId2, studentId]
  )).rows;
  if (assignments.length === 0 && quizzes.length === 0) return null;
  let assignmentPercent = null;
  if (assignments.length > 0) {
    if (assignments.some((row) => row.score === null || row.score === void 0)) return null;
    assignmentPercent = assignments.reduce((sum, row) => {
      const maxScore = Math.max(1, Number(row.max_score || 1));
      return sum + Number(row.score) / maxScore * 100;
    }, 0) / assignments.length;
  }
  let quizPercent = null;
  if (quizzes.length > 0) {
    if (quizzes.some((row) => row.score === null || row.score === void 0)) return null;
    quizPercent = quizzes.reduce((sum, row) => sum + Number(row.score || 0), 0) / quizzes.length;
  }
  const rawFinalScore = assignmentPercent !== null && quizPercent !== null ? assignmentPercent * 0.3 + quizPercent * 0.7 : assignmentPercent ?? quizPercent;
  if (rawFinalScore === null || rawFinalScore === void 0) return null;
  const finalScore = Math.round(rawFinalScore * 100) / 100;
  const letterGrade = percentToLetterGrade(finalScore);
  const gradePoint = percentToGradePoint(letterGrade);
  const postedAt = (/* @__PURE__ */ new Date()).toISOString();
  const updated = (await db.query(
    `WITH target_registration AS (
       SELECT cr.id
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.student_id = $1
         AND cs.course_id = $2
         AND cr.status NOT IN ('dropped', 'waitlisted', 'withdrawn')
       ORDER BY cr.registered_at DESC
       LIMIT 1
     )
     UPDATE course_registrations cr
     SET grade = $3,
         letter_grade = $4,
         grade_point = $5,
         grade_posted_at = $6
     FROM target_registration target
     WHERE cr.id = target.id
       AND (
         cr.grade IS DISTINCT FROM $3
         OR cr.letter_grade IS DISTINCT FROM $4
         OR cr.grade_point IS DISTINCT FROM $5
         OR cr.grade_posted_at IS NULL
       )
     RETURNING cr.id`,
    [studentId, courseId2, finalScore, letterGrade, gradePoint, postedAt]
  )).rows;
  for (const row of updated) {
    await eventBus.emit("grade.saved", { studentId, courseRegistrationId: row.id, grade: letterGrade }, pool);
  }
  return { studentId, courseId: courseId2, finalScore, letterGrade, gradePoint, registrationIds: updated.map((row) => row.id) };
}
async function maybePostFinalCourseGradeForQuiz(db, studentId, quizId) {
  const quiz = (await db.query("SELECT course_id FROM quizzes WHERE id = $1", [quizId])).rows[0];
  if (!quiz) return null;
  return maybePostFinalCourseGrade(db, studentId, quiz.course_id);
}
async function maybePostFinalCourseGradeForSubmission(db, submissionId) {
  const submission = (await db.query(
    `SELECT s.student_id, a.course_id
     FROM submissions s
     JOIN assignments a ON a.id = s.assignment_id
     WHERE s.id = $1`,
    [submissionId]
  )).rows[0];
  if (!submission) return null;
  return maybePostFinalCourseGrade(db, submission.student_id, submission.course_id);
}
async function maybePostGradeEntry(db, studentId, sourceType, sourceId, score, maxScore = 100) {
  try {
    let courseId2 = "";
    if (sourceType === "quiz") {
      const res = await db.query(
        `SELECT q.course_id
         FROM quizzes q
         JOIN quiz_attempts qa ON qa.quiz_id = q.id
         WHERE qa.id = $1`,
        [sourceId]
      );
      courseId2 = res.rows[0]?.course_id;
    } else if (sourceType === "assignment") {
      const res = await db.query(
        `SELECT a.course_id
         FROM assignments a
         JOIN submissions s ON s.assignment_id = a.id
         WHERE s.id = $1`,
        [sourceId]
      );
      courseId2 = res.rows[0]?.course_id;
    }
    if (!courseId2) {
      console.warn(`[maybePostGradeEntry] Could not find courseId for sourceId: ${sourceId}`);
      return;
    }
    const existing = await db.query(
      `SELECT id FROM grades WHERE source_type = $1 AND source_id = $2`,
      [sourceType, sourceId]
    );
    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE grades SET score = $1, max_score = $2 WHERE id = $3`,
        [score, maxScore, existing.rows[0].id]
      );
    } else {
      const gradeId = generateId2("grd");
      const createdAt = (/* @__PURE__ */ new Date()).toISOString();
      await db.query(
        `INSERT INTO grades (id, student_id, course_id, source_type, source_id, score, max_score, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [gradeId, studentId, courseId2, sourceType, sourceId, score, maxScore, createdAt]
      );
    }
  } catch (err) {
    console.error("[maybePostGradeEntry] Failed to write grade entry:", err);
  }
}
var scheduleSlotTime = (slot, key) => String(
  key === "start" ? slot?.startTime || slot?.start_time || "" : slot?.endTime || slot?.end_time || ""
).trim();
var scheduleSlotRoom = (slot) => String(slot?.room || "").trim();
var scheduleSlotDayLabel = (slot) => String(slot?.dayOfWeek || slot?.day_of_week || slot?.specificDate || slot?.specific_date || "").trim();
var timeToMinutes = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};
var slotDateDayIndex = (slot) => {
  const specificDate = String(slot?.specificDate || slot?.specific_date || "").slice(0, 10);
  if (!isDateOnlyText(specificDate)) return null;
  const [year, month, day] = specificDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};
var slotsOccurOnSameDay = (left, right) => {
  const leftDate = String(left?.specificDate || left?.specific_date || "").slice(0, 10);
  const rightDate = String(right?.specificDate || right?.specific_date || "").slice(0, 10);
  if (isDateOnlyText(leftDate) && isDateOnlyText(rightDate)) return leftDate === rightDate;
  const leftDay = slotDateDayIndex(left) ?? dayOfWeekIndex(left?.dayOfWeek || left?.day_of_week);
  const rightDay = slotDateDayIndex(right) ?? dayOfWeekIndex(right?.dayOfWeek || right?.day_of_week);
  return leftDay !== null && rightDay !== null && leftDay === rightDay;
};
var slotsOverlap = (left, right) => {
  if (!slotsOccurOnSameDay(left, right)) return false;
  const leftStart = timeToMinutes(scheduleSlotTime(left, "start"));
  const leftEnd = timeToMinutes(scheduleSlotTime(left, "end"));
  const rightStart = timeToMinutes(scheduleSlotTime(right, "start"));
  const rightEnd = timeToMinutes(scheduleSlotTime(right, "end"));
  if (leftStart === null || leftEnd === null || rightStart === null || rightEnd === null) return false;
  return leftStart < rightEnd && rightStart < leftEnd;
};
async function validateCourseSectionScheduleConflicts(db, section) {
  const schedule = Array.isArray(section.schedule) ? section.schedule : [];
  const errors = [];
  for (const slot of schedule) {
    const start = timeToMinutes(scheduleSlotTime(slot, "start"));
    const end = timeToMinutes(scheduleSlotTime(slot, "end"));
    if (start === null || end === null || start >= end) {
      errors.push(`Invalid class time for ${scheduleSlotDayLabel(slot) || "schedule slot"}: ${scheduleSlotTime(slot, "start")} - ${scheduleSlotTime(slot, "end")}.`);
    }
  }
  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      if (slotsOverlap(schedule[i], schedule[j])) {
        errors.push(`This class has overlapping schedule slots on ${scheduleSlotDayLabel(schedule[i]) || "the same day"}.`);
      }
    }
  }
  if (!section.teacherId || schedule.length === 0) return errors;
  const existingSections = (await db.query(
    `SELECT cs.*, c.title AS course_title, u.name AS teacher_name
     FROM course_sections cs
     LEFT JOIN courses c ON c.id = cs.course_id
     LEFT JOIN users u ON u.id = cs.teacher_id
     WHERE cs.status <> 'cancelled'
       AND cs.id <> $1
       AND (cs.teacher_id = $2 OR cs.schedule IS NOT NULL OR cs.schedule_json IS NOT NULL)`,
    [section.id || "", section.teacherId]
  )).rows;
  for (const existing of existingSections) {
    const existingSchedule = parseSchedule(existing);
    for (const slot of schedule) {
      for (const existingSlot of existingSchedule) {
        if (!slotsOverlap(slot, existingSlot)) continue;
        if (existing.teacher_id === section.teacherId) {
          errors.push(
            `Teacher schedule conflict with class ${existing.section_code} (${existing.course_title || "course"}) on ${scheduleSlotDayLabel(slot)} ${scheduleSlotTime(slot, "start")} - ${scheduleSlotTime(slot, "end")}.`
          );
        }
        const room = scheduleSlotRoom(slot).toLowerCase();
        const existingRoom = scheduleSlotRoom(existingSlot).toLowerCase();
        if (room && existingRoom && room === existingRoom) {
          errors.push(
            `Room schedule conflict with class ${existing.section_code} (${existing.course_title || "course"}) in room ${scheduleSlotRoom(slot)} on ${scheduleSlotDayLabel(slot)} ${scheduleSlotTime(slot, "start")} - ${scheduleSlotTime(slot, "end")}.`
          );
        }
      }
    }
  }
  return Array.from(new Set(errors));
}
var isSyncing = false;
var syncQueue = [];
async function syncClientStoreToDb(store) {
  if (store.users) {
    for (const u of store.users) {
      delete u.school_email;
      delete u.schoolEmail;
      delete u.email_provisioned;
      delete u.emailProvisioned;
      delete u.email_provisioned_at;
      delete u.emailProvisionedAt;
    }
  }
  await new Promise((resolve) => {
    if (!isSyncing) {
      isSyncing = true;
      resolve();
    } else {
      syncQueue.push(resolve);
    }
  });
  try {
    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");
      const dbCoursesRes = await client2.query("SELECT id, status, rejection_reason FROM courses");
      const dbCoursesMap = new Map(dbCoursesRes.rows.map((r) => [r.id, r]));
      for (const course of store.courses || []) {
        const dbCourse = dbCoursesMap.get(course.id);
        const isDirty = !dbCourse || dbCourse.status !== course.status || dbCourse.rejection_reason !== (course.rejectionReason || null);
        if (isDirty) {
          await client2.query(
            `UPDATE courses SET status = $1, rejection_reason = $2 WHERE id = $3`,
            [course.status, course.rejectionReason || null, course.id]
          );
        }
      }
      if (store.notifications !== void 0) {
        const dbRes = await client2.query("SELECT id, user_id, type, message, is_read, created_at FROM notifications");
        const dbMap = new Map(dbRes.rows.map((r) => [r.id, r]));
        const clientNotes = store.notifications || [];
        for (const note of clientNotes) {
          const dbVal = dbMap.get(note.id);
          const isDirty = !dbVal || dbVal.user_id !== note.userId || dbVal.type !== note.type || dbVal.message !== note.message || Boolean(dbVal.is_read) !== Boolean(note.isRead) || dbVal.created_at !== note.createdAt;
          if (isDirty) {
            await client2.query(
              `INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               user_id = EXCLUDED.user_id,
               type = EXCLUDED.type,
               message = EXCLUDED.message,
               is_read = EXCLUDED.is_read,
               created_at = EXCLUDED.created_at`,
              [note.id, note.userId, note.type, note.message, Boolean(note.isRead), note.createdAt]
            );
          }
        }
      }
      if (store.quizzes !== void 0) {
        const dbRes = await client2.query("SELECT id, course_id, lesson_id, title, passing_score, time_limit, max_attempts, attachment_url FROM quizzes");
        const dbMap = new Map(dbRes.rows.map((r) => [r.id, r]));
        const clientQuizzes = store.quizzes || [];
        for (const q of clientQuizzes) {
          const dbVal = dbMap.get(q.id);
          const isDirty = !dbVal || dbVal.course_id !== q.courseId || dbVal.lesson_id !== (q.lessonId || null) || dbVal.title !== q.title || Number(dbVal.passing_score) !== (Number(q.passingScore) || 70) || Number(dbVal.time_limit) !== (Number(q.timeLimit) || 15) || Number(dbVal.max_attempts) !== (Number(q.maxAttempts) || 3) || dbVal.attachment_url !== (q.attachmentUrl || null);
          if (isDirty) {
            await client2.query(
              `INSERT INTO quizzes (id, course_id, lesson_id, title, passing_score, time_limit, max_attempts, attachment_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET
               course_id = EXCLUDED.course_id,
               lesson_id = EXCLUDED.lesson_id,
               title = EXCLUDED.title,
               passing_score = EXCLUDED.passing_score,
               time_limit = EXCLUDED.time_limit,
               max_attempts = EXCLUDED.max_attempts,
               attachment_url = EXCLUDED.attachment_url`,
              [
                q.id,
                q.courseId,
                q.lessonId || null,
                q.title,
                Number(q.passingScore) || 70,
                Number(q.timeLimit) || 15,
                Number(q.maxAttempts) || 3,
                q.attachmentUrl || null
              ]
            );
          }
        }
      }
      if (store.questions !== void 0) {
        const dbRes = await client2.query("SELECT id, quiz_id, text, type, options_json, correct_answer FROM questions");
        const dbMap = new Map(dbRes.rows.map((r) => [r.id, r]));
        const clientQuestions = store.questions || [];
        for (const qst of clientQuestions) {
          const dbVal = dbMap.get(qst.id);
          const optionsStr = JSON.stringify(qst.options || []);
          const isDirty = !dbVal || dbVal.quiz_id !== qst.quizId || dbVal.text !== qst.text || dbVal.type !== qst.type || JSON.stringify(dbVal.options_json ? typeof dbVal.options_json === "string" ? JSON.parse(dbVal.options_json) : dbVal.options_json : []) !== JSON.stringify(qst.options || []) || dbVal.correct_answer !== qst.correctAnswer;
          if (isDirty) {
            await client2.query(
              `INSERT INTO questions (id, quiz_id, text, type, options_json, correct_answer, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
               quiz_id = EXCLUDED.quiz_id,
               text = EXCLUDED.text,
               type = EXCLUDED.type,
               options_json = EXCLUDED.options_json,
               correct_answer = EXCLUDED.correct_answer,
               created_at = COALESCE(questions.created_at, EXCLUDED.created_at)`,
              [
                qst.id,
                qst.quizId,
                qst.text,
                qst.type,
                optionsStr,
                qst.correctAnswer,
                qst.createdAt || (/* @__PURE__ */ new Date()).toISOString()
              ]
            );
          }
        }
      }
      if (store.courseSections !== void 0) {
        const dbRes = await client2.query("SELECT id, course_id, semester_id, teacher_id, section_code, max_students, status, schedule_json, schedule, opening_date, number_of_sessions FROM course_sections");
        const dbMap = new Map(dbRes.rows.map((r) => [r.id, r]));
        const clientSections = store.courseSections || [];
        for (const sec of clientSections) {
          const dbVal = dbMap.get(sec.id);
          const sectionSchedule = parseSchedule({ schedule: sec.schedule });
          const scheduleStr = JSON.stringify(sectionSchedule);
          const sectionSessionCount = Number(sec.numberOfSessions || dbVal?.number_of_sessions || 10);
          let dbScheduleStr = "[]";
          if (dbVal) {
            dbScheduleStr = JSON.stringify(parseSchedule(dbVal));
          }
          const isDirty = !dbVal || dbVal.course_id !== sec.courseId || dbVal.teacher_id !== sec.teacherId || dbVal.section_code !== sec.sectionCode || Number(dbVal.max_students) !== (Number(sec.maxStudents) || 30) || dbVal.status !== (sec.status || "open") || dbVal.opening_date !== (sec.openingDate || null) || Number(dbVal.number_of_sessions || 0) !== sectionSessionCount || dbScheduleStr !== scheduleStr;
          if (isDirty) {
            await upsertCourseSection(client2, {
              id: sec.id,
              courseId: sec.courseId,
              teacherId: sec.teacherId,
              sectionCode: sec.sectionCode,
              maxStudents: Number(sec.maxStudents) || 30,
              schedule: sectionSchedule,
              status: sec.status || "open",
              openingDate: sec.openingDate || dbVal?.opening_date || void 0,
              numberOfSessions: sectionSessionCount
            });
          }
        }
      }
      if (store.enrollments !== void 0) {
        const dbRes = await client2.query("SELECT id, course_id, student_id, status, enrolled_at, completed_at FROM enrollments");
        const dbMap = new Map(dbRes.rows.map((r) => [r.id, r]));
        const clientEnrollments = store.enrollments || [];
        for (const e of clientEnrollments) {
          const dbVal = dbMap.get(e.id);
          const isDirty = !dbVal || dbVal.course_id !== e.courseId || dbVal.student_id !== e.studentId || dbVal.status !== e.status || dbVal.enrolled_at !== e.enrolledAt || dbVal.completed_at !== (e.completedAt || null);
          if (isDirty && dbVal) {
            await client2.query(
              `UPDATE enrollments SET completed_at = $1 WHERE id = $2`,
              [e.completedAt || null, e.id]
            );
          }
        }
      }
      if (store.certificates !== void 0) {
        const clientCerts = store.certificates || [];
        const clientCertIds = clientCerts.map((c) => c.id);
        const dbRes = await client2.query("SELECT id, enrollment_id, student_id, course_id, issued_at, certificate_code FROM certificates");
        const dbMap = new Map(dbRes.rows.map((r) => [r.id, r]));
        if (clientCertIds.length > 0) {
          await client2.query(
            `DELETE FROM certificates WHERE id NOT IN (${clientCertIds.map((_, i) => `$${i + 1}`).join(", ")})`,
            clientCertIds
          );
        } else {
          await client2.query(`DELETE FROM certificates`);
        }
        for (const cert of clientCerts) {
          const dbVal = dbMap.get(cert.id);
          const isDirty = !dbVal || dbVal.enrollment_id !== cert.enrollmentId || dbVal.student_id !== cert.studentId || dbVal.course_id !== cert.courseId || dbVal.issued_at !== cert.issuedAt || dbVal.certificate_code !== cert.certificateCode;
          if (isDirty) {
            await client2.query(
              `INSERT INTO certificates (id, enrollment_id, student_id, course_id, issued_at, certificate_code)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               enrollment_id = EXCLUDED.enrollment_id,
               student_id = EXCLUDED.student_id,
               course_id = EXCLUDED.course_id,
               issued_at = EXCLUDED.issued_at,
               certificate_code = EXCLUDED.certificate_code`,
              [
                cert.id,
                cert.enrollmentId,
                cert.studentId,
                cert.courseId,
                cert.issuedAt,
                cert.certificateCode
              ]
            );
          }
        }
      }
      await client2.query("COMMIT");
      invalidateStoreCache();
    } catch (error) {
      await client2.query("ROLLBACK");
      throw error;
    } finally {
      client2.release();
    }
  } finally {
    if (syncQueue.length > 0) {
      const next = syncQueue.shift();
      next();
    } else {
      isSyncing = false;
    }
  }
}
function dashboardFromStore(store, user) {
  const scoped = limitStoreForRole(store, user);
  if (user.role === "admin") {
    return {
      ...scoped,
      dashboard: {
        users: scoped.users.length,
        courses: scoped.courses.length,
        pendingCourses: scoped.courses.filter((course) => course.status === "pending").length,
        activeEnrollments: scoped.enrollments.filter((item) => item.status === "active").length
      }
    };
  }
  if (user.role === "teacher") {
    return {
      ...scoped,
      dashboard: {
        courses: scoped.courses.length,
        enrollments: scoped.enrollments.length,
        submissionsToGrade: scoped.submissions.filter((item) => item.score === void 0).length
      }
    };
  }
  if (user.role === "student") {
    return {
      ...scoped,
      dashboard: {
        enrolledCourses: scoped.enrollments.length,
        completedLessons: scoped.lessonProgress.filter((item) => item.completed).length
      }
    };
  }
  return scoped;
}
var isDevMockDb = false;
var devMockStore = null;
async function initializeDatabase() {
  registerEventHandlers();
  if (process.env.VERCEL) {
    return;
  }
  try {
    const client2 = await pool.connect();
    client2.release();
  } catch (err) {
    if (isLocalDb && process.env.NODE_ENV !== "production") {
      console.warn("\n=======================================================");
      console.warn("\u26A0\uFE0F  [DEV NOTICE] Khong the ket noi PostgreSQL cuc bo (127.0.0.1:5432).");
      console.warn("\u{1F680} Kich hoat Dev In-Memory Mock Store de xem va trai nghiem day du giao dien ngay!");
      console.warn("=======================================================\n");
      isDevMockDb = true;
      devMockStore = getInitialStore();
      return;
    }
    throw err;
  }
  await runMigrations(pool);
  await usersRepository.normalizeLegacyRoles(pool);
  await seedAuthUsers(pool);
  await seedCoreLearningData(pool);
  await usersRepository.normalizeSystemUsers(pool);
  if (process.env.NODE_ENV === "production") await ensureScheduledSessionsForAllSections(pool);
  invalidateStoreCache();
  startScheduler();
}
app.post("/api/auth/force-logout", asyncHandler(async (req, res) => {
  const token = extractBearerToken(req);
  if (token) {
    await safeRedis(() => redis.set(`revoked:${token}`, "1", "EX", 60 * 60 * 8), "OK");
    const payload = await verifyToken(token);
    if (payload) await auditRepository.log(pool, payload.sub, "authentication_force_logout", "security", "Session forcibly cleared from login screen.");
  }
  clearAuthCookie(res);
  res.status(204).send();
}));
function requireInternalJobSecret(req, res, next) {
  const configured = process.env.CRON_SECRET;
  const supplied = req.get("authorization")?.replace(/^Bearer\s+/i, "") || req.get("x-cron-secret");
  const suppliedBuffer = Buffer.from(supplied || "");
  const configuredBuffer = Buffer.from(configured || "");
  const matches = suppliedBuffer.length === configuredBuffer.length && crypto4.timingSafeEqual(suppliedBuffer, configuredBuffer);
  if (!configured || !supplied || !matches) {
    return res.status(configured ? 401 : 503).json({ error: configured ? "Unauthorized cron request." : "CRON_SECRET is not configured." });
  }
  return next();
}
for (const method of ["get", "post"]) {
  app[method]("/api/internal/jobs/crm-outbox", requireInternalJobSecret, asyncHandler(async (_req, res) => {
    res.json(await runCrmOutboxJob());
  }));
}
app.use("/api", requireCsrf);
app.get("/health", asyncHandler(async (_req, res) => {
  if (isDevMockDb) {
    return res.json({ ok: true, database: "mock_in_memory", uptime: process.uptime() });
  }
  await pool.query("SELECT 1");
  res.json({ ok: true, database: "ok", uptime: process.uptime() });
}));
app.post("/api/auth/login", rateLimitLogin, validateBody(schemas.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const cleanEmail = email.toLowerCase().trim();
    const userItem = store.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!userItem || !verifyPassword(password, userItem.passwordHash, userItem.passwordSalt || void 0)) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    if (!userItem.isActive) return res.status(403).json({ error: "Account inactive." });
    const user2 = {
      id: userItem.id,
      email: userItem.email,
      passwordHash: "",
      name: userItem.name,
      role: userItem.role,
      isActive: userItem.isActive,
      createdAt: userItem.createdAt
    };
    setAuthCookie(res, signToken(user2));
    const csrfToken2 = crypto4.randomBytes(24).toString("base64url");
    setCsrfCookie(res, csrfToken2);
    return res.json({ user: user2, csrfToken: csrfToken2 });
  }
  const row = await usersRepository.findAuthByEmail(pool, email);
  if (!row || !verifyPassword(password, row.password_hash, row.password_salt || void 0)) return res.status(401).json({ error: "Incorrect email or password." });
  if (!row.is_active) return res.status(403).json({ error: "Account inactive." });
  const existingToken = extractBearerToken(req);
  if (existingToken) {
    try {
      const payload = await verifyToken(existingToken);
      if (payload && payload.sub !== row.id) {
        return res.status(400).json({
          error: "B\u1EA1n \u0111ang \u0111\u0103ng nh\u1EADp b\u1EB1ng m\u1ED9t t\xE0i kho\u1EA3n kh\xE1c. Vui l\xF2ng \u0111\u0103ng xu\u1EA5t tr\u01B0\u1EDBc khi \u0111\u0103ng nh\u1EADp t\xE0i kho\u1EA3n m\u1EDBi.",
          code: "SESSION_CONFLICT"
        });
      }
    } catch (e) {
    }
  }
  const user = toPublicUser(row);
  setAuthCookie(res, signToken(user));
  const csrfToken = crypto4.randomBytes(24).toString("base64url");
  setCsrfCookie(res, csrfToken);
  await auditRepository.log(pool, user.id, "authentication_login", "security", `Authenticated role ${user.role}.`);
  res.json({ user, csrfToken });
}));
app.post("/api/auth/reset-password/complete", rateLimitResetPassword, validateBody(schemas.completePasswordReset), asyncHandler(async (req, res) => {
  const tokenHash = sha256Hex2(req.body.token);
  const credential3 = hashPassword(req.body.newPassword);
  const client2 = await pool.connect();
  let userId = "";
  try {
    await client2.query("BEGIN");
    const resetToken = (await client2.query(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    )).rows[0];
    if (!resetToken || resetToken.used_at || new Date(resetToken.expires_at).getTime() <= Date.now()) {
      await client2.query("ROLLBACK");
      return res.status(400).json({ error: "Li\xEAn k\u1EBFt \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n." });
    }
    userId = resetToken.user_id;
    await client2.query(
      "UPDATE users SET password_hash = $1, password_salt = $2, must_change_password = false WHERE id = $3",
      [credential3.hash, credential3.salt, userId]
    );
    await client2.query(
      "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1",
      [resetToken.id]
    );
    await client2.query("COMMIT");
  } catch (error) {
    await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
  await auditRepository.log(pool, userId, "password_reset_token_used", "security", "User completed one-time password reset.");
  res.json({ ok: true, message: "M\u1EADt kh\u1EA9u \u0111\xE3 \u0111\u01B0\u1EE3c \u0111\u1EB7t l\u1EA1i th\xE0nh c\xF4ng. B\u1EA1n c\xF3 th\u1EC3 \u0111\u0103ng nh\u1EADp b\u1EB1ng m\u1EADt kh\u1EA9u m\u1EDBi." });
}));
var ACCOUNT_REQUEST_MESSAGE = "N\u1EBFu email h\u1EE3p l\u1EC7, th\xF4ng tin \u0111\u0103ng nh\u1EADp \u0111\xE3 \u0111\u01B0\u1EE3c g\u1EEDi t\u1EDBi h\u1ED9p th\u01B0 c\u1EE7a b\u1EA1n. Vui l\xF2ng ki\u1EC3m tra c\u1EA3 th\u01B0 m\u1EE5c Spam.";
app.post("/api/auth/register", rateLimitRegister, validateBody(schemas.selfRegister), asyncHandler(async (req, res) => {
  const existing = await usersRepository.findAuthByEmail(pool, req.body.email);
  if (existing) {
    void sendAccountExistsEmail(pool, existing.id, { to: existing.email, name: existing.name, loginUrl: lmsBaseUrl(req) }).catch((err) => console.error("[register] failed to send account-exists email:", err));
    return res.status(202).json({ ok: true, message: ACCOUNT_REQUEST_MESSAGE });
  }
  const result = await createStudentWithTemporaryPassword(
    { name: req.body.name, email: req.body.email, phone: req.body.phone },
    "self",
    lmsBaseUrl(req)
  );
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  invalidateStoreCache();
  await auditRepository.log(pool, result.user.id, "self_register", "security", `Self sign-up with personal email ${result.user.email}.`);
  const hasSmtp = hasSmtpConfig();
  res.status(202).json({
    ok: true,
    message: ACCOUNT_REQUEST_MESSAGE,
    ...!hasSmtp ? { devTemporaryPassword: result.temporaryPassword } : {}
  });
}));
app.post("/api/auth/forgot-password", rateLimitForgotPassword, validateBody(schemas.forgotPassword), asyncHandler(async (req, res) => {
  const row = await usersRepository.findAuthByEmail(pool, req.body.email);
  if (row && row.is_active) {
    void (async () => {
      const { resetToken, expiresAt } = await issuePasswordResetToken(row.id, null);
      await sendPasswordResetLinkEmail(pool, row.id, { to: row.email, name: row.name, resetUrl: passwordResetUrl(req, resetToken), expiresAt });
      await auditRepository.log(pool, row.id, "forgot_password_link_sent", "security", "User requested a password reset link.");
    })().catch((err) => console.error("[forgot-password] failed:", err));
  }
  res.json({ ok: true, message: "N\u1EBFu email c\xF3 trong h\u1EC7 th\u1ED1ng, li\xEAn k\u1EBFt \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u \u0111\xE3 \u0111\u01B0\u1EE3c g\u1EEDi t\u1EDBi h\u1ED9p th\u01B0 c\u1EE7a b\u1EA1n." });
}));
app.post("/api/auth/logout", requireAuth, asyncHandler(async (req, res) => {
  const token = extractBearerToken(req);
  if (token) await safeRedis(() => redis.set(`revoked:${token}`, "1", "EX", 60 * 60 * 8), "OK");
  await audit(req, "authentication_logout", "security", "Session closed.");
  clearAuthCookie(res);
  res.status(204).send();
}));
app.get("/api/auth/me", requireAuth, (req, res) => {
  const cookieToken = extractCookie(req, "mcna_lms_csrf") || extractCookie(req, "e16_lms_csrf");
  let csrfToken = cookieToken;
  if (!csrfToken) {
    csrfToken = crypto4.randomBytes(24).toString("base64url");
    setCsrfCookie(res, csrfToken);
  }
  res.json({
    user: req.user ? {
      ...req.user,
      school_email: req.user.schoolEmail,
      email_provisioned: req.user.emailProvisioned,
      email_provisioned_at: req.user.emailProvisionedAt
    } : null,
    csrfToken
  });
});
app.post("/api/users/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp \u0111\u1EA7y \u0111\u1EE7 m\u1EADt kh\u1EA9u c\u0169 v\xE0 m\u1EDBi." });
  if (String(newPassword).length < 8) return res.status(400).json({ error: "M\u1EADt kh\u1EA9u m\u1EDBi ph\u1EA3i c\xF3 t\u1ED1i thi\u1EC3u 8 k\xFD t\u1EF1." });
  if (newPassword === currentPassword) return res.status(400).json({ error: "M\u1EADt kh\u1EA9u m\u1EDBi ph\u1EA3i kh\xE1c m\u1EADt kh\u1EA9u hi\u1EC7n t\u1EA1i." });
  const row = await usersRepository.findAuthByEmail(pool, req.user.email);
  if (!row || !verifyPassword(currentPassword, row.password_hash, row.password_salt || void 0)) {
    return res.status(401).json({ error: "M\u1EADt kh\u1EA9u hi\u1EC7n t\u1EA1i kh\xF4ng ch\xEDnh x\xE1c." });
  }
  const credential3 = hashPassword(newPassword);
  await pool.query(
    "UPDATE users SET password_hash = $1, password_salt = $2, must_change_password = false WHERE id = $3",
    [credential3.hash, credential3.salt, req.user.id]
  );
  await audit(req, "change_password", req.user.id, "User updated their account password.");
  res.json({ ok: true, message: "\u0110\u1ED5i m\u1EADt kh\u1EA9u th\xE0nh c\xF4ng!" });
}));
app.get("/api/store", requireAuth, asyncHandler(async (req, res) => {
  try {
    if (isDevMockDb) {
      const store = devMockStore || getInitialStore();
      const limited2 = limitStoreForRole(store, req.user);
      return res.json(limited2);
    }
    const snapshot = await storeSnapshotFromDb(pool);
    const limited = limitStoreForRole(snapshot, req.user);
    res.json(limited);
  } catch (err) {
    console.error("[/api/store error]", err);
    res.status(500).json({ error: err.message || "Internal server error", stack: err.stack });
  }
}));
app.get("/api/dashboard/admin", requireAuth, requireRole(["manager", "admin"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store2 = devMockStore || getInitialStore();
    return res.json({ ...dashboardFromStore(store2, req.user), auditLogs: [] });
  }
  const store = await storeSnapshotFromDb(pool);
  res.json({ ...dashboardFromStore(store, req.user), auditLogs: await auditRepository.listRecent(pool, 100) });
}));
app.get("/api/dashboard/teacher", requireAuth, requireRole(["teacher"]), asyncHandler(async (req, res) => {
  const store = isDevMockDb ? devMockStore || getInitialStore() : await storeSnapshotFromDb(pool);
  res.json(dashboardFromStore(store, req.user));
}));
app.get("/api/dashboard/student", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  const store = isDevMockDb ? devMockStore || getInitialStore() : await storeSnapshotFromDb(pool);
  res.json(dashboardFromStore(store, req.user));
}));
var reportFiltersFromRequest = (req) => ({
  courseId: typeof req.query.courseId === "string" ? req.query.courseId : void 0,
  sectionId: typeof req.query.sectionId === "string" ? req.query.sectionId : void 0,
  from: typeof req.query.from === "string" ? req.query.from : void 0,
  to: typeof req.query.to === "string" ? req.query.to : void 0,
  search: typeof req.query.search === "string" ? req.query.search.trim() : void 0
});
var attendanceReportHeaders = [
  "H\u1ECD t\xEAn",
  "Email",
  "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i",
  "Kh\xF3a h\u1ECDc",
  "M\xE3 l\u1EDBp",
  "T\u1ED5ng bu\u1ED5i",
  "C\xF3 m\u1EB7t",
  "\u0110i mu\u1ED9n",
  "V\u1EAFng",
  "C\xF3 ph\xE9p",
  "T\u1EF7 l\u1EC7 chuy\xEAn c\u1EA7n (%)"
];
var attendanceReportKeys = [
  "studentName",
  "studentEmail",
  "studentPhone",
  "courseTitle",
  "sectionCode",
  "totalSessions",
  "presentSessions",
  "lateSessions",
  "absentSessions",
  "excusedSessions",
  "attendancePercent"
];
var gradebookReportHeaders = [
  "H\u1ECD t\xEAn",
  "Email",
  "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i",
  "Kh\xF3a h\u1ECDc",
  "M\xE3 l\u1EDBp",
  "B\xE0i \u0111\xE3 ho\xE0n th\xE0nh",
  "T\u1ED5ng b\xE0i",
  "\u0110i\u1EC3m b\xE0i t\u1EADp (%)",
  "\u0110i\u1EC3m quiz (%)",
  "\u0110i\u1EC3m t\u1ED5ng (%)",
  "X\u1EBFp lo\u1EA1i",
  "\u0110i\u1EC3m h\u1EC7 4"
];
var gradebookReportKeys = [
  "studentName",
  "studentEmail",
  "studentPhone",
  "courseTitle",
  "sectionCode",
  "completedLessons",
  "totalLessons",
  "assignmentPercent",
  "quizPercent",
  "finalPercent",
  "letterGrade",
  "gradePoint"
];
async function sendReport(res, name, headers, rows, keys, format) {
  const dateLabel = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${name}-${dateLabel}.csv"`);
    return res.send(toCsv(headers, rows, keys));
  }
  const workbook = await toXlsx(name, headers, rows, keys);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${name}-${dateLabel}.xlsx"`);
  return res.send(workbook);
}
app.get("/api/reports/attendance.csv", requireAuth, requireRole(["teacher", "admin", "manager"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) return sendReport(res, "bao-cao-diem-danh", attendanceReportHeaders, [], attendanceReportKeys, "csv");
  const rows = await getAttendanceReportRows(pool, req.user, reportFiltersFromRequest(req));
  await audit(req, "export_attendance_report", req.query.sectionId?.toString() || req.query.courseId?.toString() || "all", `rows=${rows.length}`);
  return sendReport(res, "bao-cao-diem-danh", attendanceReportHeaders, rows, attendanceReportKeys, "csv");
}));
app.get("/api/reports/attendance.xlsx", requireAuth, requireRole(["teacher", "admin", "manager"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) return sendReport(res, "bao-cao-diem-danh", attendanceReportHeaders, [], attendanceReportKeys, "xlsx");
  const rows = await getAttendanceReportRows(pool, req.user, reportFiltersFromRequest(req));
  await audit(req, "export_attendance_report_xlsx", req.query.sectionId?.toString() || req.query.courseId?.toString() || "all", `rows=${rows.length}`);
  return sendReport(res, "bao-cao-diem-danh", attendanceReportHeaders, rows, attendanceReportKeys, "xlsx");
}));
app.get("/api/reports/gradebook.csv", requireAuth, requireRole(["teacher", "admin", "manager"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) return sendReport(res, "so-diem-tong-hop", gradebookReportHeaders, [], gradebookReportKeys, "csv");
  const rows = await getGradebookReportRows(pool, req.user, reportFiltersFromRequest(req));
  await audit(req, "export_gradebook_report", req.query.sectionId?.toString() || req.query.courseId?.toString() || "all", `rows=${rows.length}`);
  return sendReport(res, "so-diem-tong-hop", gradebookReportHeaders, rows, gradebookReportKeys, "csv");
}));
app.get("/api/reports/gradebook.xlsx", requireAuth, requireRole(["teacher", "admin", "manager"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) return sendReport(res, "so-diem-tong-hop", gradebookReportHeaders, [], gradebookReportKeys, "xlsx");
  const rows = await getGradebookReportRows(pool, req.user, reportFiltersFromRequest(req));
  await audit(req, "export_gradebook_report_xlsx", req.query.sectionId?.toString() || req.query.courseId?.toString() || "all", `rows=${rows.length}`);
  return sendReport(res, "so-diem-tong-hop", gradebookReportHeaders, rows, gradebookReportKeys, "xlsx");
}));
app.get("/api/admin/operations/summary", requireAuth, requireRole(["teacher", "admin", "manager"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    return res.json({
      pendingEnrollments: (store.enrollments || []).filter((item) => item.status === "pending" || item.status === "pending_payment").length,
      ungradedSubmissions: (store.submissions || []).filter((item) => item.score === void 0 || item.score === null).length,
      pendingCourses: (store.courses || []).filter((item) => item.status === "pending").length,
      attendanceRisks: 0,
      crmFailures: 0,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  const teacherFilter = req.user.role === "teacher" ? "AND EXISTS (SELECT 1 FROM course_sections cs WHERE cs.course_id = e.course_id AND cs.teacher_id = $1)" : "";
  const params = req.user.role === "teacher" ? [req.user.id] : [];
  const teacherCourseFilter = req.user.role === "teacher" ? "AND teacher_id = $1" : "";
  const [enrollment, ungraded, pendingCourses, crmFailures] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM enrollments e WHERE e.status IN ('pending', 'pending_payment') ${teacherFilter}`, params),
    pool.query(`SELECT COUNT(*)::int AS count FROM submissions s JOIN assignments a ON a.id = s.assignment_id ${req.user.role === "teacher" ? "JOIN courses c ON c.id = a.course_id" : ""} WHERE s.score IS NULL ${req.user.role === "teacher" ? "AND c.teacher_id = $1" : ""}`, params),
    pool.query(`SELECT COUNT(*)::int AS count FROM courses WHERE status = 'pending' ${teacherCourseFilter}`, params),
    pool.query("SELECT COUNT(*)::int AS count FROM crm_outbox WHERE status = 'failed'")
  ]);
  return res.json({
    pendingEnrollments: Number(enrollment.rows[0]?.count || 0),
    ungradedSubmissions: Number(ungraded.rows[0]?.count || 0),
    pendingCourses: Number(pendingCourses.rows[0]?.count || 0),
    attendanceRisks: 0,
    crmFailures: Number(crmFailures.rows[0]?.count || 0),
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}));
var PUBLIC_COURSE_SELECT = `
  SELECT c.*, u.name AS teacher_name,
         (SELECT COUNT(*) FROM course_sections cs WHERE cs.course_id = c.id AND cs.status = 'open')::int AS open_section_count
  FROM courses c
  LEFT JOIN users u ON u.id = c.teacher_id`;
async function listOpenSectionRows(courseIds) {
  if (courseIds.length === 0) return [];
  return (await pool.query(
    `SELECT cs.*, u.name AS teacher_name,
            (SELECT COUNT(*) FROM course_registrations cr WHERE cr.section_id = cs.id AND cr.status = 'registered')::int AS registered_count
     FROM course_sections cs
     LEFT JOIN users u ON u.id = cs.teacher_id
     WHERE cs.course_id = ANY($1) AND cs.status = 'open'
     ORDER BY cs.opening_date NULLS LAST, cs.section_code`,
    [courseIds]
  )).rows;
}
app.get("/api/public/courses", rateLimitPublicCatalog, asyncHandler(async (_req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    return res.json(store.courses.filter((c) => c.status === "published").map((c) => {
      const teacher = (store.users || []).find((u) => u.id === c.teacherId);
      const openSections = (store.courseSections || []).filter((s) => s.courseId === c.id && s.status !== "cancelled");
      const lessonCount = (store.lessons || []).filter((l) => l.courseId === c.id).length;
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        price: c.price,
        level: c.level,
        thumbnail: c.thumbnail,
        tags: c.tags,
        teacherName: teacher?.name,
        numberOfLessons: lessonCount,
        openSectionCount: openSections.length
      };
    }));
  }
  const rows = (await pool.query(`${PUBLIC_COURSE_SELECT} WHERE c.status = 'published' ORDER BY c.created_at DESC`)).rows;
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json(rows.map(publicCourseFromRow));
}));
app.get("/api/public/courses/:id", rateLimitPublicCatalog, asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const course = store.courses.find((c) => c.id === req.params.id);
    if (!course) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y kh\xF3a h\u1ECDc." });
    const teacher = (store.users || []).find((u) => u.id === course.teacherId);
    const courseSections = (store.courseSections || []).filter((s) => s.courseId === course.id && s.status !== "cancelled");
    const lessonRows2 = (store.lessons || []).filter((l) => l.courseId === course.id);
    const toDateText = (value) => value instanceof Date ? value.toISOString() : value ? String(value) : void 0;
    return res.json({
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        category: course.category,
        price: course.price,
        level: course.level,
        thumbnail: course.thumbnail,
        tags: course.tags,
        teacherName: teacher?.name,
        numberOfLessons: lessonRows2.length,
        openSectionCount: courseSections.length
      },
      sections: courseSections.map((s) => {
        const regCount = (store.courseRegistrations || []).filter((r) => r.sectionId === s.id && r.status === "registered").length;
        const maxStudents = typeof s.maxStudents === "number" ? s.maxStudents : 30;
        const sectionSessions = (store.attendanceSessions || []).filter(
          (sess) => sess.sectionId && sess.sectionId === s.id || !sess.sectionId && sess.courseId === course.id
        );
        const secTeacher = s.teacherName || (s.teacherId ? (store.users || []).find((u) => u.id === s.teacherId)?.name : teacher?.name);
        return {
          id: s.id,
          sectionCode: s.sectionCode,
          teacherName: secTeacher,
          maxStudents,
          seatsLeft: Math.max(0, maxStudents - regCount),
          schedule: s.schedule || [],
          openingDate: s.openingDate,
          numberOfSessions: s.numberOfSessions || sectionSessions.length,
          sessions: sectionSessions.map((sess) => ({
            id: sess.id,
            topic: sess.topic || sess.title || "Bu\u1ED5i h\u1ECDc",
            date: toDateText(sess.date)
          }))
        };
      }),
      lessons: lessonRows2.map((l, idx) => ({
        id: l.id,
        title: l.title,
        duration: l.duration || "45m",
        order: l.lesson_order ?? l.order ?? idx + 1
      }))
    });
  }
  const courseRow = (await pool.query(`${PUBLIC_COURSE_SELECT} WHERE c.status = 'published' AND c.id = $1`, [req.params.id])).rows[0];
  if (!courseRow) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y kh\xF3a h\u1ECDc." });
  const sectionRows = await listOpenSectionRows([courseRow.id]);
  const sessionRows = sectionRows.length ? (await pool.query("SELECT * FROM attendance_sessions WHERE section_id = ANY($1)", [sectionRows.map((row) => row.id)])).rows : [];
  const lessonRows = (await pool.query(
    "SELECT id, title, duration, lesson_order FROM lessons WHERE course_id = $1 ORDER BY lesson_order ASC",
    [courseRow.id]
  )).rows;
  res.setHeader("Cache-Control", "public, max-age=30");
  res.json({
    course: publicCourseFromRow(courseRow),
    sections: sectionRows.map((row) => publicCourseSectionFromRow(row, sessionRows.filter((session) => session.section_id === row.id))),
    lessons: lessonRows.map((l) => ({ id: l.id, title: l.title, duration: l.duration, order: l.lesson_order }))
  });
}));
function requireCrmIntegration(req, res, next) {
  const apiKey = process.env.CRM_API_KEY;
  const secret = process.env.CRM_INBOUND_SECRET;
  if (!apiKey || !secret) return res.status(503).json({ error: "CRM integration is not configured." });
  const authorization = req.header("Authorization") || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const keyMatches = crypto4.timingSafeEqual(
    crypto4.createHash("sha256").update(provided).digest(),
    crypto4.createHash("sha256").update(apiKey).digest()
  );
  if (!provided || !keyMatches) return res.status(401).json({ error: "Invalid CRM API key." });
  const configuredTolerance = Number(process.env.CRM_SIGNATURE_TOLERANCE_SECONDS || 300);
  const signatureFailure = verifyCrmSignature(
    secret,
    req.header("X-CRM-Timestamp"),
    req.header("X-CRM-Signature"),
    req.rawBody || "",
    Number.isFinite(configuredTolerance) && configuredTolerance > 0 ? configuredTolerance : 300
  );
  if (signatureFailure) return res.status(signatureFailure.status).json({ error: signatureFailure.error });
  next();
}
async function runIdempotentCrmCall(req, res, type, handler2) {
  const eventId = req.header("X-CRM-Event-Id");
  if (!eventId || eventId.length > 200) return res.status(400).json({ error: "X-CRM-Event-Id header is required (max 200 characters)." });
  const payloadHash = sha256Hex2(req.rawBody || "");
  const claimed = await pool.query(
    "INSERT INTO crm_inbound_events (event_id, type, payload_sha256) VALUES ($1, $2, $3) ON CONFLICT (event_id) DO NOTHING RETURNING event_id",
    [eventId, type, payloadHash]
  );
  if (!claimed.rowCount) {
    const existing = (await pool.query("SELECT * FROM crm_inbound_events WHERE event_id = $1", [eventId])).rows[0];
    if (existing.type !== type || existing.payload_sha256 !== payloadHash) {
      return res.status(409).json({ error: "X-CRM-Event-Id was already used for a different request." });
    }
    if (existing.status === "processed" && existing.response) {
      res.setHeader("X-Idempotent-Replay", "true");
      return res.status(existing.response.status).json(existing.response.body);
    }
    const retry = await pool.query(
      "UPDATE crm_inbound_events SET status = 'processing', error = NULL WHERE event_id = $1 AND status = 'failed' RETURNING event_id",
      [eventId]
    );
    if (!retry.rowCount) return res.status(409).json({ error: "This event is still being processed." });
  }
  let result;
  try {
    result = await handler2();
  } catch (error) {
    await pool.query(
      "UPDATE crm_inbound_events SET status = 'failed', error = $2, processed_at = NOW() WHERE event_id = $1",
      [eventId, String(error?.message || error).slice(0, 1e3)]
    );
    throw error;
  }
  const temporaryFailure = result.status >= 500;
  await pool.query(
    "UPDATE crm_inbound_events SET status = $2, response = $3, error = $4, processed_at = NOW() WHERE event_id = $1",
    [eventId, temporaryFailure ? "failed" : "processed", JSON.stringify(result), temporaryFailure ? String(result.body?.error || "") : null]
  );
  if (!temporaryFailure) invalidateStoreCache();
  return res.status(result.status).json(result.body);
}
async function findCrmStudentId(input) {
  if (input.crmContactId) {
    const row = (await pool.query("SELECT id FROM users WHERE crm_contact_id = $1 AND role = 'student'", [input.crmContactId])).rows[0];
    if (row) return row.id;
  }
  if (input.email) {
    const row = await usersRepository.findAuthByEmail(pool, input.email);
    if (row?.role === "student") return row.id;
  }
  return null;
}
app.get("/api/integrations/crm/courses", rateLimitCrmIntegration, requireCrmIntegration, asyncHandler(async (_req, res) => {
  const courseRows = (await pool.query(`${PUBLIC_COURSE_SELECT} WHERE c.status = 'published' ORDER BY c.created_at DESC`)).rows;
  const sectionRows = await listOpenSectionRows(courseRows.map((row) => row.id));
  res.json({
    courses: courseRows.map((row) => ({
      ...publicCourseFromRow(row),
      sections: sectionRows.filter((section) => section.course_id === row.id).map((section) => {
        const { sessions, ...summary } = publicCourseSectionFromRow(section, []);
        return summary;
      })
    }))
  });
}));
app.post("/api/integrations/crm/students", rateLimitCrmIntegration, requireCrmIntegration, validateBody(schemas.crmUpsertStudent), asyncHandler(async (req, res) => {
  await runIdempotentCrmCall(req, res, "students.upsert", async () => {
    const { crmContactId, name, email, phone } = req.body;
    const linked = (await pool.query("SELECT id, email FROM users WHERE crm_contact_id = $1", [crmContactId])).rows[0];
    if (linked) return { status: 200, body: { lmsUserId: linked.id, email: linked.email, created: false } };
    const existing = await usersRepository.findAuthByEmail(pool, email);
    if (existing) {
      if (existing.role !== "student") return { status: 409, body: { error: "Email belongs to a non-student account." } };
      if (existing.crm_contact_id) return { status: 409, body: { error: "Email is already linked to another CRM contact." } };
      await pool.query("UPDATE users SET crm_contact_id = $1 WHERE id = $2", [crmContactId, existing.id]);
      return { status: 200, body: { lmsUserId: existing.id, email: existing.email, created: false } };
    }
    const result = await createStudentWithTemporaryPassword({ name, email, phone, crmContactId }, "crm", lmsBaseUrl(req));
    if (isServiceError(result)) return { status: result.status, body: { error: result.error } };
    await auditRepository.log(pool, result.user.id, "crm_create_student", "security", `Created from CRM contact ${crmContactId}.`);
    return { status: 201, body: { lmsUserId: result.user.id, email: result.user.email, created: true } };
  });
}));
app.post("/api/integrations/crm/enrollments", rateLimitCrmIntegration, requireCrmIntegration, validateBody(schemas.crmCreateEnrollment), asyncHandler(async (req, res) => {
  await runIdempotentCrmCall(req, res, "enrollments.create", async () => {
    const studentId = await findCrmStudentId(req.body);
    if (!studentId) return { status: 404, body: { error: "No student account found for this CRM contact or email." } };
    const result = await requestEnrollment({
      studentId,
      courseId: req.body.courseId,
      sectionId: req.body.sectionId,
      origin: "crm",
      crmDealId: req.body.crmDealId
    });
    if (isServiceError(result)) {
      if (result.status !== 409) return { status: result.status, body: { error: result.error } };
      const current = (await pool.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 ORDER BY enrolled_at DESC LIMIT 1",
        [studentId, req.body.courseId]
      )).rows[0];
      return { status: 409, body: { error: result.error, enrollmentId: current?.id || null } };
    }
    return {
      status: 201,
      body: {
        enrollmentId: result.enrollment.id,
        status: result.enrollment.status,
        transactionId: result.transactionId || null,
        requestedSectionId: result.enrollment.requestedSectionId || null
      }
    };
  });
}));
app.post("/api/integrations/crm/payments/confirm", rateLimitCrmIntegration, requireCrmIntegration, validateBody(schemas.crmConfirmPayment), asyncHandler(async (req, res) => {
  await runIdempotentCrmCall(req, res, "payments.confirm", async () => {
    const enrollmentRow = req.body.enrollmentId ? (await pool.query("SELECT * FROM enrollments WHERE id = $1", [req.body.enrollmentId])).rows[0] : (await pool.query("SELECT * FROM enrollments WHERE crm_deal_id = $1 ORDER BY enrolled_at DESC LIMIT 1", [req.body.crmDealId])).rows[0];
    if (!enrollmentRow) return { status: 404, body: { error: "Enrollment not found." } };
    let transactionId = null;
    let placedSectionId = null;
    let placementError = null;
    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");
      const payment = await confirmCoursePayment(
        client2,
        enrollmentRow.id,
        { amount: req.body.amount, reference: req.body.reference, paidAt: req.body.paidAt },
        "crm"
      );
      if (isServiceError(payment)) {
        await client2.query("ROLLBACK");
        return { status: payment.status, body: { error: payment.error } };
      }
      transactionId = payment.transactionId;
      const sectionId = req.body.sectionId || enrollmentRow.requested_section_id;
      if (sectionId && !["active", "completed"].includes(enrollmentRow.status)) {
        await client2.query("SAVEPOINT placement");
        const placement = await placeEnrollment(client2, enrollmentRow.id, sectionId, "crm");
        if (isServiceError(placement)) {
          await client2.query("ROLLBACK TO SAVEPOINT placement");
          placementError = placement.error;
        } else {
          placedSectionId = sectionId;
        }
      }
      await client2.query("COMMIT");
    } catch (error) {
      await client2.query("ROLLBACK");
      throw error;
    } finally {
      client2.release();
    }
    if (placedSectionId) {
      await notificationsRepository.create(pool, {
        userId: enrollmentRow.student_id,
        type: "success",
        message: "Thanh to\xE1n c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c x\xE1c nh\u1EADn v\xE0 b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c x\u1EBFp v\xE0o l\u1EDBp h\u1ECDc."
      });
    }
    const current = (await pool.query("SELECT status FROM enrollments WHERE id = $1", [enrollmentRow.id])).rows[0];
    return {
      status: 200,
      body: { enrollmentId: enrollmentRow.id, status: current?.status, transactionId, placedSectionId, placementError }
    };
  });
}));
app.get("/api/courses", requireAuth, asyncHandler(async (_req, res) => res.json(await coursesRepository.list(pool))));
app.post("/api/courses", requireAuth, requireRole(["admin"]), validateBody(schemas.createCourse), asyncHandler(async (req, res) => {
  const body = req.body;
  const course = await coursesRepository.create(pool, {
    title: body.title,
    description: body.description,
    teacherId: body.teacherId || req.user.id,
    status: "published",
    category: body.category,
    thumbnail: body.thumbnail,
    price: body.price,
    originalPrice: body.originalPrice ?? void 0,
    level: body.level,
    tags: body.tags,
    openingDate: body.openingDate,
    numberOfLessons: body.numberOfLessons
  });
  await ensureCourseLessonsForSchedule(pool, course.id, body.numberOfLessons, [], body.openingDate);
  invalidateStoreCache();
  await audit(req, "create_course", course.id, course.title);
  res.status(201).json(course);
}));
app.put("/api/courses/:id", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.createCourse), asyncHandler(async (req, res) => {
  const existing = await coursesRepository.findById(pool, req.params.id);
  if (!existing) return res.status(404).json({ error: "Course not found." });
  const body = req.body;
  if (req.user.role === "teacher") {
    if (existing.teacherId !== req.user.id) {
      return res.status(403).json({ error: "Permission denied." });
    }
    const updated2 = await coursesRepository.updateDetails(pool, req.params.id, {
      title: existing.title,
      description: existing.description,
      category: existing.category,
      thumbnail: existing.thumbnail,
      price: existing.price,
      originalPrice: existing.originalPrice,
      level: existing.level,
      tags: existing.tags,
      openingDate: existing.openingDate,
      numberOfLessons: body.numberOfLessons
    });
    await ensureCourseLessonsForSchedule(pool, req.params.id, body.numberOfLessons, [], existing.openingDate);
    invalidateStoreCache();
    await audit(req, "update_course_lessons_count", req.params.id, `Lessons: ${body.numberOfLessons}`);
    return res.json(updated2);
  }
  const updated = await coursesRepository.updateDetails(pool, req.params.id, {
    title: body.title,
    description: body.description,
    category: body.category,
    thumbnail: body.thumbnail,
    price: body.price,
    originalPrice: body.originalPrice ?? void 0,
    level: body.level,
    tags: body.tags,
    openingDate: body.openingDate,
    numberOfLessons: body.numberOfLessons
  });
  await ensureCourseLessonsForSchedule(pool, req.params.id, body.numberOfLessons, [], body.openingDate);
  invalidateStoreCache();
  await audit(req, "update_course", req.params.id, body.title);
  res.json(updated);
}));
app.post("/api/courses/:id/submit", requireAuth, requireRole(["teacher", "manager", "admin"]), asyncHandler(async (req, res) => {
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, req.params.id)) return res.status(403).json({ error: "Permission denied." });
  const nextStatus = req.user.role === "teacher" ? "pending" : "published";
  const course = await coursesRepository.setStatus(pool, req.params.id, nextStatus);
  if (!course) return res.status(404).json({ error: "Course not found." });
  invalidateStoreCache();
  await audit(req, req.user.role === "teacher" ? "submit_course_for_review" : "publish_course_direct", course.id, course.title);
  if (nextStatus === "pending") {
    const teacherName = req.user.name || "Gi\xE1o vi\xEAn";
    const message = `Gi\u1EA3ng vi\xEAn ${teacherName} \u0111\xE3 g\u1EEDi y\xEAu c\u1EA7u ph\xEA duy\u1EC7t kh\xF3a h\u1ECDc m\u1EDBi: "${course.title}".`;
    await notifyRole(pool, "admin", message, { relatedEntityType: "course", relatedEntityId: course.id });
  }
  res.json(course);
}));
app.post("/api/courses/:id/publish", requireAuth, requireRole(["admin"]), asyncHandler(async (req, res) => {
  const course = await coursesRepository.setStatus(pool, req.params.id, "published");
  if (!course) return res.status(404).json({ error: "Course not found." });
  invalidateStoreCache();
  await audit(req, "approve_course", course.id, course.title);
  if (course.teacherId) {
    const message = `Kh\xF3a h\u1ECDc "${course.title}" c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c ph\xEA duy\u1EC7t v\xE0 xu\u1EA5t b\u1EA3n.`;
    await notifyStudent(pool, course.teacherId, message, { relatedEntityType: "course", relatedEntityId: course.id });
  }
  res.json(course);
}));
app.post("/api/courses/:id/reject", requireAuth, requireRole(["manager", "admin"]), validateBody(schemas.rejectCourse), asyncHandler(async (req, res) => {
  const course = await coursesRepository.setStatus(pool, req.params.id, "rejected", req.body.rejectionReason);
  if (!course) return res.status(404).json({ error: "Course not found." });
  invalidateStoreCache();
  await audit(req, "reject_course", course.id, req.body.rejectionReason);
  if (course.teacherId) {
    const message = `Kh\xF3a h\u1ECDc "${course.title}" c\u1EE7a b\u1EA1n \u0111\xE3 b\u1ECB t\u1EEB ch\u1ED1i ph\xEA duy\u1EC7t. L\xFD do: ${req.body.rejectionReason}`;
    await notifyStudent(pool, course.teacherId, message, { relatedEntityType: "course", relatedEntityId: course.id });
  }
  res.json(course);
}));
app.delete("/api/courses/:id", requireAuth, requireRole(["manager", "admin"]), asyncHandler(async (req, res) => {
  const courseId2 = req.params.id;
  const enrollmentsCountRes = await pool.query("SELECT COUNT(*) AS count FROM enrollments WHERE course_id = $1 AND status = 'active'", [courseId2]);
  const enrollmentsCount = Number(enrollmentsCountRes.rows[0].count);
  if (enrollmentsCount > 0) {
    return res.status(400).json({ error: "Kh\xF4ng th\u1EC3 x\xF3a kh\xF3a h\u1ECDc \u0111ang c\xF3 sinh vi\xEAn tham gia h\u1ECDc t\u1EADp th\u1EF1c t\u1EBF." });
  }
  const client2 = await pool.connect();
  try {
    await client2.query("BEGIN");
    await client2.query(
      `DELETE FROM forum_replies
       WHERE post_id IN (SELECT id FROM forum_posts WHERE course_id = $1)`,
      [courseId2]
    );
    await client2.query("DELETE FROM forum_posts WHERE course_id = $1", [courseId2]);
    await client2.query(
      `DELETE FROM lesson_progress
       WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = $1)`,
      [courseId2]
    );
    await client2.query("DELETE FROM lessons WHERE course_id = $1", [courseId2]);
    await client2.query(
      `DELETE FROM quiz_attempts
       WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = $1)`,
      [courseId2]
    );
    await client2.query(
      `DELETE FROM questions
       WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = $1)`,
      [courseId2]
    );
    await client2.query("DELETE FROM quizzes WHERE course_id = $1", [courseId2]);
    await client2.query(
      `DELETE FROM submissions
       WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = $1)`,
      [courseId2]
    );
    await client2.query("DELETE FROM assignments WHERE course_id = $1", [courseId2]);
    await client2.query("DELETE FROM transactions WHERE course_id = $1", [courseId2]);
    await client2.query("DELETE FROM certificates WHERE course_id = $1", [courseId2]);
    await client2.query("DELETE FROM course_sections WHERE course_id = $1", [courseId2]);
    await client2.query("DELETE FROM enrollments WHERE course_id = $1", [courseId2]);
    await client2.query("DELETE FROM courses WHERE id = $1", [courseId2]);
    await client2.query("COMMIT");
  } catch (err) {
    await client2.query("ROLLBACK");
    throw err;
  } finally {
    client2.release();
  }
  await audit(req, "delete_course", courseId2, "Successfully performed cascading delete on course and related assets.");
  res.json({ ok: true });
}));
app.post("/api/lessons", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.addLesson), asyncHandler(async (req, res) => {
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, req.body.courseId)) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const lesson = await coursesRepository.addLesson(pool, req.body);
  invalidateStoreCache();
  await audit(req, "add_lesson", lesson.id, lesson.title);
  res.status(201).json(lesson);
}));
app.put("/api/lessons/:id", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.updateLesson), asyncHandler(async (req, res) => {
  const lessonRow = (await pool.query("SELECT course_id FROM lessons WHERE id = $1", [req.params.id])).rows[0];
  if (!lessonRow) return res.status(404).json({ error: "Lesson not found." });
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, lessonRow.course_id)) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const lesson = await coursesRepository.updateLesson(pool, req.params.id, req.body);
  if (!lesson) return res.status(404).json({ error: "Lesson not found." });
  invalidateStoreCache();
  await audit(req, "update_lesson", lesson.id, lesson.title);
  res.json(lesson);
}));
app.delete("/api/lessons/:id", requireAuth, requireRole(["teacher", "admin"]), asyncHandler(async (req, res) => {
  const lessonRes = await pool.query("SELECT * FROM lessons WHERE id = $1", [req.params.id]);
  const lessonRow = lessonRes.rows[0];
  if (!lessonRow) return res.status(404).json({ error: "Lesson not found." });
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, lessonRow.course_id)) {
    return res.status(403).json({ error: "Permission denied." });
  }
  await coursesRepository.deleteLesson(pool, req.params.id);
  invalidateStoreCache();
  await audit(req, "delete_lesson", req.params.id, lessonRow.title);
  res.json({ ok: true });
}));
app.get("/api/enrollments", requireAuth, asyncHandler(async (req, res) => res.json(await enrollmentsRepository.listForUser(pool, req.user))));
app.post("/api/enrollments/register", requireAuth, requireRole(["student"]), validateBody(schemas.registerEnrollment), asyncHandler(async (req, res) => {
  const result = await requestEnrollment({
    studentId: req.user.id,
    courseId: req.body.courseId,
    sectionId: req.body.sectionId,
    origin: "lms"
  });
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  invalidateStoreCache();
  await audit(req, "enroll_course", result.course.id, result.course.title);
  res.status(201).json(result.enrollment);
}));
app.post("/api/enrollments/:id/activate", requireAuth, requireRole(["admin"]), asyncHandler(async (req, res) => {
  const enrollmentId = req.params.id;
  const chosenSectionId = typeof req.body?.sectionId === "string" && req.body.sectionId.trim() ? req.body.sectionId.trim() : void 0;
  const client2 = await pool.connect();
  let placement;
  let studentId;
  let targetSectionId;
  try {
    await client2.query("BEGIN");
    const enrollmentRow = (await client2.query("SELECT student_id, requested_section_id FROM enrollments WHERE id = $1", [enrollmentId])).rows[0];
    if (!enrollmentRow) {
      await client2.query("ROLLBACK");
      return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n \u0111\u0103ng k\xFD." });
    }
    studentId = enrollmentRow.student_id;
    targetSectionId = chosenSectionId || enrollmentRow.requested_section_id || void 0;
    const payment = await confirmCoursePayment(client2, enrollmentId, { reference: `admin ${req.user.id}` }, "lms");
    if (isServiceError(payment)) {
      await client2.query("ROLLBACK");
      return res.status(payment.status).json({ error: payment.error });
    }
    const result = await placeEnrollment(client2, enrollmentId, targetSectionId, "lms");
    if (isServiceError(result)) {
      await client2.query("ROLLBACK");
      return res.status(result.status).json({ error: result.error });
    }
    placement = result;
    await client2.query("COMMIT");
  } catch (error) {
    await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
  invalidateStoreCache();
  await notificationsRepository.create(pool, {
    userId: studentId,
    type: "success",
    message: targetSectionId ? "\u0110\u01A1n \u0111\u0103ng k\xFD kh\xF3a h\u1ECDc c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c k\xEDch ho\u1EA1t v\xE0 x\u1EBFp v\xE0o l\u1EDBp. Ch\xFAc b\u1EA1n h\u1ECDc t\u1EADp hi\u1EC7u qu\u1EA3!" : "\u0110\u01A1n \u0111\u0103ng k\xFD kh\xF3a h\u1ECDc c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c k\xEDch ho\u1EA1t."
  });
  await audit(req, "activate_enrollment_one_click", enrollmentId, targetSectionId || "no-section");
  res.json({ success: true, enrollment: placement.enrollment, registration: placement.registration });
}));
app.patch("/api/enrollments/:id/approve", requireAuth, requireRole(["manager", "admin"]), validateBody(schemas.approveEnrollment), asyncHandler(async (req, res) => {
  const sectionId = req.body.sectionId;
  const client2 = await pool.connect();
  let placement;
  try {
    await client2.query("BEGIN");
    const result = await placeEnrollment(client2, req.params.id, sectionId, "lms");
    if (isServiceError(result)) {
      await client2.query("ROLLBACK");
      return res.status(result.status).json({ error: result.error });
    }
    placement = result;
    await client2.query("COMMIT");
  } catch (error) {
    await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
  const { enrollment, registration } = placement;
  invalidateStoreCache();
  await notificationsRepository.create(pool, {
    userId: enrollment.student_id,
    type: "success",
    message: sectionId ? "Y\xEAu c\u1EA7u \u0111\u0103ng k\xFD m\xF4n h\u1ECDc c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c duy\u1EC7t v\xE0 x\u1EBFp v\xE0o l\u1EDBp h\u1ECDc ph\u1EA7n." : "Y\xEAu c\u1EA7u \u0111\u0103ng k\xFD m\xF4n h\u1ECDc c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c duy\u1EC7t."
  });
  await audit(req, "approve_enrollment", enrollment.id, sectionId || "no-section");
  res.json({ enrollment, registration });
}));
app.post("/api/admin/enrollments/bulk-place", requireAuth, requireRole(["manager", "admin"]), asyncHandler(async (req, res) => {
  const { placements } = req.body;
  if (!Array.isArray(placements)) {
    return res.status(400).json({ error: "M\u1EA3ng danh s\xE1ch x\u1EBFp l\u1EDBp placements l\xE0 b\u1EAFt bu\u1ED9c." });
  }
  const client2 = await pool.connect();
  const results = [];
  const errors = [];
  try {
    await client2.query("BEGIN");
    const sectionCounts = /* @__PURE__ */ new Map();
    for (const [index, p] of placements.entries()) {
      let studentId = "";
      let enrollmentId = p.enrollmentId;
      let sectionId = p.sectionId;
      if (p.email) {
        const studentRow = (await client2.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [p.email]
        )).rows[0];
        if (!studentRow) {
          errors.push({ index, error: `Kh\xF4ng t\xECm th\u1EA5y h\u1ECDc vi\xEAn v\u1EDBi email: ${p.email}` });
          continue;
        }
        studentId = studentRow.id;
      }
      if (p.sectionCode && !sectionId) {
        const secRow = (await client2.query("SELECT id FROM course_sections WHERE section_code = $1", [p.sectionCode])).rows[0];
        if (!secRow) {
          errors.push({ index, error: `Kh\xF4ng t\xECm th\u1EA5y l\u1EDBp h\u1ECDc ph\u1EA7n v\u1EDBi m\xE3: ${p.sectionCode}` });
          continue;
        }
        sectionId = secRow.id;
      }
      if (!sectionId) {
        errors.push({ index, error: "Thi\u1EBFu m\xE3 l\u1EDBp h\u1ECDc ph\u1EA7n." });
        continue;
      }
      const section = (await client2.query("SELECT * FROM course_sections WHERE id = $1", [sectionId])).rows[0];
      if (!section) {
        errors.push({ index, error: `Kh\xF4ng t\xECm th\u1EA5y l\u1EDBp h\u1ECDc ph\u1EA7n ID ${sectionId}.` });
        continue;
      }
      let currentCount = sectionCounts.get(sectionId);
      if (currentCount === void 0) {
        const countRes = await client2.query(
          "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
          [sectionId]
        );
        currentCount = Number(countRes.rows[0].count);
        sectionCounts.set(sectionId, currentCount);
      }
      if (currentCount >= section.max_students) {
        errors.push({ index, error: `L\u1EDBp h\u1ECDc ph\u1EA7n ${section.section_code} \u0111\xE3 \u0111\u1EA1t s\u0129 s\u1ED1 t\u1ED1i \u0111a (${section.max_students}).` });
        continue;
      }
      if (!enrollmentId) {
        if (!studentId) {
          errors.push({ index, error: "Thi\u1EBFu th\xF4ng tin nh\u1EADn di\u1EC7n h\u1ECDc vi\xEAn." });
          continue;
        }
        const enrollRow = (await client2.query(
          "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 LIMIT 1",
          [studentId, section.course_id]
        )).rows[0];
        if (enrollRow) {
          enrollmentId = enrollRow.id;
        } else {
          const courseForPlacement = (await client2.query("SELECT price FROM courses WHERE id = $1", [section.course_id])).rows[0];
          if (Number(courseForPlacement?.price || 0) > 0) {
            errors.push({ index, error: "Payment must be confirmed before class placement." });
            continue;
          }
          enrollmentId = generateId2("enroll");
          await client2.query(
            "INSERT INTO enrollments (id, course_id, student_id, status, enrolled_at) VALUES ($1, $2, $3, 'active', $4)",
            [enrollmentId, section.course_id, studentId, (/* @__PURE__ */ new Date()).toISOString()]
          );
        }
      }
      const enrollmentRow = (await client2.query("SELECT * FROM enrollments WHERE id = $1 FOR UPDATE", [enrollmentId])).rows[0];
      if (!enrollmentRow) {
        errors.push({ index, error: "Enrollment not found for class placement." });
        continue;
      }
      if (enrollmentRow.course_id !== section.course_id) {
        errors.push({ index, error: "Enrollment does not belong to the target class course." });
        continue;
      }
      if (!await hasConfirmedPaymentForCoursePlacement(client2, enrollmentRow.student_id, enrollmentRow.course_id)) {
        errors.push({ index, error: "Payment must be confirmed before class placement." });
        continue;
      }
      await client2.query(
        "UPDATE enrollments SET status = 'active' WHERE id = $1",
        [enrollmentId]
      );
      if (!studentId) {
        const enroll = (await client2.query("SELECT student_id FROM enrollments WHERE id = $1", [enrollmentId])).rows[0];
        studentId = enroll?.student_id;
      }
      if (!studentId) {
        errors.push({ index, error: "Kh\xF4ng t\xECm th\u1EA5y th\xF4ng tin h\u1ECDc vi\xEAn c\u1EE7a l\u01B0\u1EE3t ghi danh n\xE0y." });
        continue;
      }
      const existingRegistration = (await client2.query(
        `SELECT cr.id
         FROM course_registrations cr
         JOIN course_sections cs ON cs.id = cr.section_id
         WHERE cr.student_id = $1
           AND cs.course_id = $2
           AND cr.status IN ('registered', 'waitlisted')`,
        [studentId, section.course_id]
      )).rows[0];
      if (!existingRegistration) {
        await client2.query(
          `INSERT INTO course_registrations (id, student_id, section_id, status, registered_at, credits, is_retake)
           VALUES ($1, $2, $3, 'registered', $4, $5, false)`,
          [generateId2("reg"), studentId, sectionId, (/* @__PURE__ */ new Date()).toISOString(), 3]
        );
      } else {
        await client2.query(
          "UPDATE course_registrations SET section_id = $1, status = 'registered' WHERE id = $2",
          [sectionId, existingRegistration.id]
        );
      }
      results.push({ index, enrollmentId, sectionId });
      sectionCounts.set(sectionId, currentCount + 1);
    }
    if (errors.length > 0) {
      await client2.query("ROLLBACK");
      return res.status(400).json({ error: "L\u1ED7i ki\u1EC3m tra d\u1EEF li\u1EC7u x\u1EBFp l\u1EDBp h\xE0ng lo\u1EA1t.", errors });
    }
    for (const placed of results) {
      await enqueueEnrollmentEvent(client2, "enrollment.status_changed", placed.enrollmentId);
    }
    await client2.query("COMMIT");
    invalidateStoreCache();
    res.json({ success: true, count: results.length });
  } catch (err) {
    await client2.query("ROLLBACK");
    res.status(500).json({ error: err.message || "Kh\xF4ng th\u1EC3 th\u1EF1c hi\u1EC7n x\u1EBFp l\u1EDBp h\xE0ng lo\u1EA1t." });
  } finally {
    client2.release();
  }
}));
app.post("/api/courses/:id/request-section", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  const course = await coursesRepository.findById(pool, req.params.id);
  if (!course) return res.status(404).json({ error: "Course not found." });
  const studentName = req.user.name || "H\u1ECDc vi\xEAn";
  const message = `H\u1ECDc vi\xEAn ${studentName} \u0111\xE3 g\u1EEDi y\xEAu c\u1EA7u m\u1EDF th\xEAm l\u1EDBp h\u1ECDc ph\u1EA7n cho m\xF4n h\u1ECDc: "${course.title}".`;
  await notifyRole(pool, "admin", message, { relatedEntityType: "course", relatedEntityId: course.id });
  await audit(req, "request_new_section", course.id, course.title);
  res.json({ success: true, message: "Y\xEAu c\u1EA7u m\u1EDF th\xEAm l\u1EDBp h\u1ECDc ph\u1EA7n \u0111\xE3 \u0111\u01B0\u1EE3c g\u1EEDi t\u1EDBi qu\u1EA3n tr\u1ECB vi\xEAn." });
}));
app.get("/api/public/certificates/:code", rateLimitCertificateVerify, asyncHandler(async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();
  if (!code || code.length > 80) return res.status(400).json({ error: "M\xE3 ch\u1EE9ng ch\u1EC9 kh\xF4ng h\u1EE3p l\u1EC7." });
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const cert = (store.certificates || []).find((item) => String(item.certificateCode || "").toUpperCase() === code);
    if (!cert) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ch\u1EE9ng ch\u1EC9." });
    const student = store.users.find((item) => item.id === cert.studentId);
    const course = store.courses.find((item) => item.id === cert.courseId);
    return res.json({ certificateCode: cert.certificateCode, issuedAt: cert.issuedAt, studentName: student?.name || "H\u1ECDc vi\xEAn MCNA", courseId: cert.courseId, courseTitle: course?.title || "Kh\xF3a h\u1ECDc MCNA", status: "valid" });
  }
  const row = (await pool.query(
    `SELECT cert.id, cert.certificate_code, cert.issued_at, cert.course_id, c.title AS course_title,
            u.name AS student_name
     FROM certificates cert
     JOIN courses c ON c.id = cert.course_id
     JOIN users u ON u.id = cert.student_id
     WHERE UPPER(cert.certificate_code) = $1
     LIMIT 1`,
    [code]
  )).rows[0];
  if (!row) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y ch\u1EE9ng ch\u1EC9." });
  res.setHeader("Cache-Control", "public, max-age=60");
  return res.json({
    certificateCode: row.certificate_code,
    issuedAt: row.issued_at,
    studentName: row.student_name,
    courseId: row.course_id,
    courseTitle: row.course_title,
    status: "valid"
  });
}));
app.get("/api/lessons/:lessonId/note", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const note = (store.lessonNotes || []).find((item) => item.studentId === req.user.id && item.lessonId === req.params.lessonId);
    return res.json({ note: note || null });
  }
  const row = (await pool.query(
    `SELECT ln.id, ln.student_id, ln.lesson_id, ln.course_id, ln.content, ln.created_at, ln.updated_at
     FROM lesson_notes ln
     WHERE ln.student_id = $1 AND ln.lesson_id = $2`,
    [req.user.id, req.params.lessonId]
  )).rows[0];
  return res.json({ note: row ? { id: row.id, studentId: row.student_id, lessonId: row.lesson_id, courseId: row.course_id, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at } : null });
}));
app.put("/api/lessons/:lessonId/note", requireAuth, requireRole(["student"]), validateBody(schemas.lessonNote), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const lesson2 = store.lessons.find((item) => item.id === req.params.lessonId);
    if (!lesson2) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i h\u1ECDc." });
    const enrollment2 = (store.enrollments || []).find((item) => item.studentId === req.user.id && item.courseId === lesson2.courseId && ["active", "completed"].includes(item.status));
    if (!enrollment2) return res.status(403).json({ error: "B\u1EA1n ch\u01B0a c\xF3 quy\u1EC1n ghi ch\xFA b\xE0i h\u1ECDc n\xE0y." });
    const notes = store.lessonNotes || [];
    const existing = notes.find((item) => item.studentId === req.user.id && item.lessonId === lesson2.id);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const note = existing ? { ...existing, content: req.body.content, updatedAt: now } : { id: generateId2("note"), studentId: req.user.id, lessonId: lesson2.id, courseId: lesson2.courseId, content: req.body.content, createdAt: now, updatedAt: now };
    const next = existing ? notes.map((item) => item.id === existing.id ? note : item) : [note, ...notes];
    devMockStore = { ...store, lessonNotes: next };
    return res.json({ note });
  }
  const lesson = (await pool.query("SELECT id, course_id FROM lessons WHERE id = $1", [req.params.lessonId])).rows[0];
  if (!lesson) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i h\u1ECDc." });
  const enrollment = (await pool.query(
    "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed') LIMIT 1",
    [req.user.id, lesson.course_id]
  )).rows[0];
  if (!enrollment) return res.status(403).json({ error: "B\u1EA1n ch\u01B0a c\xF3 quy\u1EC1n ghi ch\xFA b\xE0i h\u1ECDc n\xE0y." });
  const row = (await pool.query(
    `INSERT INTO lesson_notes (id, student_id, lesson_id, course_id, content)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (student_id, lesson_id) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP
     RETURNING id, student_id, lesson_id, course_id, content, created_at, updated_at`,
    [generateId2("note"), req.user.id, lesson.id, lesson.course_id, req.body.content]
  )).rows[0];
  await audit(req, "save_lesson_note", lesson.id, `length=${String(req.body.content).length}`);
  return res.json({ note: { id: row.id, studentId: row.student_id, lessonId: row.lesson_id, courseId: row.course_id, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at } });
}));
app.delete("/api/lessons/:lessonId/note", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    devMockStore = { ...store, lessonNotes: (store.lessonNotes || []).filter((item) => !(item.studentId === req.user.id && item.lessonId === req.params.lessonId)) };
    return res.status(204).send();
  }
  await pool.query("DELETE FROM lesson_notes WHERE student_id = $1 AND lesson_id = $2", [req.user.id, req.params.lessonId]);
  await audit(req, "delete_lesson_note", req.params.lessonId, "Learner note deleted");
  return res.status(204).send();
}));
app.get("/api/feedback-templates", requireAuth, requireRole(["teacher", "admin"]), asyncHandler(async (req, res) => {
  const courseId2 = typeof req.query.courseId === "string" ? req.query.courseId : null;
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    return res.json((store.feedbackTemplates || []).filter((item) => item.ownerUserId === req.user.id && item.isActive !== false && (!courseId2 || !item.courseId || item.courseId === courseId2)));
  }
  const values = [req.user.id];
  const courseFilter = courseId2 ? "AND (course_id IS NULL OR course_id = $2)" : "";
  if (courseId2) values.push(courseId2);
  const rows = (await pool.query(
    `SELECT id, owner_user_id, course_id, title, content, sort_order, is_active, created_at, updated_at
     FROM feedback_templates
     WHERE owner_user_id = $1 AND is_active = TRUE ${courseFilter}
     ORDER BY course_id NULLS FIRST, sort_order, created_at`,
    values
  )).rows;
  return res.json(rows.map((row) => ({ id: row.id, ownerUserId: row.owner_user_id, courseId: row.course_id || void 0, title: row.title, content: row.content, sortOrder: row.sort_order, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at })));
}));
app.post("/api/feedback-templates", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.feedbackTemplate), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    if (req.body.courseId) {
      const course = store.courses.find((item) => item.id === req.body.courseId);
      if (!course) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y kh\xF3a h\u1ECDc." });
      if (req.user.role === "teacher" && course.teacherId !== req.user.id) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng ph\u1EE5 tr\xE1ch kh\xF3a h\u1ECDc n\xE0y." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const template = { id: generateId2("feedback"), ownerUserId: req.user.id, courseId: req.body.courseId, title: req.body.title, content: req.body.content, sortOrder: (store.feedbackTemplates || []).length, isActive: true, createdAt: now, updatedAt: now };
    devMockStore = { ...store, feedbackTemplates: [template, ...store.feedbackTemplates || []] };
    return res.status(201).json(template);
  }
  if (req.body.courseId) {
    const course = await coursesRepository.findById(pool, req.body.courseId);
    if (!course) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y kh\xF3a h\u1ECDc." });
    if (req.user.role === "teacher" && course.teacherId !== req.user.id) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng ph\u1EE5 tr\xE1ch kh\xF3a h\u1ECDc n\xE0y." });
  }
  const row = (await pool.query(
    `INSERT INTO feedback_templates (id, owner_user_id, course_id, title, content, sort_order)
     VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT MAX(sort_order) + 1 FROM feedback_templates WHERE owner_user_id = $2), 0))
     RETURNING id, owner_user_id, course_id, title, content, sort_order, is_active, created_at, updated_at`,
    [generateId2("feedback"), req.user.id, req.body.courseId || null, req.body.title, req.body.content]
  )).rows[0];
  await audit(req, "create_feedback_template", row.id, row.title);
  return res.status(201).json({ id: row.id, ownerUserId: row.owner_user_id, courseId: row.course_id || void 0, title: row.title, content: row.content, sortOrder: row.sort_order, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at });
}));
app.delete("/api/feedback-templates/:id", requireAuth, requireRole(["teacher", "admin"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const existing2 = (store.feedbackTemplates || []).find((item) => item.id === req.params.id);
    if (!existing2) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y m\u1EABu nh\u1EADn x\xE9t." });
    if (req.user.role === "teacher" && existing2.ownerUserId !== req.user.id) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n x\xF3a m\u1EABu n\xE0y." });
    devMockStore = { ...store, feedbackTemplates: (store.feedbackTemplates || []).filter((item) => item.id !== req.params.id) };
    return res.status(204).send();
  }
  const existing = (await pool.query("SELECT owner_user_id, title FROM feedback_templates WHERE id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y m\u1EABu nh\u1EADn x\xE9t." });
  if (req.user.role === "teacher" && existing.owner_user_id !== req.user.id) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n x\xF3a m\u1EABu n\xE0y." });
  await pool.query("DELETE FROM feedback_templates WHERE id = $1", [req.params.id]);
  await audit(req, "delete_feedback_template", req.params.id, existing.title);
  return res.status(204).send();
}));
app.post("/api/certificates/issue", requireAuth, requireRole(["admin"]), validateBody(schemas.issueCertificate), asyncHandler(async (req, res) => {
  const client2 = await pool.connect();
  let committed = false;
  try {
    await client2.query("BEGIN");
    const enrollment = (await client2.query("SELECT * FROM enrollments WHERE id = $1 FOR UPDATE", [req.body.enrollmentId])).rows[0];
    if (!enrollment) {
      await client2.query("ROLLBACK");
      return res.status(404).json({ error: "Enrollment not found." });
    }
    if (enrollment.status === "cancelled" || enrollment.status === "pending_payment") {
      await client2.query("ROLLBACK");
      return res.status(400).json({ error: "Enrollment is not eligible for certificate issuance." });
    }
    const existingCertificate = (await client2.query(
      "SELECT * FROM certificates WHERE enrollment_id = $1 OR (student_id = $2 AND course_id = $3) LIMIT 1",
      [enrollment.id, enrollment.student_id, enrollment.course_id]
    )).rows[0];
    if (existingCertificate) {
      await client2.query("COMMIT");
      committed = true;
      return res.status(409).json({ error: "Certificate already exists for this enrollment." });
    }
    const issuedAt = (/* @__PURE__ */ new Date()).toISOString();
    const certificateCode = await generateCertificateCode(client2);
    const certificate = (await client2.query(
      `INSERT INTO certificates (id, enrollment_id, student_id, course_id, issued_at, certificate_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [generateId2("cert"), enrollment.id, enrollment.student_id, enrollment.course_id, issuedAt, certificateCode]
    )).rows[0];
    await client2.query(
      "UPDATE enrollments SET status = 'completed', completed_at = $1 WHERE id = $2",
      [issuedAt, enrollment.id]
    );
    await enqueueCourseCompletedEvent(client2, enrollment.id);
    await enqueueCertificateIssuedEvent(client2, certificate.id);
    await client2.query("COMMIT");
    committed = true;
    invalidateStoreCache();
    await notificationsRepository.create(pool, {
      userId: enrollment.student_id,
      type: "success",
      message: `Ch\u1EE9ng ch\u1EC9 kh\xF3a h\u1ECDc c\u1EE7a b\u1EA1n \u0111\xE3 \u0111\u01B0\u1EE3c c\u1EA5p ch\xEDnh th\u1EE9c. M\xE3 ki\u1EC3m \u0111\u1ECBnh: ${certificateCode}.`
    });
    await audit(req, "issue_certificate", certificate.id, certificateCode);
    res.status(201).json(certificateFromRow(certificate));
  } catch (error) {
    if (!committed) await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
}));
app.delete("/api/certificates/:id", requireAuth, requireRole(["manager", "admin"]), asyncHandler(async (req, res) => {
  const client2 = await pool.connect();
  let committed = false;
  try {
    await client2.query("BEGIN");
    const certificate = (await client2.query("SELECT * FROM certificates WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!certificate) {
      await client2.query("ROLLBACK");
      return res.status(404).json({ error: "Certificate not found." });
    }
    await client2.query("DELETE FROM certificates WHERE id = $1", [req.params.id]);
    await client2.query("COMMIT");
    committed = true;
    invalidateStoreCache();
    await notificationsRepository.create(pool, {
      userId: certificate.student_id,
      type: "danger",
      message: `Ch\u1EE9ng ch\u1EC9 m\xE3 ${certificate.certificate_code} \u0111\xE3 b\u1ECB thu h\u1ED3i kh\u1ECFi s\u1ED5 ch\u1EE9ng ch\u1EC9.`
    });
    await audit(req, "revoke_certificate", certificate.id, certificate.certificate_code);
    res.json({ ok: true, certificate: certificateFromRow(certificate) });
  } catch (error) {
    if (!committed) await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
}));
app.post("/api/progress/toggle", requireAuth, requireRole(["student"]), validateBody(schemas.toggleProgress), asyncHandler(async (req, res) => {
  const enrollment = await enrollmentsRepository.findStudentEnrollment(pool, req.user.id, req.body.enrollmentId);
  if (!enrollment) return res.status(404).json({ error: "Enrollment not found." });
  const result = await enrollmentsRepository.toggleProgress(pool, req.body.enrollmentId, req.body.lessonId);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await audit(req, "toggle_lesson_progress", req.body.lessonId, `completed=${result.row.completed}`);
  res.json(result.row);
}));
app.post("/api/quizzes", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.createQuiz), asyncHandler(async (req, res) => {
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, req.body.courseId)) return res.status(403).json({ error: "Permission denied." });
  if (req.body.sessionId) {
    const session = (await pool.query("SELECT id FROM attendance_sessions WHERE id = $1 AND course_id = $2", [req.body.sessionId, req.body.courseId])).rows[0];
    if (!session) return res.status(400).json({ error: "Quiz must be assigned to a valid lesson/session in this course." });
  } else if (req.body.lessonId) {
    const lesson = (await pool.query("SELECT id FROM lessons WHERE id = $1 AND course_id = $2", [req.body.lessonId, req.body.courseId])).rows[0];
    if (!lesson) return res.status(400).json({ error: "Quiz must be assigned to a valid lesson/session in this course." });
  }
  const quiz = await quizzesRepository.create(pool, req.body);
  invalidateStoreCache();
  await audit(req, "create_quiz", quiz.id, quiz.title);
  res.status(201).json(quiz);
}));
app.put("/api/quizzes/:id", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.updateQuiz), asyncHandler(async (req, res) => {
  const quiz = await quizzesRepository.findById(pool, req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  if (req.body.sessionId) {
    const session = (await pool.query("SELECT id FROM attendance_sessions WHERE id = $1 AND course_id = $2", [req.body.sessionId, quiz.courseId])).rows[0];
    if (!session) return res.status(400).json({ error: "Quiz must be assigned to a valid lesson/session in this course." });
  } else if (req.body.lessonId) {
    const lesson = (await pool.query("SELECT id FROM lessons WHERE id = $1 AND course_id = $2", [req.body.lessonId, quiz.courseId])).rows[0];
    if (!lesson) return res.status(400).json({ error: "Quiz must be assigned to a valid lesson/session in this course." });
  }
  const updated = await quizzesRepository.update(pool, req.params.id, req.body);
  invalidateStoreCache();
  await audit(req, "update_quiz", req.params.id, updated.title);
  res.json(updated);
}));
app.delete("/api/quizzes/:id", requireAuth, requireRole(["teacher", "admin"]), asyncHandler(async (req, res) => {
  const quiz = await quizzesRepository.findById(pool, req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  await quizzesRepository.delete(pool, req.params.id);
  invalidateStoreCache();
  await audit(req, "delete_quiz", req.params.id, quiz.title);
  res.json({ ok: true });
}));
app.post("/api/quizzes/:id/questions/bulk", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.bulkAddQuestions), asyncHandler(async (req, res) => {
  const quiz = await quizzesRepository.findById(pool, req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  const createdQuestions = [];
  for (const q of req.body.questions) {
    const qCreated = await quizzesRepository.addQuestion(pool, { ...q, quizId: req.params.id });
    createdQuestions.push(qCreated);
  }
  await audit(req, "bulk_add_quiz_questions", req.params.id, `Imported ${createdQuestions.length} questions`);
  res.status(201).json(createdQuestions);
}));
app.post("/api/quizzes/:id/questions", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.addQuestion), asyncHandler(async (req, res) => {
  const quiz = await quizzesRepository.findById(pool, req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  const question = await quizzesRepository.addQuestion(pool, { ...req.body, quizId: req.params.id });
  await audit(req, "add_quiz_question", question.id, quiz.id);
  res.status(201).json(question);
}));
app.put("/api/questions/:id", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.addQuestion), asyncHandler(async (req, res) => {
  const question = (await pool.query("SELECT quiz_id FROM questions WHERE id = $1", [req.params.id])).rows[0];
  if (!question) return res.status(404).json({ error: "Question not found." });
  const quiz = await quizzesRepository.findById(pool, question.quiz_id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  const updated = await quizzesRepository.updateQuestion(pool, req.params.id, req.body);
  await audit(req, "update_quiz_question", req.params.id, quiz.id);
  res.json(updated);
}));
app.delete("/api/questions/:id", requireAuth, requireRole(["teacher", "admin"]), asyncHandler(async (req, res) => {
  const question = (await pool.query("SELECT quiz_id FROM questions WHERE id = $1", [req.params.id])).rows[0];
  if (!question) return res.status(404).json({ error: "Question not found." });
  const quiz = await quizzesRepository.findById(pool, question.quiz_id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found." });
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, quiz.courseId)) return res.status(403).json({ error: "Permission denied." });
  await quizzesRepository.deleteQuestion(pool, req.params.id);
  await audit(req, "delete_quiz_question", req.params.id, quiz.id);
  res.status(204).end();
}));
app.post("/api/quizzes/submit", requireAuth, requireRole(["student"]), validateBody(schemas.submitQuiz), asyncHandler(async (req, res) => {
  const result = await quizzesRepository.submitAttempt(pool, req.body.quizId, req.user.id, req.body.answers, req.body.startedAt);
  if (!result) return res.status(404).json({ error: "Quiz not found." });
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  await maybePostGradeEntry(pool, req.user.id, "quiz", result.row.id, result.row.score, 100);
  await maybePostFinalCourseGradeForQuiz(pool, req.user.id, req.body.quizId);
  await audit(req, "submit_quiz_attempt", result.row.quizId, `Score ${result.row.score}.`);
  res.status(201).json(result.row);
}));
app.post("/api/assignments", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.createAssignment), asyncHandler(async (req, res) => {
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, req.body.courseId)) return res.status(403).json({ error: "Permission denied." });
  if (req.body.sessionId) {
    const session = (await pool.query("SELECT id FROM attendance_sessions WHERE id = $1 AND course_id = $2", [req.body.sessionId, req.body.courseId])).rows[0];
    if (!session) return res.status(400).json({ error: "Assignment must be assigned to a valid lesson/session in this course." });
  } else if (req.body.lessonId) {
    const lesson = (await pool.query("SELECT id FROM lessons WHERE id = $1 AND course_id = $2", [req.body.lessonId, req.body.courseId])).rows[0];
    if (!lesson) return res.status(400).json({ error: "Assignment must be assigned to a valid lesson/session in this course." });
  }
  const assignment = await assignmentsRepository.create(pool, req.body);
  invalidateStoreCache();
  await audit(req, "create_assignment", assignment.id, assignment.title);
  res.status(201).json(assignment);
}));
app.put("/api/assignments/:id", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.updateAssignment), asyncHandler(async (req, res) => {
  const assignment = (await pool.query("SELECT * FROM assignments WHERE id = $1", [req.params.id])).rows[0];
  if (!assignment) return res.status(404).json({ error: "Assignment not found." });
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, assignment.course_id)) return res.status(403).json({ error: "Permission denied." });
  if (req.body.sessionId) {
    const session = (await pool.query("SELECT id FROM attendance_sessions WHERE id = $1 AND course_id = $2", [req.body.sessionId, assignment.course_id])).rows[0];
    if (!session) return res.status(400).json({ error: "Assignment must be assigned to a valid lesson/session in this course." });
  } else if (req.body.lessonId) {
    const lesson = (await pool.query("SELECT id FROM lessons WHERE id = $1 AND course_id = $2", [req.body.lessonId, assignment.course_id])).rows[0];
    if (!lesson) return res.status(400).json({ error: "Assignment must be assigned to a valid lesson/session in this course." });
  }
  const updated = await assignmentsRepository.update(pool, req.params.id, req.body);
  invalidateStoreCache();
  await audit(req, "update_assignment", req.params.id, updated.title);
  res.json(updated);
}));
app.delete("/api/assignments/:id", requireAuth, requireRole(["teacher", "admin"]), asyncHandler(async (req, res) => {
  const assignment = (await pool.query("SELECT * FROM assignments WHERE id = $1", [req.params.id])).rows[0];
  if (!assignment) return res.status(404).json({ error: "Assignment not found." });
  if (req.user.role === "teacher" && !await coursesRepository.teacherOwnsCourse(pool, req.user.id, assignment.course_id)) return res.status(403).json({ error: "Permission denied." });
  await assignmentsRepository.delete(pool, req.params.id);
  invalidateStoreCache();
  await audit(req, "delete_assignment", req.params.id, assignment.title);
  res.json({ ok: true });
}));
app.post("/api/assignments/submit", requireAuth, requireRole(["student"]), validateBody(schemas.submitAssignment), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const assignment = store.assignments.find((a) => a.id === req.body.assignmentId);
    if (!assignment) return res.status(404).json({ error: "Assignment not found." });
    let sub = store.submissions.find((s) => s.assignmentId === req.body.assignmentId && s.studentId === req.user.id);
    if (sub) {
      sub.content = req.body.content;
      sub.submittedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (req.body.attachmentUrl) sub.attachmentUrl = req.body.attachmentUrl;
    } else {
      sub = {
        id: "sub_" + Date.now(),
        assignmentId: req.body.assignmentId,
        studentId: req.user.id,
        content: req.body.content,
        submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
        attachmentUrl: req.body.attachmentUrl
      };
      store.submissions.unshift(sub);
    }
    return res.status(201).json(sub);
  }
  const result = await assignmentsRepository.submit(pool, req.user.id, req.body.assignmentId, req.body.content, req.body.attachmentUrl);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  invalidateStoreCache();
  await audit(req, "submit_assignment", result.row.id, result.row.assignmentId);
  res.status(201).json(result.row);
}));
app.post("/api/assignments/grade", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.gradeAssignment), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const sub = store.submissions.find((s) => s.id === req.body.submissionId);
    if (!sub) return res.status(404).json({ error: "Submission not found." });
    sub.score = req.body.score;
    sub.feedback = req.body.feedback;
    sub.gradedAt = (/* @__PURE__ */ new Date()).toISOString();
    return res.json(sub);
  }
  const submission = await assignmentsRepository.findSubmissionForGrading(pool, req.body.submissionId);
  if (!submission) return res.status(404).json({ error: "Submission not found." });
  if (req.user.role === "teacher" && submission.teacher_id !== req.user.id) return res.status(403).json({ error: "Permission denied." });
  if (req.body.score > Number(submission.max_score)) return res.status(400).json({ error: "Invalid score." });
  const result = await assignmentsRepository.grade(pool, req.body.submissionId, req.body.score, req.body.feedback);
  if (submission) {
    await maybePostGradeEntry(pool, submission.student_id, "assignment", req.body.submissionId, req.body.score, Number(submission.max_score) || 100);
  }
  await maybePostFinalCourseGradeForSubmission(pool, req.body.submissionId);
  invalidateStoreCache();
  await audit(req, "grade_assignment", req.body.submissionId, `Score ${req.body.score}.`);
  res.json(result);
}));
app.post("/api/courses/:courseId/forum", requireAuth, requireRole(["student", "teacher", "admin"]), validateBody(schemas.createForumPost), asyncHandler(async (req, res) => {
  const { courseId: courseId2, sectionId, title, content } = req.body;
  if (courseId2 !== req.params.courseId) {
    return res.status(400).json({ error: "Course ID mismatch." });
  }
  const role = req.user.role;
  const userId = req.user.id;
  if (role === "student") {
    if (sectionId) {
      const isReg = (await pool.query(
        "SELECT id FROM course_registrations WHERE student_id = $1 AND section_id = $2 AND status = 'registered'",
        [userId, sectionId]
      )).rows[0];
      if (!isReg) {
        return res.status(403).json({ error: "You must be registered in this class section to post on the forum." });
      }
    } else {
      const enrollment = (await pool.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
        [userId, courseId2]
      )).rows[0];
      if (!enrollment) {
        return res.status(403).json({ error: "You must be enrolled in this course to post on the forum." });
      }
    }
  } else if (role === "teacher") {
    if (sectionId) {
      const isTeacher = (await pool.query(
        "SELECT id FROM course_sections WHERE id = $1 AND teacher_id = $2",
        [sectionId, userId]
      )).rows[0];
      if (!isTeacher) {
        return res.status(403).json({ error: "You can only post on the forum of classes you teach." });
      }
    } else {
      const owns = await coursesRepository.teacherOwnsCourse(pool, userId, courseId2);
      if (!owns) {
        return res.status(403).json({ error: "You can only post on the forum of courses you teach." });
      }
    }
  } else if (role !== "admin") {
    return res.status(403).json({ error: "Permission denied." });
  }
  const post = await forumRepository.createPost(pool, { courseId: courseId2, sectionId, authorId: userId, title, content });
  if (sectionId) {
    const studentsRes = await pool.query(
      "SELECT student_id FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
      [sectionId]
    );
    const secRes = await pool.query("SELECT section_code, teacher_id FROM course_sections WHERE id = $1", [sectionId]);
    const secCode = secRes.rows[0]?.section_code || "l\u1EDBp";
    const teacherId = secRes.rows[0]?.teacher_id;
    const authorRes = await pool.query("SELECT name FROM users WHERE id = $1", [userId]);
    const authorName = authorRes.rows[0]?.name || "Th\xE0nh vi\xEAn";
    for (const row of studentsRes.rows) {
      if (row.student_id !== userId) {
        await notificationsRepository.create(pool, {
          userId: row.student_id,
          type: "info",
          message: `Di\u1EC5n \u0111\xE0n l\u1EDBp ${secCode}: ${authorName} \u0111\xE3 \u0111\u0103ng b\xE0i th\u1EA3o lu\u1EADn m\u1EDBi: "${title}".`
        });
      }
    }
    if (teacherId && teacherId !== userId) {
      await notificationsRepository.create(pool, {
        userId: teacherId,
        type: "info",
        message: `Di\u1EC5n \u0111\xE0n l\u1EDBp ${secCode}: ${authorName} \u0111\xE3 \u0111\u0103ng b\xE0i th\u1EA3o lu\u1EADn m\u1EDBi: "${title}".`
      });
    }
  }
  invalidateStoreCache();
  await audit(req, "create_forum_post", post.id, `Course: ${courseId2}`);
  res.status(201).json(post);
}));
app.post("/api/forum/posts/:postId/replies", requireAuth, requireRole(["student", "teacher", "admin"]), validateBody(schemas.createForumReply), asyncHandler(async (req, res) => {
  const { content } = req.body;
  const { postId } = req.params;
  const userId = req.user.id;
  const role = req.user.role;
  const postRes = await pool.query("SELECT course_id, section_id, title, author_id FROM forum_posts WHERE id = $1", [postId]);
  const post = postRes.rows[0];
  if (!post) {
    return res.status(404).json({ error: "Forum post not found." });
  }
  const courseId2 = post.course_id;
  const sectionId = post.section_id;
  const postTitle = post.title;
  const postAuthorId = post.author_id;
  if (role === "student") {
    if (sectionId) {
      const isReg = (await pool.query(
        "SELECT id FROM course_registrations WHERE student_id = $1 AND section_id = $2 AND status = 'registered'",
        [userId, sectionId]
      )).rows[0];
      if (!isReg) {
        return res.status(403).json({ error: "You must be registered in this class section to reply on the forum." });
      }
    } else {
      const enrollment = (await pool.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
        [userId, courseId2]
      )).rows[0];
      if (!enrollment) {
        return res.status(403).json({ error: "You must be enrolled in this course to reply on the forum." });
      }
    }
  } else if (role === "teacher") {
    if (sectionId) {
      const isTeacher = (await pool.query(
        "SELECT id FROM course_sections WHERE id = $1 AND teacher_id = $2",
        [sectionId, userId]
      )).rows[0];
      if (!isTeacher) {
        return res.status(403).json({ error: "You can only reply on the forum of classes you teach." });
      }
    } else {
      const owns = await coursesRepository.teacherOwnsCourse(pool, userId, courseId2);
      if (!owns) {
        return res.status(403).json({ error: "You can only reply on the forum of courses you teach." });
      }
    }
  } else if (role !== "admin") {
    return res.status(403).json({ error: "Permission denied." });
  }
  const reply = await forumRepository.createReply(pool, { postId, authorId: userId, content });
  if (sectionId) {
    const secRes = await pool.query("SELECT section_code, teacher_id FROM course_sections WHERE id = $1", [sectionId]);
    const secCode = secRes.rows[0]?.section_code || "l\u1EDBp";
    const teacherId = secRes.rows[0]?.teacher_id;
    const authorRes = await pool.query("SELECT name FROM users WHERE id = $1", [userId]);
    const authorName = authorRes.rows[0]?.name || "Th\xE0nh vi\xEAn";
    if (postAuthorId && postAuthorId !== userId) {
      await notificationsRepository.create(pool, {
        userId: postAuthorId,
        type: "info",
        message: `Di\u1EC5n \u0111\xE0n l\u1EDBp ${secCode}: ${authorName} \u0111\xE3 b\xECnh lu\u1EADn v\xE0o b\xE0i vi\u1EBFt "${postTitle}" c\u1EE7a b\u1EA1n.`
      });
    }
    const studentsRes = await pool.query(
      "SELECT student_id FROM course_registrations WHERE section_id = $1 AND status = 'registered'",
      [sectionId]
    );
    for (const row of studentsRes.rows) {
      if (row.student_id !== userId && row.student_id !== postAuthorId) {
        await notificationsRepository.create(pool, {
          userId: row.student_id,
          type: "info",
          message: `Di\u1EC5n \u0111\xE0n l\u1EDBp ${secCode}: c\xF3 ph\u1EA3n h\u1ED3i m\u1EDBi t\u1EEB ${authorName} trong ch\u1EE7 \u0111\u1EC1 "${postTitle}".`
        });
      }
    }
    if (teacherId && teacherId !== userId && teacherId !== postAuthorId) {
      await notificationsRepository.create(pool, {
        userId: teacherId,
        type: "info",
        message: `Di\u1EC5n \u0111\xE0n l\u1EDBp ${secCode}: c\xF3 ph\u1EA3n h\u1ED3i m\u1EDBi t\u1EEB ${authorName} trong ch\u1EE7 \u0111\u1EC1 "${postTitle}".`
      });
    }
  }
  invalidateStoreCache();
  await audit(req, "create_forum_reply", reply.id, `Post: ${postId}`);
  res.status(201).json(reply);
}));
app.post("/api/admin/users", requireAuth, requireRole(["admin"]), validateBody(schemas.createUser), asyncHandler(async (req, res) => {
  const client2 = await pool.connect();
  let created;
  try {
    await client2.query("BEGIN");
    created = await createUserAccount(client2, req.body, req.body.password);
    await client2.query("COMMIT");
  } catch (error) {
    await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
  if (created.role === "student") {
    void eventBus.emit("user.created", created, pool).catch((err) => {
      console.error("[user.created] async provisioning failed:", err);
    });
  }
  invalidateStoreCache();
  await audit(req, "create_user", created.id, created.email);
  res.status(201).json(created);
}));
app.post("/api/admin/users/bulk", requireAuth, requireRole(["admin"]), rateLimitBulkImport, validateBody(schemas.bulkCreateUsers), asyncHandler(async (req, res) => {
  const errors = [];
  const created = [];
  const seenEmails = /* @__PURE__ */ new Set();
  for (const [index, input] of req.body.users.entries()) {
    const row = index + 1;
    const email = input.email.toLowerCase().trim();
    if (seenEmails.has(email)) {
      errors.push({ row, email, reason: "Duplicate email in import payload." });
      continue;
    }
    seenEmails.add(email);
    const existing = await usersRepository.findAuthByEmail(pool, email);
    if (existing) {
      errors.push({ row, email, reason: "Email already exists." });
      continue;
    }
    const client2 = await pool.connect();
    let newUser = null;
    try {
      await client2.query("BEGIN");
      newUser = await createUserAccount(client2, input, req.body.defaultPassword || generateTemporaryPassword());
      await client2.query("COMMIT");
    } catch (error) {
      await client2.query("ROLLBACK");
      errors.push({
        row,
        email,
        reason: error?.code === "23505" ? "Duplicate user or student code." : error?.message || "Unable to create user."
      });
      continue;
    } finally {
      client2.release();
    }
    created.push(newUser);
    if (newUser.role === "student") {
      void eventBus.emit("user.created", newUser, pool).catch((err) => {
        console.error("[user.created] async provisioning failed:", err);
      });
    }
  }
  if (created.length > 0) {
    invalidateStoreCache();
    await audit(req, "bulk_create_users", "users", `Created ${created.length} users from CSV import; skipped ${errors.length}.`);
  }
  res.status(created.length > 0 ? 201 : 200).json({
    createdCount: created.length,
    skippedCount: errors.length,
    errorCount: errors.length,
    errors,
    created
  });
}));
app.post("/api/admin/users/:id/reset-password", requireAuth, requireRole(["manager", "admin"]), rateLimitResetPassword, asyncHandler(async (req, res) => {
  const user = await usersRepository.findById(pool, req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  const { resetToken, expiresAt } = await issuePasswordResetToken(user.id, req.user.id);
  const resetUrl = passwordResetUrl(req, resetToken);
  let emailSent = false;
  try {
    await sendPasswordResetLinkEmail(pool, user.id, {
      to: user.email,
      name: user.name,
      resetUrl,
      expiresAt
    });
    emailSent = true;
  } catch (err) {
    console.error("Failed to email password reset link:", err);
  }
  await audit(req, "create_password_reset_link", req.params.id, `Password reset link created for: ${user.email}`);
  const canExposeResetUrl = !emailSent || process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "staging";
  res.json({
    ok: true,
    emailSent,
    expiresAt,
    ...canExposeResetUrl ? { resetUrl } : {},
    message: emailSent ? `Li\xEAn k\u1EBFt \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u \u0111\xE3 \u0111\u01B0\u1EE3c g\u1EEDi t\u1EDBi email c\u1EE7a ng\u01B0\u1EDDi d\xF9ng: ${user.email}` : `Li\xEAn k\u1EBFt \u0111\u1EB7t l\u1EA1i m\u1EADt kh\u1EA9u \u0111\xE3 \u0111\u01B0\u1EE3c t\u1EA1o, nh\u01B0ng email g\u1EEDi li\xEAn k\u1EBFt ch\u01B0a th\xE0nh c\xF4ng. Vui l\xF2ng chuy\u1EC3n li\xEAn k\u1EBFt qua k\xEAnh n\u1ED9i b\u1ED9.`
  });
}));
app.post("/api/admin/users/:id/reprovision-email", requireAuth, requireRole(["manager", "admin"]), asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const user = await usersRepository.findById(pool, userId);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  if (user.role !== "student") {
    return res.status(400).json({ error: "Only students can have emails provisioned." });
  }
  try {
    if (user.emailProvisioned) {
      return res.json({ ok: true, message: "Email already provisioned.", schoolEmail: user.schoolEmail });
    }
    await provisioningService.provisionStudentEmail(pool, userId);
    const updatedUser = await usersRepository.findById(pool, userId);
    res.json({
      ok: true,
      message: "Email provisioning completed successfully.",
      schoolEmail: updatedUser?.schoolEmail
    });
  } catch (err) {
    console.error("[reprovision-email] failed:", err);
    res.status(500).json({ error: `Provisioning failed: ${err.message || err}` });
  }
}));
app.patch("/api/admin/users/:id/role", requireAuth, requireRole(["admin"]), asyncHandler(async (req, res) => {
  const { role } = req.body;
  const allowedRoles = ["student", "teacher", "admin"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role value." });
  }
  if (req.user.id === req.params.id) {
    return res.status(403).json({ error: "Cannot change your own role." });
  }
  const userRes = await pool.query("SELECT id, email, role FROM users WHERE id = $1", [req.params.id]);
  if (userRes.rows.length === 0) {
    return res.status(404).json({ error: "User not found." });
  }
  await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role, req.params.id]);
  await audit(req, "update_user_role", req.params.id, `role=${role}`);
  invalidateStoreCache();
  res.json({ ok: true, message: "Role updated successfully." });
}));
app.patch("/api/admin/users/:id/status", requireAuth, requireRole(["manager", "admin"]), validateBody(schemas.setUserActive), asyncHandler(async (req, res) => {
  const user = await usersRepository.setActive(pool, req.params.id, req.body.isActive);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (req.body.isActive === false && user.role === "student" && user.schoolEmail) {
    try {
      await deleteSchoolEmail(user.schoolEmail);
      await pool.query(
        "UPDATE users SET email_provisioned = false, school_email = NULL, email_provisioned_at = NULL WHERE id = $1",
        [user.id]
      );
      user.emailProvisioned = false;
      user.schoolEmail = void 0;
    } catch (err) {
      console.error(`[deleteSchoolEmail] Failed to delete workspace account for ${user.schoolEmail}:`, err);
    }
  }
  invalidateStoreCache();
  await audit(req, "toggle_user_status", user.id, `isActive=${user.isActive}`);
  res.json(user);
}));
app.get("/api/notifications", requireAuth, asyncHandler(async (req, res) => res.json(await notificationsRepository.listForUser(pool, req.user.id, req.query.unreadOnly === "true"))));
app.patch("/api/notifications/read-all", requireAuth, asyncHandler(async (req, res) => {
  await notificationsRepository.markAllRead(pool, req.user.id);
  invalidateStoreCache();
  res.status(204).send();
}));
app.patch("/api/notifications/:id/read", requireAuth, asyncHandler(async (req, res) => {
  await notificationsRepository.markRead(pool, req.params.id, req.user.id);
  invalidateStoreCache();
  res.status(204).send();
}));
app.post("/api/course-sections", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.courseSection), asyncHandler(async (req, res) => {
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  if (req.user.role === "teacher") {
    if (course.teacherId !== req.user.id) return res.status(403).json({ error: "Permission denied." });
    req.body.teacherId = req.user.id;
    req.body.status = "pending";
  }
  const payload = {
    ...req.body,
    numberOfSessions: req.body.numberOfSessions || course.numberOfLessons || 10,
    openingDate: req.body.openingDate || course.openingDate
  };
  if (!payload.teacherId) return res.status(400).json({ error: "teacherId is required." });
  const scheduleConflicts = await validateCourseSectionScheduleConflicts(pool, payload);
  if (scheduleConflicts.length > 0) {
    return res.status(409).json({ error: scheduleConflicts[0], conflicts: scheduleConflicts });
  }
  const row = await upsertCourseSection(pool, payload);
  invalidateStoreCache();
  await audit(req, "create_course_section", row.id, row.sectionCode);
  res.status(201).json(row);
}));
app.put("/api/course-sections/:id", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.courseSection), asyncHandler(async (req, res) => {
  const existing = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Course section not found." });
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  if (req.user.role === "teacher") {
    if (course.teacherId !== req.user.id || existing.teacher_id !== req.user.id) {
      return res.status(403).json({ error: "Permission denied." });
    }
    req.body.teacherId = req.user.id;
    req.body.status = existing.status;
  }
  const payload = {
    ...req.body,
    id: req.params.id,
    numberOfSessions: req.body.numberOfSessions || existing.number_of_sessions || course.numberOfLessons || 10,
    openingDate: req.body.openingDate || existing.opening_date || course.openingDate
  };
  if (!payload.teacherId) return res.status(400).json({ error: "teacherId is required." });
  const sessionsWithMaterials = await generatedSessionsWithMaterialsBeyond(pool, req.params.id, Number(payload.numberOfSessions));
  if (sessionsWithMaterials.length > 0) {
    return res.status(409).json({
      error: `Kh\xF4ng th\u1EC3 gi\u1EA3m s\u1ED1 bu\u1ED5i v\xEC ${sessionsWithMaterials.join(", ")} \u0111ang c\xF3 t\xE0i li\u1EC7u. H\xE3y x\xF3a ho\u1EB7c chuy\u1EC3n t\xE0i li\u1EC7u tr\u01B0\u1EDBc.`
    });
  }
  const scheduleConflicts = await validateCourseSectionScheduleConflicts(pool, payload);
  if (scheduleConflicts.length > 0) {
    return res.status(409).json({ error: scheduleConflicts[0], conflicts: scheduleConflicts });
  }
  const row = await upsertCourseSection(pool, payload);
  invalidateStoreCache();
  await audit(req, "update_course_section", row.id, row.sectionCode);
  res.json(row);
}));
app.delete("/api/course-sections/:id", requireAuth, requireRole(["teacher", "admin"]), asyncHandler(async (req, res) => {
  const existing = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Course section not found." });
  if (req.user.role === "teacher" && existing.teacher_id !== req.user.id) {
    return res.status(403).json({ error: "Permission denied." });
  }
  const materialStoragePaths = await sessionMaterialsRepository.listStoragePathsForSection(pool, req.params.id);
  const client2 = await pool.connect();
  try {
    await client2.query("BEGIN");
    await client2.query("DELETE FROM course_registrations WHERE section_id = $1", [req.params.id]);
    await client2.query("DELETE FROM section_schedules WHERE section_id = $1", [req.params.id]);
    await client2.query("DELETE FROM course_sections WHERE id = $1", [req.params.id]);
    await client2.query("COMMIT");
  } catch (error) {
    await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
  await materialStorage.remove(materialStoragePaths).catch((err) => {
    console.error("[session-materials] failed to remove files of deleted section:", err);
  });
  invalidateStoreCache();
  await audit(req, "delete_course_section", req.params.id, existing.section_code);
  res.status(204).send();
}));
app.post("/api/course-registrations", requireAuth, requireRole(["student"]), validateBody(schemas.courseRegistration), asyncHandler(async (req, res) => {
  const result = await courseRegistrationsRepository.register(pool, req.user.id, req.body.sectionId);
  if ("error" in result) return res.status(result.status).json({ error: result.error });
  invalidateStoreCache();
  res.status(201).json(result.row);
}));
app.patch("/api/course-registrations/:id/drop", requireAuth, requireRole(["student"]), asyncHandler(async (req, res) => {
  const registration = await courseRegistrationsRepository.drop(pool, req.params.id, req.user.id);
  if (!registration) return res.status(404).json({ error: "Course registration not found." });
  invalidateStoreCache();
  res.json(registration);
}));
app.patch("/api/course-registrations/:id/approve", requireAuth, requireRole(["manager", "admin"]), asyncHandler(async (req, res) => {
  const client2 = await pool.connect();
  try {
    await client2.query("BEGIN");
    const registration = (await client2.query(
      `SELECT cr.*, cs.max_students, cs.course_id
       FROM course_registrations cr
       JOIN course_sections cs ON cs.id = cr.section_id
       WHERE cr.id = $1
       FOR UPDATE`,
      [req.params.id]
    )).rows[0];
    if (!registration) {
      await client2.query("ROLLBACK");
      return res.status(404).json({ error: "Course registration not found." });
    }
    const enrollment = (await client2.query(
      "SELECT * FROM enrollments WHERE student_id = $1 AND course_id = $2 FOR UPDATE",
      [registration.student_id, registration.course_id]
    )).rows[0];
    if (!enrollment) {
      await client2.query("ROLLBACK");
      return res.status(404).json({ error: "Enrollment not found." });
    }
    if (!await hasConfirmedPaymentForCoursePlacement(client2, registration.student_id, registration.course_id)) {
      await client2.query("ROLLBACK");
      return res.status(400).json({ error: "Payment must be confirmed before class placement." });
    }
    const count = Number((await client2.query(
      "SELECT COUNT(*) AS count FROM course_registrations WHERE section_id = $1 AND status = 'registered' AND id <> $2",
      [registration.section_id, registration.id]
    )).rows[0].count);
    if (count >= Number(registration.max_students)) {
      await client2.query("ROLLBACK");
      return res.status(400).json({ error: "Class section is full." });
    }
    const row = (await client2.query(
      "UPDATE course_registrations SET status = 'registered' WHERE id = $1 RETURNING *",
      [req.params.id]
    )).rows[0];
    await client2.query("UPDATE enrollments SET status = 'active' WHERE id = $1", [enrollment.id]);
    await enqueueEnrollmentEvent(client2, "enrollment.status_changed", enrollment.id);
    await client2.query("COMMIT");
    invalidateStoreCache();
    await audit(req, "approve_course_registration", req.params.id, registration.student_id);
    res.json(row);
  } catch (error) {
    await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
}));
var reviewTransactionHandler = asyncHandler(async (req, res) => {
  const client2 = await pool.connect();
  let result;
  try {
    await client2.query("BEGIN");
    result = await financeRepository.reviewTransaction(client2, req.params.id, req.body.status, req.user.id, req.body.notes);
    if (!result) {
      await client2.query("ROLLBACK");
      return res.status(404).json({ error: "Transaction not found." });
    }
    if ("error" in result) {
      await client2.query("ROLLBACK");
      return res.status(result.status).json({ error: result.error });
    }
    if (result.course_id) {
      const affected = (await client2.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
        [result.student_id, result.course_id]
      )).rows;
      for (const row of affected) await enqueueEnrollmentEvent(client2, "enrollment.status_changed", row.id);
    }
    await client2.query("COMMIT");
  } catch (error) {
    await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
  await audit(req, `finance_transaction_${req.body.status}`, req.params.id, req.body.notes || "");
  res.json(result);
});
app.patch("/api/finance/transactions/:id/review", requireAuth, requireRole(["manager", "admin"]), validateBody(schemas.reviewTransaction), reviewTransactionHandler);
app.patch("/api/payments/transactions/:id/review", requireAuth, requireRole(["manager", "admin"]), validateBody(schemas.reviewTransaction), reviewTransactionHandler);
var paymentWebhookHandler = asyncHandler(async (req, res) => {
  const signature = req.header("X-Payment-Signature");
  if (!signature) {
    return res.status(400).json({ error: "Missing webhook signature header." });
  }
  const payload = req.rawBody || JSON.stringify(req.body);
  const expectedSignature = crypto4.createHmac("sha256", PAYMENT_WEBHOOK_SECRET_VALUE).update(payload).digest("hex");
  const receivedSignature = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;
  const sigBuffer = Buffer.from(receivedSignature, "utf8");
  const expBuffer = Buffer.from(expectedSignature, "utf8");
  if (sigBuffer.length !== expBuffer.length || !crypto4.timingSafeEqual(sigBuffer, expBuffer)) {
    return res.status(401).json({ error: "Invalid webhook signature." });
  }
  const { eventId, timestamp, transactionId, status, notes } = req.body;
  if (!eventId || !timestamp || !transactionId || !status) {
    return res.status(400).json({ error: "Missing required webhook payload fields." });
  }
  if (status !== "approved" && status !== "rejected") {
    return res.status(400).json({ error: "Invalid transaction status in webhook payload." });
  }
  const eventTimestamp = parseWebhookTimestamp(timestamp);
  if (!eventTimestamp) {
    return res.status(400).json({ error: "Invalid webhook timestamp." });
  }
  if (!isWebhookTimestampFresh(eventTimestamp)) {
    return res.status(400).json({ error: "Webhook timestamp is outside the allowed tolerance window." });
  }
  const payloadSha256 = sha256Hex2(payload);
  const client2 = await pool.connect();
  let result;
  try {
    await client2.query("BEGIN");
    const inserted = await client2.query(
      `INSERT INTO payment_webhook_events (
         event_id, transaction_id, status, event_timestamp, payload_sha256, processing_status
       ) VALUES ($1, $2, $3, $4, $5, 'processing')
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [eventId, transactionId, status, eventTimestamp.toISOString(), payloadSha256]
    );
    if (inserted.rowCount === 0) {
      const existing = (await client2.query(
        "SELECT event_id, transaction_id, processing_status, payload_sha256, error FROM payment_webhook_events WHERE event_id = $1",
        [eventId]
      )).rows[0];
      await client2.query("ROLLBACK");
      if (existing?.payload_sha256 && existing.payload_sha256 !== payloadSha256) {
        return res.status(409).json({ error: "Webhook event id was already used with a different payload." });
      }
      return res.json({
        ok: true,
        duplicate: true,
        eventId,
        transactionId: existing?.transaction_id || transactionId,
        status: existing?.processing_status || "unknown",
        error: existing?.error || void 0
      });
    }
    result = await financeRepository.reviewTransaction(
      client2,
      transactionId,
      status,
      null,
      notes || "Processed via payment gateway webhook callback."
    );
    if (!result) {
      await client2.query(
        "UPDATE payment_webhook_events SET processing_status = 'failed', error = $2 WHERE event_id = $1",
        [eventId, "Transaction not found."]
      );
      await client2.query("COMMIT");
      return res.status(404).json({ error: "Transaction not found." });
    }
    if ("error" in result) {
      await client2.query(
        "UPDATE payment_webhook_events SET processing_status = 'failed', error = $2 WHERE event_id = $1",
        [eventId, result.error]
      );
      await client2.query("COMMIT");
      return res.status(result.status || 400).json({ error: result.error });
    }
    if (result.course_id) {
      const affected = (await client2.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
        [result.student_id, result.course_id]
      )).rows;
      for (const row of affected) await enqueueEnrollmentEvent(client2, "enrollment.status_changed", row.id);
    }
    await client2.query(
      "UPDATE payment_webhook_events SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE event_id = $1",
      [eventId]
    );
    await client2.query("COMMIT");
  } catch (error) {
    await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }
  await logSystemAudit(`finance_transaction_${status}`, transactionId, notes || "Processed via payment gateway webhook callback.");
  res.json({ ok: true, eventId, message: "Webhook processed successfully", transaction: result });
});
app.post("/api/payments/webhook", paymentWebhookHandler);
app.post("/api/webhooks/payment", paymentWebhookHandler);
var sepayWebhookHandler = asyncHandler(async (req, res) => {
  const expectedApiKey = process.env.SEPAY_API_KEY?.trim();
  if (expectedApiKey) {
    const authHeader = req.header("Authorization") || "";
    const token = authHeader.replace(/^(Apikey|Bearer)\s+/i, "").trim();
    if (!token || token !== expectedApiKey) {
      return res.status(401).json({ success: false, error: "Invalid or missing SePay API key." });
    }
  }
  const rawPayload = req.rawBody || JSON.stringify(req.body);
  const result = await processSepayWebhook(req.body, rawPayload, () => {
    invalidateStoreCache();
  });
  res.status(result.success ? 200 : 400).json(result);
});
app.post("/api/payments/sepay/webhook", sepayWebhookHandler);
app.post("/api/webhooks/sepay", sepayWebhookHandler);
async function validateAttendanceSectionAccess(courseId2, sectionId, user) {
  if (!sectionId) return {};
  const section = (await pool.query(
    "SELECT id, course_id, teacher_id FROM course_sections WHERE id = $1",
    [sectionId]
  )).rows[0];
  if (!section) return { status: 404, error: "Course section not found." };
  if (section.course_id !== courseId2) return { status: 400, error: "Selected section does not belong to this course." };
  if (user.role === "teacher" && section.teacher_id !== user.id) return { status: 403, error: "Permission denied for this class section." };
  return { section };
}
async function findSessionWithOwners(sessionId) {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const s = (store.attendanceSessions || []).find((sess) => sess.id === sessionId);
    if (!s) return null;
    const sec = (store.courseSections || []).find((sec2) => sec2.id === s.sectionId);
    const course = (store.courses || []).find((course2) => course2.id === s.courseId);
    return {
      id: s.id,
      course_id: s.courseId,
      section_id: s.sectionId || null,
      course_teacher_id: course?.teacherId || s.teacherId || "user_teacher",
      section_teacher_id: sec?.teacherId || s.teacherId || "user_teacher"
    };
  }
  return (await pool.query(
    `SELECT s.id, s.course_id, s.section_id, c.teacher_id AS course_teacher_id, cs.teacher_id AS section_teacher_id
     FROM attendance_sessions s
     JOIN courses c ON c.id = s.course_id
     LEFT JOIN course_sections cs ON cs.id = s.section_id
     WHERE s.id = $1`,
    [sessionId]
  )).rows[0] || null;
}
function canManageSessionMaterials(user, session) {
  if (user.role === "admin") return true;
  if (user.role === "teacher") {
    if (session.section_teacher_id === user.id || session.course_teacher_id === user.id) return true;
  }
  return false;
}
async function canViewSessionMaterials(user, session) {
  if (canManageSessionMaterials(user, session)) return true;
  if (user.role !== "student") return false;
  const enrolled = await pool.query(
    "SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status IN ('active', 'completed')",
    [user.id, session.course_id]
  );
  if (!enrolled.rowCount) return false;
  if (!session.section_id) return true;
  const registered = await pool.query(
    "SELECT 1 FROM course_registrations WHERE student_id = $1 AND section_id = $2 AND status = 'registered'",
    [user.id, session.section_id]
  );
  return Boolean(registered.rowCount);
}
function resolveMaterialUrl(type, value) {
  if (type === "youtube") {
    const videoId = extractYoutubeVideoId(String(value || ""));
    return videoId ? youtubeWatchUrl(videoId) : null;
  }
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
var materialUrlError = (type) => type === "youtube" ? "Link YouTube kh\xF4ng h\u1EE3p l\u1EC7." : "Li\xEAn k\u1EBFt ph\u1EA3i b\u1EAFt \u0111\u1EA7u b\u1EB1ng http:// ho\u1EB7c https://.";
async function generatedSessionsWithMaterialsBeyond(db, sectionId, targetCount) {
  const rows = (await db.query(
    `SELECT DISTINCT s.topic
     FROM session_materials m
     JOIN attendance_sessions s ON s.id = m.session_id
     WHERE s.section_id = $1`,
    [sectionId]
  )).rows;
  return rows.map((row) => generatedSessionOrder(row.topic)).filter((order) => order !== null && order > targetCount).sort((a, b) => a - b).map((order) => `Bu\u1ED5i ${order}`);
}
app.get("/api/sessions/:sessionId/materials", requireAuth, asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const mats = (store.sessionMaterials || []).filter((m) => m.sessionId === req.params.sessionId);
    return res.json(mats);
  }
  const session = await findSessionWithOwners(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y bu\u1ED5i h\u1ECDc." });
  if (!await canViewSessionMaterials(req.user, session)) return res.status(403).json({ error: "Permission denied." });
  res.json(await sessionMaterialsRepository.listBySession(pool, session.id));
}));
app.post("/api/sessions/:sessionId/materials", requireAuth, requireRole(["teacher", "admin"]), materialUpload.single("file"), validateBody(schemas.createSessionMaterial), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    if (!store.sessionMaterials) store.sessionMaterials = [];
    const type2 = req.body.type;
    const fileName = req.file ? Buffer.from(req.file.originalname, "latin1").toString("utf8") : void 0;
    const ext = fileName ? path5.extname(fileName).toLowerCase() : "";
    const newMat = {
      id: "mat_" + Date.now(),
      sessionId: req.params.sessionId,
      type: type2,
      title: req.body.title || (fileName ? path5.basename(fileName, path5.extname(fileName)) : type2 === "youtube" ? "Video b\xE0i gi\u1EA3ng" : "T\xE0i li\u1EC7u"),
      url: req.file ? `/uploads/${req.file.filename}` : type2 === "youtube" || type2 === "link" ? resolveMaterialUrl(type2, req.body.url) : req.body.url || "",
      fileName,
      sizeBytes: req.file ? req.file.size : void 0,
      mimeType: ext ? MATERIAL_MIME_BY_EXT[ext] || "application/octet-stream" : void 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    store.sessionMaterials.push(newMat);
    return res.status(201).json(newMat);
  }
  const session = await findSessionWithOwners(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y bu\u1ED5i h\u1ECDc." });
  if (!canManageSessionMaterials(req.user, session)) return res.status(403).json({ error: "Permission denied for this class session." });
  const type = req.body.type;
  const base = {
    id: sessionMaterialsRepository.newId(),
    sessionId: session.id,
    sectionId: session.section_id,
    courseId: session.course_id,
    type,
    createdBy: req.user.id
  };
  let material;
  if (type === "youtube" || type === "link") {
    if (req.file) return res.status(400).json({ error: "T\xE0i li\u1EC7u d\u1EA1ng li\xEAn k\u1EBFt kh\xF4ng k\xE8m t\u1EC7p." });
    const url = resolveMaterialUrl(type, req.body.url);
    if (!url) return res.status(400).json({ error: materialUrlError(type) });
    material = await sessionMaterialsRepository.create(pool, {
      ...base,
      title: req.body.title || (type === "youtube" ? "Video b\xE0i gi\u1EA3ng" : url),
      url
    });
  } else {
    if (!req.file) return res.status(400).json({ error: "Vui l\xF2ng ch\u1ECDn t\u1EC7p t\xE0i li\u1EC7u." });
    const fileName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
    const ext = path5.extname(fileName).toLowerCase();
    if (!MATERIAL_FILE_EXTENSIONS[type].has(ext)) {
      return res.status(400).json({
        error: type === "slide" ? "Slide ph\u1EA3i l\xE0 t\u1EC7p .ppt, .pptx ho\u1EB7c .pdf." : "T\xE0i li\u1EC7u/d\u1EEF li\u1EC7u th\u1EF1c h\xE0nh ph\u1EA3i l\xE0 t\u1EC7p .doc, .docx, .pdf, .xlsx, .xls, .csv, .pbix, .zip, .rar."
      });
    }
    const storagePath = `${session.course_id}/${session.section_id || "course"}/${session.id}/${base.id}${ext}`;
    await materialStorage.put(storagePath, req.file.buffer, MATERIAL_MIME_BY_EXT[ext]);
    try {
      material = await sessionMaterialsRepository.create(pool, {
        ...base,
        title: req.body.title || path5.basename(fileName, path5.extname(fileName)),
        storagePath,
        fileName,
        mimeType: MATERIAL_MIME_BY_EXT[ext],
        sizeBytes: req.file.size
      });
    } catch (error) {
      await materialStorage.remove([storagePath]).catch(() => void 0);
      throw error;
    }
  }
  invalidateStoreCache();
  await audit(req, "create_session_material", material.id, `${type}: ${material.title}`);
  res.status(201).json(material);
}));
app.put("/api/sessions/:sessionId/materials/order", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.reorderSessionMaterials), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const ids = req.body.materialIds || [];
    if (store.sessionMaterials) {
      store.sessionMaterials.sort((a, b) => {
        const ai = ids.indexOf(a.id);
        const bi = ids.indexOf(b.id);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    }
    return res.json((store.sessionMaterials || []).filter((m) => m.sessionId === req.params.sessionId));
  }
  const session = await findSessionWithOwners(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y bu\u1ED5i h\u1ECDc." });
  if (!canManageSessionMaterials(req.user, session)) return res.status(403).json({ error: "Permission denied for this class session." });
  const materials = await sessionMaterialsRepository.reorder(pool, session.id, req.body.materialIds);
  invalidateStoreCache();
  res.json(materials);
}));
app.patch("/api/materials/:id", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.updateSessionMaterial), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    const mat = (store.sessionMaterials || []).find((m) => m.id === req.params.id);
    if (!mat) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i li\u1EC7u." });
    if (req.body.title) mat.title = req.body.title;
    if (req.body.url) mat.url = req.body.url;
    return res.json(mat);
  }
  const row = await sessionMaterialsRepository.findRowById(pool, req.params.id);
  if (!row) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i li\u1EC7u." });
  const session = await findSessionWithOwners(row.session_id);
  if (!session || !canManageSessionMaterials(req.user, session)) return res.status(403).json({ error: "Permission denied for this class session." });
  let url;
  if (req.body.url !== void 0) {
    if (row.type !== "youtube" && row.type !== "link") return res.status(400).json({ error: "Ch\u1EC9 t\xE0i li\u1EC7u d\u1EA1ng li\xEAn k\u1EBFt m\u1EDBi \u0111\u1ED5i \u0111\u01B0\u1EE3c URL." });
    url = resolveMaterialUrl(row.type, req.body.url) || void 0;
    if (!url) return res.status(400).json({ error: materialUrlError(row.type) });
  }
  const material = await sessionMaterialsRepository.update(pool, row.id, { title: req.body.title, url });
  invalidateStoreCache();
  await audit(req, "update_session_material", row.id, material?.title || row.title);
  res.json(material);
}));
app.delete("/api/materials/:id", requireAuth, requireRole(["teacher", "admin"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    const store = devMockStore || getInitialStore();
    if (store.sessionMaterials) {
      store.sessionMaterials = store.sessionMaterials.filter((m) => m.id !== req.params.id);
    }
    return res.status(204).send();
  }
  const row = await sessionMaterialsRepository.findRowById(pool, req.params.id);
  if (!row) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i li\u1EC7u." });
  const session = await findSessionWithOwners(row.session_id);
  if (!session || !canManageSessionMaterials(req.user, session)) return res.status(403).json({ error: "Permission denied for this class session." });
  await sessionMaterialsRepository.remove(pool, row.id);
  if (row.storage_path) {
    await materialStorage.remove([row.storage_path]).catch((err) => {
      console.error("[session-materials] failed to remove file:", row.storage_path, err);
    });
  }
  invalidateStoreCache();
  await audit(req, "delete_session_material", row.id, row.title);
  res.status(204).send();
}));
app.get("/api/materials/:id/download", requireAuth, asyncHandler(async (req, res) => {
  const row = await sessionMaterialsRepository.findRowById(pool, req.params.id);
  if (!row || !row.storage_path) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y t\u1EC7p t\xE0i li\u1EC7u." });
  const session = await findSessionWithOwners(row.session_id);
  if (!session || !await canViewSessionMaterials(req.user, session)) return res.status(403).json({ error: "Permission denied." });
  const isPdf = row.mime_type === "application/pdf" || row.file_name && row.file_name.toLowerCase().endsWith(".pdf");
  const wantsInline = req.query.inline === "true" && isPdf;
  const download = await materialStorage.getDownload(
    row.storage_path,
    row.file_name || path5.basename(row.storage_path),
    { inline: wantsInline }
  );
  if (download.kind === "redirect") return res.redirect(302, download.url);
  res.setHeader("X-Content-Type-Options", "nosniff");
  const fileName = row.file_name || path5.basename(row.storage_path);
  const encodedName = encodeURIComponent(fileName);
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");
  const disposition = wantsInline ? "inline" : "attachment";
  if (download.kind === "buffer") {
    const mime = row.mime_type || download.mimeType || (isPdf ? "application/pdf" : "application/octet-stream");
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    return res.send(download.buffer);
  }
  if (!fs5.existsSync(download.absolutePath)) {
    return res.status(404).json({
      error: "T\u1EC7p t\xE0i li\u1EC7u n\xE0y kh\xF4ng c\xF2n t\u1ED3n t\u1EA1i tr\xEAn b\u1ED9 nh\u1EDB t\u1EA1m c\u1EE7a m\xE1y ch\u1EE7 (do m\xE1y ch\u1EE7 Vercel t\u1EF1 \u0111\u1ED9ng d\u1ECDn d\u1EB9p b\u1ED9 nh\u1EDB t\u1EA1m). Gi\u1EA3ng vi\xEAn vui l\xF2ng t\u1EA3i l\u1EA1i t\u1EC7p n\xE0y l\xEAn bu\u1ED5i h\u1ECDc \u0111\u1EC3 h\u1EC7 th\u1ED1ng l\u01B0u tr\u1EEF v\u0129nh vi\u1EC5n v\xE0o c\u01A1 s\u1EDF d\u1EEF li\u1EC7u."
    });
  }
  if (wantsInline) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    return res.sendFile(download.absolutePath);
  }
  res.download(download.absolutePath, fileName);
}));
app.get("/api/sessions/:sessionId/materials/download-all", requireAuth, asyncHandler(async (req, res) => {
  const session = await findSessionWithOwners(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y bu\u1ED5i h\u1ECDc." });
  if (!await canViewSessionMaterials(req.user, session)) return res.status(403).json({ error: "Permission denied." });
  if (isDevMockDb) return res.status(501).json({ error: "T\u1EA3i g\xF3i t\xE0i li\u1EC7u ch\u01B0a kh\u1EA3 d\u1EE5ng trong mock mode." });
  const materials = await sessionMaterialsRepository.listRowsBySession(pool, session.id);
  const fileMaterials = materials.filter((material) => material.storage_path);
  const links = materials.filter((material) => !material.storage_path && material.url);
  if (fileMaterials.length === 0 && links.length === 0) return res.status(404).json({ error: "Bu\u1ED5i h\u1ECDc ch\u01B0a c\xF3 t\xE0i li\u1EC7u \u0111\u1EC3 t\u1EA3i." });
  const maxBundleBytes = 250 * 1024 * 1024;
  const estimatedBytes = fileMaterials.reduce((sum, material) => sum + Number(material.size_bytes || 0), 0);
  if (estimatedBytes > maxBundleBytes) return res.status(413).json({ error: "T\u1ED5ng dung l\u01B0\u1EE3ng t\xE0i li\u1EC7u v\u01B0\u1EE3t gi\u1EDBi h\u1EA1n 250 MB cho m\u1ED9t g\xF3i t\u1EA3i." });
  const usedNames = /* @__PURE__ */ new Set();
  const safeArchiveName = (value, fallback) => {
    const base = path5.basename(value || fallback).replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_").trim() || fallback;
    let candidate = base;
    let index = 2;
    while (usedNames.has(candidate)) {
      const ext = path5.extname(base);
      candidate = `${path5.basename(base, ext)}-${index++}${ext}`;
    }
    usedNames.add(candidate);
    return candidate;
  };
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on("error", (error) => {
    if (!res.headersSent) res.status(500).json({ error: "Kh\xF4ng th\u1EC3 t\u1EA1o g\xF3i t\xE0i li\u1EC7u." });
    else res.destroy(error);
  });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="mcna-${session.id}-materials.zip"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  archive.pipe(res);
  for (const material of fileMaterials) {
    try {
      const download = await materialStorage.getDownload(material.storage_path, material.file_name || material.title);
      const name = safeArchiveName(material.file_name || material.title, `material-${material.id}`);
      if (download.kind === "buffer") archive.append(download.buffer, { name });
      else if (download.kind === "redirect") {
        const response = await fetch(download.url, { signal: AbortSignal.timeout(3e4) });
        if (!response.ok) continue;
        archive.append(Buffer.from(await response.arrayBuffer()), { name });
      } else if (fs5.existsSync(download.absolutePath)) {
        archive.append(fs5.createReadStream(download.absolutePath), { name });
      }
    } catch (error) {
      console.warn(`[materials] unable to include ${material.id} in bundle`, error);
    }
  }
  if (links.length > 0) {
    const manifest = links.map((material) => `${material.title}: ${material.url}`).join("\n");
    archive.append(Buffer.from(`T\xE0i li\u1EC7u d\u1EA1ng li\xEAn k\u1EBFt c\u1EE7a bu\u1ED5i h\u1ECDc

${manifest}
`, "utf8"), { name: "links.txt" });
  }
  await archive.finalize();
  await audit(req, "download_session_material_bundle", session.id, `files=${fileMaterials.length};links=${links.length}`);
}));
app.post("/api/attendance/sessions", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.attendanceSession), asyncHandler(async (req, res) => {
  const course = await coursesRepository.findById(pool, req.body.courseId);
  if (!course) return res.status(404).json({ error: "Course not found." });
  if (req.user.role === "teacher" && course.teacherId !== req.user.id) return res.status(403).json({ error: "Permission denied." });
  const sectionValidation = await validateAttendanceSectionAccess(req.body.courseId, req.body.sectionId, req.user);
  if (sectionValidation.error) return res.status(sectionValidation.status).json({ error: sectionValidation.error });
  const session = {
    id: generateId2("ats"),
    courseId: req.body.courseId,
    sectionId: req.body.sectionId,
    teacherId: req.user.role === "teacher" ? req.user.id : course.teacherId,
    date: req.body.date,
    topic: req.body.topic,
    content: req.body.content || void 0,
    videoUrl: req.body.videoUrl || void 0,
    recordingUrl: req.body.recordingUrl || void 0
  };
  const records = (req.body.records || []).map((record) => ({
    id: generateId2("atr"),
    sessionId: session.id,
    studentId: record.studentId,
    status: record.status,
    note: record.note,
    checkinMethod: "manual"
  }));
  await attendanceRepository.saveAttendanceSession(pool, session, records);
  invalidateStoreCache();
  await audit(req, "create_attendance_session", session.id, session.courseId);
  res.status(201).json({ session, records });
}));
app.patch("/api/attendance/sessions/:id", requireAuth, requireRole(["teacher", "admin"]), validateBody(schemas.updateAttendanceSession), asyncHandler(async (req, res) => {
  const session = (await pool.query("SELECT * FROM attendance_sessions WHERE id = $1", [req.params.id])).rows[0];
  if (!session) return res.status(404).json({ error: "Attendance session not found." });
  if (req.user.role === "teacher" && session.teacher_id !== req.user.id) return res.status(403).json({ error: "Permission denied." });
  const updated = await attendanceRepository.updateSession(pool, req.params.id, req.body);
  invalidateStoreCache();
  await audit(req, "update_attendance_session", req.params.id, updated.topic);
  res.json(updated);
}));
var getVietnamTimeInfo = () => {
  const now = /* @__PURE__ */ new Date();
  const tzOffset = 7 * 60;
  const localTime = new Date(now.getTime() + (tzOffset + now.getTimezoneOffset()) * 60 * 1e3);
  const yyyy = localTime.getFullYear();
  const mm = String(localTime.getMonth() + 1).padStart(2, "0");
  const dd = String(localTime.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const day = localTime.getDay();
  const dayStr = day === 0 ? "Ch\u1EE7 Nh\u1EADt" : `Th\u1EE9 ${day === 1 ? "Hai" : day === 2 ? "Ba" : day === 3 ? "T\u01B0" : day === 4 ? "N\u0103m" : day === 5 ? "S\xE1u" : "B\u1EA3y"}`;
  const hh = String(localTime.getHours()).padStart(2, "0");
  const min = String(localTime.getMinutes()).padStart(2, "0");
  const timeStr = `${hh}:${min}`;
  return { dateStr, dayStr, timeStr };
};
var VIETNAMESE_DAYS = ["Ch\u1EE7 Nh\u1EADt", "Th\u1EE9 Hai", "Th\u1EE9 Ba", "Th\u1EE9 T\u01B0", "Th\u1EE9 N\u0103m", "Th\u1EE9 S\xE1u", "Th\u1EE9 B\u1EA3y"];
var timeToMins = (time) => {
  const [h, m] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
};
var parseSlotTime = (slotTime) => {
  const match = String(slotTime || "").trim().match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (!match) return null;
  return { startTime: match[1], endTime: match[2], normalized: `${match[1]} - ${match[2]}` };
};
var isValidDateOnly = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};
var dayOfWeekForDate = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return VIETNAMESE_DAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
};
var findScheduleSlot = (schedule, classDate, slotTime) => {
  if (!Array.isArray(schedule) || schedule.length === 0 || !isValidDateOnly(classDate)) return null;
  const parsedSlot = parseSlotTime(slotTime);
  if (!parsedSlot) return null;
  const requestedDay = dayOfWeekForDate(classDate);
  return schedule.find((slot) => {
    if (`${slot.startTime} - ${slot.endTime}` !== parsedSlot.normalized) return false;
    if (slot.specificDate) return String(slot.specificDate).slice(0, 10) === classDate;
    return slot.dayOfWeek === requestedDay;
  }) || null;
};
var isCurrentVietnamTimeWithinSlot = (classDate, slot) => {
  const { dateStr, timeStr } = getVietnamTimeInfo();
  if (dateStr !== classDate) return false;
  const currentMins = timeToMins(timeStr);
  const startMins = timeToMins(slot.startTime);
  const endMins = timeToMins(slot.endTime);
  return Number.isFinite(currentMins) && currentMins >= startMins && currentMins <= endMins;
};
var isWithinSchedule = (schedule) => {
  if (!Array.isArray(schedule) || schedule.length === 0) return true;
  const { dateStr } = getVietnamTimeInfo();
  return schedule.some((slot) => findScheduleSlot([slot], dateStr, `${slot.startTime} - ${slot.endTime}`) && isCurrentVietnamTimeWithinSlot(dateStr, slot));
};
app.post("/api/attendance/self-checkin", requireAuth, requireRole(["student"]), validateBody(schemas.selfCheckin), asyncHandler(async (req, res) => {
  const { sessionId, code } = req.body;
  const session = (await pool.query("SELECT * FROM attendance_sessions WHERE id = $1", [sessionId])).rows[0];
  if (!session) return res.status(404).json({ error: "Attendance session not found." });
  if (!session.code || session.code !== code) {
    return res.status(400).json({ error: "M\xE3 \u0111i\u1EC3m danh kh\xF4ng ch\xEDnh x\xE1c ho\u1EB7c kh\xF4ng kh\u1EA3 d\u1EE5ng." });
  }
  if (session.expires_at && new Date(session.expires_at) < /* @__PURE__ */ new Date()) {
    return res.status(400).json({ error: "M\xE3 \u0111i\u1EC3m danh \u0111\xE3 h\u1EBFt h\u1EA1n (Ch\u1EC9 c\xF3 gi\xE1 tr\u1ECB trong 5 ph\xFAt)." });
  }
  if (session.section_id) {
    const section = (await pool.query("SELECT * FROM course_sections WHERE id = $1", [session.section_id])).rows[0];
    if (section) {
      const schedule = parseSchedule(section);
      if (!isWithinSchedule(schedule)) {
        return res.status(400).json({ error: "\u0110i\u1EC3m danh kh\xF4ng h\u1EE3p l\u1EC7: Hi\u1EC7n t\u1EA1i kh\xF4ng n\u1EB1m trong khung gi\u1EDD h\u1ECDc \u0111\u01B0\u1EE3c l\xEAn l\u1ECBch c\u1EE7a l\u1EDBp n\xE0y!" });
      }
    }
    const registration = (await pool.query(
      "SELECT id FROM course_registrations WHERE student_id = $1 AND section_id = $2 AND status = 'registered'",
      [req.user.id, session.section_id]
    )).rows[0];
    if (!registration) return res.status(403).json({ error: "Permission denied for this class section." });
  } else {
    const enrollment = (await pool.query(
      "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = 'active'",
      [req.user.id, session.course_id]
    )).rows[0];
    if (!enrollment) return res.status(403).json({ error: "Active enrollment required for attendance check-in." });
  }
  const existing = (await pool.query(
    "SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2",
    [sessionId, req.user.id]
  )).rows[0];
  const record = {
    id: existing?.id || generateId2("atr"),
    sessionId,
    studentId: req.user.id,
    status: "present",
    note: "T\u1EF1 \u0111i\u1EC3m danh qua link",
    checkedInAt: (/* @__PURE__ */ new Date()).toISOString(),
    checkinMethod: "link"
  };
  await attendanceRepository.bulkMarkRecords(pool, [record]);
  await audit(req, "student_self_checkin", record.id, `Student: ${req.user.id}, Status: present`);
  res.json({ ok: true, record });
}));
app.post("/api/store/sync", requireAuth, requireRole(["admin", "manager"]), asyncHandler(async (req, res) => {
  if (isDevMockDb) {
    devMockStore = { ...devMockStore || getInitialStore(), ...req.body || {} };
    return res.json({ ok: true, mode: "dev-mock-synchronized" });
  }
  await syncClientStoreToDb(req.body || {});
  invalidateStoreCache();
  await audit(req, "store_sync", "store", "Client store changes synchronized into Postgres.");
  res.json({ ok: true, mode: "postgres-synchronized" });
}));
var initDbPromise = null;
async function ensureDatabaseReady() {
  if (!initDbPromise) {
    initDbPromise = (async () => {
      if (!isDevMockDb) {
        try {
          await pool.query(`
            ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_url TEXT;
            ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attachment_url TEXT;
            ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS attachment_url TEXT;
            ALTER TABLE assignments ADD COLUMN IF NOT EXISTS session_id TEXT;
            ALTER TABLE assignments ADD COLUMN IF NOT EXISTS lesson_id TEXT;
            ALTER TABLE assignments ADD COLUMN IF NOT EXISTS type TEXT;
            ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS session_id TEXT;
          `);
        } catch (err) {
          console.warn("[ensureDatabaseReady] Schema auto-patch notice:", err?.message);
        }
      }
      return initializeDatabase();
    })();
  }
  return initDbPromise;
}
app.use((err, _req, res, _next) => {
  console.error("[ErrorHandler]", err);
  if (res.headersSent) return;
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Dung l\u01B0\u1EE3ng t\u1EC7p v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n cho ph\xE9p (50 MB)." });
      return;
    }
    res.status(400).json({ error: `L\u1ED7i t\u1EA3i t\u1EC7p: ${err.message}` });
    return;
  }
  const status = typeof err.status === "number" ? err.status : typeof err.statusCode === "number" ? err.statusCode : 500;
  const errorMessage = err.message || (status >= 500 ? "L\u1ED7i m\xE1y ch\u1EE7 n\u1ED9i b\u1ED9. Vui l\xF2ng th\u1EED l\u1EA1i sau." : "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7.");
  res.status(status).json({ error: errorMessage });
});
async function setupServer() {
  await ensureDatabaseReady();
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path5.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path5.join(distPath, "index.html")));
  }
  const HOST = process.env.HOST || "0.0.0.0";
  const server = app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));
  server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS || 0);
}
if (!process.env.VERCEL) {
  setupServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
var server_default = app;

// src/server/serverlessHandler.ts
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.VERCEL = process.env.VERCEL || "1";
void ensureDatabaseReady().catch((err) => {
  console.error("Vercel Serverless DB initialization error:", err);
});
function handler(req, res) {
  const originalPath = req.headers["x-matched-path"] || req.url;
  if (originalPath && req.url !== originalPath) {
    req.url = originalPath;
  }
  return server_default(req, res);
}
export {
  handler as default
};
