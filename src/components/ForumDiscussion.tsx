import React, { useState } from "react";
import { ArrowLeft, MessageCircle, MessagesSquare, Plus, Send } from "lucide-react";
import { api } from "../api";
import { relativeTime } from "../lib/format";
import { Avatar, Badge, Button, Card, cx, EmptyState, Field, inputClass, SearchField, Tone } from "./ui";

interface ForumDiscussionProps {
  courseId: string;
  sectionId?: string | null;
  store: any;
  currentUser: any;
  onRefreshData: () => void;
  triggerToast: (message: string, type?: "success" | "error" | "info" | "warning") => void;
}

const ROLE: Record<string, { label: string; tone: Tone }> = {
  admin: { label: "Quản trị", tone: "danger" },
  manager: { label: "Quản lý", tone: "danger" },
  teacher: { label: "Giảng viên", tone: "warning" },
  student: { label: "Học viên", tone: "primary" }
};

export default function ForumDiscussion({ courseId, sectionId, store, currentUser, onRefreshData, triggerToast }: ForumDiscussionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The server maps course-level posts to `undefined` while some callers pass `null` for "no section".
  const coursePosts = (store.forumPosts || [])
    .filter((post: any) => post.courseId === courseId && (post.sectionId ?? null) === (sectionId ?? null))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredPosts = coursePosts.filter((post: any) =>
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) || post.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPost = coursePosts.find((p: any) => p.id === selectedPostId);
  const currentSection = sectionId ? (store.courseSections || []).find((section: any) => section.id === sectionId) : null;
  const isReadOnly = currentUser.role === "parent";

  const author = (authorId: string) => {
    const user = (store.users || []).find((u: any) => u.id === authorId);
    return user ? { name: user.name, role: user.role } : { name: "Người dùng ẩn danh", role: "student" };
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      triggerToast("Vui lòng điền tiêu đề và nội dung câu hỏi.", "warning");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.createForumPost(courseId, { title: newPostTitle.trim(), content: newPostContent.trim(), sectionId: sectionId || undefined });
      triggerToast("Đã đăng câu hỏi!", "success");
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
    if (!replyContent.trim() || !selectedPostId) return;
    setIsSubmitting(true);
    try {
      await api.createForumReply(selectedPostId, { content: replyContent.trim() });
      setReplyContent("");
      onRefreshData();
    } catch (error: any) {
      triggerToast(error.message || "Không thể gửi bình luận.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sectionId) {
    return (
      <Card>
        <EmptyState illustration="chat" icon={<MessagesSquare className="h-6 w-6" />} title="Bạn chưa được xếp lớp" description="Mỗi lớp có một góc thảo luận riêng. Khi được xếp lớp, bạn có thể hỏi đáp cùng giảng viên và các bạn tại đây." />
      </Card>
    );
  }

  /* ---------------------------------------------------------------- Thread */
  if (selectedPost) {
    const op = author(selectedPost.authorId);
    const replies = selectedPost.replies || [];
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <button type="button" onClick={() => setSelectedPostId(null)} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
          <ArrowLeft className="h-4 w-4" /> Tất cả thảo luận
        </button>

        <Card className="space-y-4 p-5 md:p-6">
          <div className="flex items-center gap-3">
            <Avatar name={op.name} size={40} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">{op.name} <Badge tone={ROLE[op.role]?.tone || "neutral"}>{ROLE[op.role]?.label || "Thành viên"}</Badge></p>
              <p className="text-xs text-slate-500">{relativeTime(selectedPost.createdAt)}</p>
            </div>
          </div>
          <h2 className="text-xl font-bold leading-snug text-slate-900">{selectedPost.title}</h2>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{selectedPost.content}</p>
        </Card>

        <h3 className="px-1 text-sm font-semibold text-slate-500">{replies.length} trả lời</h3>
        <ul className="space-y-3">
          {replies.map((reply: any) => {
            const replyAuthor = author(reply.authorId);
            const mine = reply.authorId === currentUser.id;
            return (
              <li key={reply.id} className={cx("flex gap-3", mine && "flex-row-reverse")}>
                <Avatar name={replyAuthor.name} size={32} className="mt-1" />
                <div className={cx("max-w-[85%] rounded-[1.25rem] px-4 py-3", mine ? "rounded-tr-md bg-indigo-600 text-white" : "rounded-tl-md bg-white shadow-card ring-1 ring-slate-200/70")}>
                  <p className={cx("mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold", mine ? "text-indigo-100" : "text-slate-500")}>
                    {mine ? "Bạn" : replyAuthor.name}
                    {!mine && replyAuthor.role === "teacher" && <Badge tone="warning">Giảng viên</Badge>}
                    <span className={cx("font-normal", mine ? "text-indigo-200" : "text-slate-500")}>{relativeTime(reply.createdAt)}</span>
                  </p>
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{reply.content}</p>
                </div>
              </li>
            );
          })}
          {replies.length === 0 && <li className="px-1 text-sm text-slate-500">Chưa có ai trả lời. Hãy là người đầu tiên!</li>}
        </ul>

        {!isReadOnly && (
          <form onSubmit={handleCreateReply} className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] flex items-end gap-2 rounded-[1.5rem] bg-white p-2 shadow-raised ring-1 ring-slate-200/70 lg:bottom-6">
            <label htmlFor="forum-reply" className="sr-only">Viết câu trả lời</label>
            <textarea
              id="forum-reply"
              value={replyContent}
              onChange={e => setReplyContent(e.target.value)}
              placeholder="Viết câu trả lời…"
              rows={1}
              className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <Button type="submit" aria-label="Gửi" loading={isSubmitting} disabled={!replyContent.trim()} className="h-11 w-11 !px-0">
              {!isSubmitting && <Send className="h-4 w-4" />}
            </Button>
          </form>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- New post */
  if (isCreatingPost) {
    return (
      <Card className="mx-auto max-w-2xl space-y-5 p-5 md:p-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Đặt câu hỏi mới</h2>
          <p className="mt-1 text-sm text-slate-500">Câu hỏi rõ ràng sẽ nhận được câu trả lời nhanh hơn.</p>
        </div>
        <form onSubmit={handleCreatePost} className="space-y-4">
          <Field label="Tiêu đề" htmlFor="forum-title">
            <input id="forum-title" type="text" value={newPostTitle} onChange={e => setNewPostTitle(e.target.value)} placeholder="Ví dụ: Vì sao vòng lặp for bị lỗi ở bài 2?" className={inputClass} />
          </Field>
          <Field label="Nội dung" htmlFor="forum-content">
            <textarea id="forum-content" value={newPostContent} onChange={e => setNewPostContent(e.target.value)} placeholder="Mô tả bạn đã thử gì và bị vướng ở đâu…" className="mcna-textarea h-44 resize-y" />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setIsCreatingPost(false)}>Hủy</Button>
            <Button type="submit" loading={isSubmitting} disabled={!newPostTitle.trim() || !newPostContent.trim()}>Đăng câu hỏi</Button>
          </div>
        </form>
      </Card>
    );
  }

  /* ---------------------------------------------------------------- List */
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Thảo luận {currentSection ? `lớp ${currentSection.sectionCode}` : ""}</h2>
          <p className="text-sm text-slate-500">Hỏi bài, chia sẻ mẹo và giúp đỡ các bạn cùng lớp.</p>
        </div>
        {!isReadOnly && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setIsCreatingPost(true)}>Đặt câu hỏi</Button>}
      </div>

      {coursePosts.length > 3 && <SearchField value={searchTerm} onChange={setSearchTerm} placeholder="Tìm trong thảo luận…" />}

      {filteredPosts.length > 0 ? (
        <Card as="ul" className="divide-y divide-slate-100 overflow-hidden">
          {filteredPosts.map((post: any) => {
            const postAuthor = author(post.authorId);
            const replies = post.replies?.length || 0;
            return (
              <li key={post.id}>
                <button type="button" onClick={() => setSelectedPostId(post.id)} className="group flex w-full items-start gap-3.5 px-4 py-4 text-left hover:bg-slate-900/[0.025] md:px-5">
                  <Avatar name={postAuthor.name} size={36} className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">{post.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-sm text-slate-500">{post.content}</span>
                    <span className="mt-1.5 block text-xs text-slate-500">{postAuthor.name} · {relativeTime(post.createdAt)}</span>
                  </span>
                  <span className={cx("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", replies ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500")}>
                    <MessageCircle className="h-3.5 w-3.5" /> {replies}
                  </span>
                </button>
              </li>
            );
          })}
        </Card>
      ) : (
        <Card>
          <EmptyState
            illustration="chat"
            icon={<MessagesSquare className="h-6 w-6" />}
            title={searchTerm ? "Không tìm thấy thảo luận" : "Chưa có thảo luận nào"}
            description={searchTerm ? "Thử tìm với từ khóa khác." : "Có thắc mắc về bài học? Hãy là người đầu tiên đặt câu hỏi."}
            action={!searchTerm && !isReadOnly ? <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setIsCreatingPost(true)}>Đặt câu hỏi</Button> : undefined}
          />
        </Card>
      )}
    </div>
  );
}
