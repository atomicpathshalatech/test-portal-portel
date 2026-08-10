"use client";
import { useState, InputHTMLAttributes } from "react";

export default function PasswordInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`input pr-10 w-full ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        <span className="material-symbols-outlined text-lg">
          {visible ? "visibility_off" : "visibility"}
        </span>
      </button>
    </div>
  );
}
