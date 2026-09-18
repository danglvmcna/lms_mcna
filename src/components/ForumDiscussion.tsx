import React, { useState } from "react";
import { MessageSquare, Send, Plus, ArrowLeft, Search, User, Clock, MessageCircle } from "lucide-react";
import { api } from "../api";

interface ForumDiscussionProps {
  courseId: string;
  sectionId?: string | null;
  store: any;
  currentUser: any;
  onRefreshData: () => void;
  triggerToast: (message: string, type: "success" | "error" | "info" | "warning") => void;
}

export default function ForumDiscussion({
  courseId,
  sectionId,
  store,
  currentUser,
  onRefreshData,
  triggerToast
}: ForumDiscussionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter posts for the current course and section
  // Normalize sectionId before comparing: server maps course-level posts to `undefined`,
  // but some callers pass `null` for "no section" — undefined !== null in JS.
  const coursePosts = (store.forumPosts || []).filter(
    (post: any) => post.courseId === courseId && (post.sectionId ?? null) === (sectionId ?? null)
  );

  // Search filter
  const filteredPosts = coursePosts.filter(
    (post: any) =>
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPost = coursePosts.find((p: any) => p.id === selectedPostId);
  const currentSection = sectionId ? (store.courseSections || []).find((section: any) => section.id === sectionId) : null;

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      triggerToast("Vui lòng điền đầy đủ tiêu đề và nội dung bài viết.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.createForumPost(courseId, {
        title: newPostTitle.trim(),
        content: newPostContent.trim(),
        sectionId: sectionId || undefined
      });
      triggerToast("Đăng bài viết mới thành công!", "success");
      setNewPostTitle("");
      setNewPostContent("");
      setIsCreatingPost(false);
      onRefreshData();
    } catch (error: any) {
      triggerToast(error.message || "Không thể đăng bài viết.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) {
      triggerToast("Vui lòng nhập nội dung bình luận.", "warning");
      return;
    }

    if (!selectedPostId) return;

    setIsSubmitting(true);
    try {
      await api.createForumReply(selectedPostId, {
        content: replyContent.trim()
      });
      triggerToast("Gửi bình luận thành công!", "success");
      setReplyContent("");
      onRefreshData();
    } catch (error: any) {
      triggerToast(error.message || "Không thể gửi bình luận.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAuthorDetails = (authorId: string) => {
    const user = (store.users || []).find((u: any) => u.id === authorId);
    if (!user) return { name: "Người dùng ẩn danh", role: "student" };
    return { name: user.name, role: user.role };
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
      case "manager":
        return "bg-rose-50 text-rose-700 border border-rose-200";
      case "teacher":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      case "student":
        return "bg-indigo-50 text-indigo-700 border border-indigo-200";
      default:
        return "bg-slate-100 text-slate-600 border border-slate-200";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "manager":
        return "Quản lý";
      case "teacher":
        return "Giảng viên";
      case "student":
        return "Học viên";
      default:
        return "Thành viên";
    }
  };

  const isReadOnly = currentUser.role === "parent";

  if (!sectionId) {
    return (
      <div className="w-full bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500 space-y-3 flex flex-col items-center justify-center min-h-[250px]">
        <MessageSquare className="w-10 h-10 text-indigo-600 mx-auto animate-bounce" />
        <h5 className="font-bold text-slate-900 text-sm">Bạn chưa được xếp lớp học phần cụ thể</h5>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Diễn đàn thảo luận được tổ chức riêng biệt cho từng lớp học. Bạn cần được Giáo vụ xếp vào lớp học phần cụ thể của môn học này để tham gia thảo luận.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs text-slate-900">
      {selectedPost ? (
        // Detailed Post view
        <div className="space-y-6">
          <button
            onClick={() => setSelectedPostId(null)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-xs font-semibold transition duration-150 focus:outline-none cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại danh sách</span>
          </button>

          {/* Original Post */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">{selectedPost.title}</h2>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800">
                      {getAuthorDetails(selectedPost.authorId).name}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getRoleBadgeColor(getAuthorDetails(selectedPost.authorId).role)}`}>
                      {getRoleLabel(getAuthorDetails(selectedPost.authorId).role)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(selectedPost.createdAt).toLocaleString("vi-VN")}</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
              {selectedPost.content}
            </p>
          </div>

          {/* Replies Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span>Thảo luận ({selectedPost.replies?.length || 0})</span>
            </h3>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {selectedPost.replies && selectedPost.replies.length > 0 ? (
                selectedPost.replies.map((reply: any) => {
                  const replyAuthor = getAuthorDetails(reply.authorId);
                  return (
                    <div key={reply.id} className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2 shadow-xs">
                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{replyAuthor.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-medium ${getRoleBadgeColor(replyAuthor.role)}`}>
                            {getRoleLabel(replyAuthor.role)}
                          </span>
                        </div>
                        <span className="text-slate-400 text-[11px]">
                          {new Date(reply.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>
                      <p className="text-slate-700 text-xs whitespace-pre-wrap leading-relaxed">
                        {reply.content}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                  Chưa có bình luận nào cho bài viết này. Hãy là người đầu tiên thảo luận!
                </div>
              )}
            </div>
          </div>

          {/* Reply Form */}
          {!isReadOnly ? (
            <form onSubmit={handleCreateReply} className="space-y-3">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Nhập nội dung trả lời thảo luận..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 placeholder-slate-400 resize-none h-24 shadow-xs"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !replyContent.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-xs transition duration-150 focus:outline-none cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Đang gửi..." : "Gửi câu trả lời"}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-3 text-slate-500 bg-slate-50 border border-slate-200 rounded-xl text-xs italic">
              Bạn đang ở chế độ xem (Chỉ đọc). Phụ huynh không thể gửi thảo luận.
            </div>
          )}
        </div>
      ) : isCreatingPost ? (
        // Create Post Form view
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Tạo bài thảo luận mới</h2>
            <button
              onClick={() => setIsCreatingPost(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold transition focus:outline-none cursor-pointer"
            >
              Hủy bỏ
            </button>
          </div>

          <form onSubmit={handleCreatePost} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Tiêu đề bài viết</label>
              <input
                type="text"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="Nhập tiêu đề ngắn gọn, rõ ràng..."
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 placeholder-slate-400 shadow-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Nội dung chi tiết</label>
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Mô tả chi tiết câu hỏi hoặc chủ đề thảo luận của bạn..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3.5 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 placeholder-slate-400 resize-none h-44 shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingPost(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newPostTitle.trim() || !newPostContent.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? "Đang đăng..." : "Đăng bài thảo luận"}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        // List of Posts view
        <div className="space-y-6">
          {/* Header & New Post button */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Diễn đàn thảo luận {currentSection ? `lớp ${currentSection.sectionCode}` : "khóa học"}</h2>
              <p className="text-xs text-slate-500 mt-0.5">Nơi trao đổi câu hỏi, kiến thức học tập giữa lớp học</p>
            </div>
            {!isReadOnly && (
              <button
                onClick={() => setIsCreatingPost(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo thảo luận mới</span>
              </button>
            )}
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm bài viết, thảo luận..."
              className="w-full bg-white border border-slate-200/80 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 text-slate-900 placeholder-slate-400 shadow-xs"
            />
          </div>

          {/* Posts List */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post: any) => {
                const author = getAuthorDetails(post.authorId);
                return (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPostId(post.id)}
                    className="bg-white hover:bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 cursor-pointer transition shadow-xs space-y-2.5 group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition">
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full shrink-0 font-medium">
                        <MessageCircle className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{post.replies?.length || 0} phản hồi</span>
                      </div>
                    </div>

                    <p className="text-slate-600 text-xs line-clamp-2 leading-relaxed">
                      {post.content}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700">{author.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.1 rounded-full font-medium ${getRoleBadgeColor(author.role)}`}>
                          {getRoleLabel(author.role)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(post.createdAt).toLocaleDateString("vi-VN")}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs">
                {searchTerm ? "Không tìm thấy bài thảo luận nào phù hợp." : "Chưa có cuộc thảo luận nào trong môn học này."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
