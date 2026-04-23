"use client";

import { useState, useRef, useCallback } from "react";
import { Paperclip, X, FileText, Image, Loader2 } from "lucide-react";

export interface UploadedFile {
  fileId: string;
  filename: string;
  mimeType: string;
  extractedText: string;
  url: string;
}

interface FileDropZoneProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
}

const FILE_ICONS: Record<string, typeof FileText> = {
  "application/pdf": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,
  "application/msword": FileText,
  "text/plain": FileText,
  "text/csv": FileText,
  "text/markdown": FileText,
};

export function FileDropZone({ files, onFilesChange, disabled }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Upload failed");
    }

    return await res.json() as UploadedFile;
  }, []);

  const handleFiles = useCallback(async (fileList: FileList) => {
    if (disabled || uploading) return;

    setUploading(true);
    try {
      const newFiles: UploadedFile[] = [];
      for (const file of Array.from(fileList)) {
        const uploaded = await uploadFile(file);
        newFiles.push(uploaded);
      }
      onFilesChange([...files, ...newFiles]);
    } catch (err: any) {
      console.error("Upload error:", err.message);
    } finally {
      setUploading(false);
    }
  }, [disabled, uploading, uploadFile, files, onFilesChange]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (fileId: string) => {
    onFilesChange(files.filter(f => f.fileId !== fileId));
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return Image;
    return FILE_ICONS[mimeType] || FileText;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="mb-2 border-2 border-dashed border-[var(--accent)] rounded-xl p-6 text-center bg-[var(--accent)]/5">
          <p className="text-sm text-[var(--accent)] font-medium">Drop files here</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">PDF, DOCX, TXT, or images</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((file) => {
            const Icon = getFileIcon(file.mimeType);
            return (
              <div
                key={file.fileId}
                className="flex items-center gap-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs"
              >
                <Icon size={14} className="text-[var(--accent)] shrink-0" />
                <span className="max-w-[150px] truncate text-[var(--text)]">{file.filename}</span>
                <button
                  onClick={() => removeFile(file.fileId)}
                  className="p-0.5 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {uploading && (
        <div className="flex items-center gap-2 mb-2 text-xs text-[var(--text-muted)]">
          <Loader2 size={14} className="animate-spin" />
          Uploading...
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        accept=".pdf,.docx,.doc,.txt,.csv,.md,.png,.jpg,.jpeg,.gif,.webp"
        multiple
        className="hidden"
      />

      {!isDragging && files.length === 0 && !uploading && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex items-center gap-1.5 mb-2 px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-40"
        >
          <Paperclip size={14} /> Attach files
        </button>
      )}

      {files.length > 0 && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex items-center gap-1 mb-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
        >
          <Paperclip size={10} /> Add more
        </button>
      )}
    </div>
  );
}
