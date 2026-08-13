"use client";

import { useState, InputHTMLAttributes } from "react";

export default function PasswordInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`input w-full pr-12 ${className}`}
      />

      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-0 h-full flex items-center justify-center text-slate-400 hover:text-slate-600"
      >
        <span className="material-symbols-outlined text-[20px]">
          {visible ? "visibility_off" : "visibility"}
        </span>
      </button>
    </div>
  );
}