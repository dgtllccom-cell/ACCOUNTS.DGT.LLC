"use client";

import { A4DocumentViewer } from "@/components/ui/a4-document-viewer";

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** detail views wider than an A4 page (multi-column reports) */
  wide?: boolean;
}

/**
 * Record "View" panel used across the ERP. It used to slide in from the side over a still-visible screen; it now opens
 * the record full screen as one centred A4 page (see A4DocumentViewer), the same in every module.
 * `className` applies to the page; callers that asked for a full-width panel ("max-w-none") get the wide page.
 */
export function DetailDrawer({ isOpen, onClose, title, subtitle, children, actions, className, wide }: DetailDrawerProps) {
  const askedFullWidth = /max-w-none|w-screen/.test(className ?? "");
  const pageClassName = (className ?? "")
    .split(/\s+/)
    .filter((c) => c && !/^(sm:|md:)?max-w-none$|^w-screen$|^h-screen$/.test(c))
    .join(" ");
  return (
    <A4DocumentViewer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      actions={actions}
      wide={wide ?? askedFullWidth}
      pageClassName={pageClassName || undefined}
      testId="detail-drawer"
    >
      {children}
    </A4DocumentViewer>
  );
}
