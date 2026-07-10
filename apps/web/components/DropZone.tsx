"use client";

import { useRef, useState } from "react";

export default function DropZone({
  disabled,
  onFiles,
}: {
  disabled: boolean;
  onFiles: (files: File[]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (disabled) return;
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) onFiles(files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition ${
        disabled
          ? "cursor-not-allowed border-black/10 text-black/30 dark:border-white/10 dark:text-white/30"
          : isDragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-black/20 hover:border-black/30 dark:border-white/20 dark:hover:border-white/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = "";
        }}
      />
      <p className="text-sm font-medium">
        {disabled ? "先选择一个设备" : "拖拽文件到这里,或点击选择"}
      </p>
    </div>
  );
}
