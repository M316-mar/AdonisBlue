"use client";

import React, { useState } from "react";

type ClientContactCardProps = {
  name: string;
  phone?: string | null;
  email?: string | null;
  badge?: React.ReactNode;
};

export function ClientContactCard({ name, phone, email, badge }: ClientContactCardProps) {
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [emailVisible, setEmailVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-teal-400 to-[#1a2744] flex items-center justify-center text-white text-sm font-bold">
          {name.charAt(0).toUpperCase()}
        </div>
        <span className="font-bold text-[#1a2744] text-sm">{name}</span>
        {badge}
      </div>
      {(phone || email) && (
        <div className="flex items-center gap-2 flex-wrap pl-11">
          {phone && (
            <button
              type="button"
              onClick={() => setPhoneVisible((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              📞{phoneVisible && <span className="ml-0.5 text-slate-700">{phone}</span>}
            </button>
          )}
          {email && (
            <button
              type="button"
              onClick={() => setEmailVisible((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              ✉️{emailVisible && <span className="ml-0.5 text-slate-700">{email}</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
