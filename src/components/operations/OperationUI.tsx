import React from 'react';
export const inputClass='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';
export const buttonClass='rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed';
export function Field({label,children}:{label:string;children:React.ReactNode}) {return <label className="block space-y-1 text-sm text-slate-600"><span>{label}</span>{children}</label>;}
export function Panel({title,children}:{title:string;children:React.ReactNode}) {return <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-5 space-y-4"><h3 className="text-lg font-semibold text-slate-900">{title}</h3>{children}</section>;}
