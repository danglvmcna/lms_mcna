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
      case "super_admin":
      case "admin":
      case "manager":
        return "bg-red-500/20 text-red-300 border border-red-500/30";
      case "teacher":
        return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
      case "student":
        return "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border border-gray-500/30";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
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
      <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-8 text-center text-white/50 space-y-3 flex flex-col items-center justify-center min-h-[250px]">
        <MessageSquare className="w-10 h-10 text-indigo-400/60 mx-auto animate-bounce" />
        <h5 className="font-bold text-white text-sm">Bạn chưa được xếp lớp học phần cụ thể</h5>
        <p className="text-xs text-white/60 max-w-md mx-auto leading-relaxed">
          Diễn đàn thảo luận được tổ chức riêng biệt cho từng lớp học. Bạn cần được Giáo vụ xếp vào lớp học phần cụ thể của môn học này để tham gia thảo luận.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl text-white">
      {selectedPost ? (
        // Detailed Post view
        <div className="space-y-6">
          <button
            onClick={() => setSelectedPostId(null)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition duration-200 focus:outline-none"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Quay lại danh sách</span>
          </button>

          {/* Original Post */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">{selectedPost.title}</h2>
                <div className="flex items-center gap-3 mt-2 text-sm text-white/50">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <User className="w-4 h-4" />
                    <span className="font-semibold text-white/80">
                      {getAuthorDetails(selectedPost.authorId).name}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${getRoleBadgeColor(getAuthorDetails(selectedPost.authorId).role)}`}>
                      {getRoleLabel(getAuthorDetails(selectedPost.authorId).role)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(selectedPost.createdAt).toLocaleString("vi-VN")}</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-white/80 whitespace-pre-wrap leading-relaxed text-base">
              {selectedPost.content}
            </p>
          </div>

          {/* Replies Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-white/80">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
              <span>Thảo luận ({selectedPost.replies?.length || 0})</span>
            </h3>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {selectedPost.replies && selectedPost.replies.length > 0 ? (
                selectedPost.replies.map((reply: any) => {
                  const replyAuthor = getAuthorDetails(reply.authorId);
                  return (
                    <div key={reply.id} className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-sm flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white/95">{replyAuthor.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${getRoleBadgeColor(replyAuthor.role)}`}>
                            {getRoleLabel(replyAuthor.role)}
                          </span>
                        </div>
                        <span className="text-white/40 text-xs">
                          {new Date(reply.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>
                      <p className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">
                        {reply.content}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-white/40 bg-white/5 rounded-xl border border-dashed border-white/10">
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
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition duration-200 text-white placeholder-white/40 resize-none h-24"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !replyContent.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition duration-200 focus:outline-none cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? "Đang gửi..." : "Gửi câu trả lời"}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-3 text-white/50 bg-white/5 border border-white/10 rounded-xl text-sm italic">
              Bạn đang ở chế độ xem (Chỉ đọc). Phụ huynh không thể gửi thảo luận.
            </div>
          )}
        </div>
      ) : isCreatingPost ? (
        // Create Post Form view
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-wide">Tạo bài thảo luận mới</h2>
            <button
              onClick={() => setIsCreatingPost(false)}
              className="text-white/60 hover:text-white transition focus:outline-none"
            >
              Hủy bỏ
            </button>
          </div>

          <form onSubmit={handleCreatePost} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-white/80">Tiêu đề bài viết</label>
              <input
                type="text"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="Nhập tiêu đề ngắn gọn, rõ ràng..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition duration-200 text-white placeholder-white/40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-white/80">Nội dung chi tiết</label>
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Mô tả chi tiết câu hỏi hoặc chủ đề thảo luận của bạn..."
                className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition duration-200 text-white placeholder-white/40 resize-none h-44"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingPost(false)}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold border border-white/10 transition duration-200 active:scale-95 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !newPostTitle.trim() || !newPostContent.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition duration-200 cursor-pointer"
              >
                <Plus className="w-4.5 h-4.5" />
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
              <h2 className="text-xl font-bold tracking-wide">Diễn đàn thảo luận {currentSection ? `lớp ${currentSection.sectionCode}` : "khóa học"}</h2>
              <p className="text-sm text-white/50 mt-1">Nơi trao đổi câu hỏi, kiến thức học tập giữa lớp học</p>
            </div>
            {!isReadOnly && (
              <button
                onClick={() => setIsCreatingPost(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl font-semibold shadow-lg hover:shadow-indigo-500/20 transition duration-200 cursor-pointer"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>Tạo thảo luận mới</span>
              </button>
            )}
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-4.5 h-4.5 text-white/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm bài viết, thảo luận..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition duration-200 text-white placeholder-white/40"
            />
          </div>

          {/* Posts List */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post: any) => {
                const author = getAuthorDetails(post.authorId);
                return (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPostId(post.id)}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-5 cursor-pointer transition duration-300 transform hover:-translate-y-0.5 space-y-3 group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition duration-200">
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-white/60 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full shrink-0">
                        <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{post.replies?.length || 0} phản hồi</span>
                      </div>
                    </div>

                    <p className="text-white/60 text-sm line-clamp-2 leading-relaxed">
                      {post.content}
                    </p>

                    <div className="flex items-center justify-between text-xs text-white/40 pt-1 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white/70">{author.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.1 rounded-full ${getRoleBadgeColor(author.role)}`}>
                          {getRoleLabel(author.role)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(post.createdAt).toLocaleDateString("vi-VN")}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-white/40 bg-white/5 rounded-xl border border-dashed border-white/10">
                {searchTerm ? "Không tìm thấy bài thảo luận nào phù hợp." : "Chưa có cuộc thảo luận nào trong môn học này."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
