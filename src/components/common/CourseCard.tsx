import React from "react";
import { formatPrice, formatVnd } from "../../lib/format";
import { CourseCover } from "../ui";

/** Catalog card shared by the public landing page and the in-app Explore tab. */
export default function CourseCard({ title, category, level, description, thumbnail, price, originalPrice, status, onOpen }: {
  title: string;
  category?: string;
  level?: string;
  description?: string;
  thumbnail?: string;
  price?: number;
  originalPrice?: number;
  status?: React.ReactNode;
  onOpen: () => void;
}) {
  const hasDiscount = Boolean(originalPrice && price !== undefined && originalPrice > price);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/70 bg-white text-left shadow-card hover:-translate-y-1 hover:shadow-raised focus-visible:-translate-y-1"
    >
      <CourseCover src={thumbnail} title={title} category={category} className="aspect-[16/10] w-full" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          {category && <span className="font-semibold text-indigo-600">{category}</span>}
          {level && <span className="text-slate-400">· {level}</span>}
        </div>
        <h3 className="line-clamp-2 text-[17px] font-bold leading-snug text-slate-900 group-hover:text-indigo-700">{title}</h3>
        {description && <p className="line-clamp-2 text-sm leading-relaxed text-slate-500">{description}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div>
            {hasDiscount && <p className="text-xs text-slate-400 line-through">{formatVnd(originalPrice!)}</p>}
            <p className="text-base font-bold text-slate-900">{formatPrice(price)}</p>
          </div>
          {status}
        </div>
      </div>
    </button>
  );
}
