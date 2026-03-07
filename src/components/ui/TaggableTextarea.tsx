"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface ImageTag {
  number: number;
  label: string;
  thumbnailUrl: string;
}

interface TaggableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  images: ImageTag[];
}

export function TaggableTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
  images,
}: TaggableTextareaProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [atPosition, setAtPosition] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const filteredImages = images.filter(
    (img) =>
      filter === "" ||
      String(img.number).startsWith(filter) ||
      img.label.toLowerCase().includes(filter.toLowerCase())
  );

  const closePopover = useCallback(() => {
    setShowPopover(false);
    setAtPosition(null);
    setFilter("");
    setSelectedIndex(0);
  }, []);

  const insertTag = useCallback(
    (tag: ImageTag) => {
      if (atPosition === null || !textareaRef.current) return;
      const before = value.slice(0, atPosition);
      const cursorPos = textareaRef.current.selectionStart;
      const after = value.slice(cursorPos);
      const tagText = `@${tag.number}`;
      const newValue = before + tagText + " " + after;
      onChange(newValue);
      closePopover();

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = before.length + tagText.length + 1;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    [atPosition, value, onChange, closePopover]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);

    // Check if @ was just typed at a word boundary
    if (newValue[cursorPos - 1] === "@" && images.length > 0) {
      const charBefore = cursorPos > 1 ? newValue[cursorPos - 2] : " ";
      if (" \n\t".includes(charBefore) || cursorPos === 1) {
        setShowPopover(true);
        setAtPosition(cursorPos - 1);
        setFilter("");
        setSelectedIndex(0);
        return;
      }
    }

    // Update filter if popover is open
    if (showPopover && atPosition !== null) {
      const textAfterAt = newValue.slice(atPosition + 1, cursorPos);
      if (
        textAfterAt.includes(" ") ||
        textAfterAt.includes("\n") ||
        cursorPos <= atPosition
      ) {
        closePopover();
      } else {
        setFilter(textAfterAt);
        setSelectedIndex(0);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showPopover || filteredImages.length === 0) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closePopover();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredImages.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filteredImages.length) % filteredImages.length
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertTag(filteredImages[selectedIndex]);
    }
  };

  // Close on click outside
  useEffect(() => {
    if (!showPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        closePopover();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPopover, closePopover]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredImages.length) {
      setSelectedIndex(Math.max(0, filteredImages.length - 1));
    }
  }, [filteredImages.length, selectedIndex]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />
      {showPopover && filteredImages.length > 0 && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-50 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border/50 px-2 py-1 text-[9px] font-medium uppercase text-muted">
            Reference images
          </div>
          {filteredImages.map((img, idx) => (
            <button
              key={img.number}
              onClick={() => insertTag(img)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] transition ${
                idx === selectedIndex ? "bg-accent/10" : "hover:bg-accent/5"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.thumbnailUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-md border border-border object-cover"
              />
              <span className="font-mono font-bold text-accent">
                @{img.number}
              </span>
              <span className="truncate text-muted">{img.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
