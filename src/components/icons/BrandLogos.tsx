import React from "react";

export interface BrandIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * Official Zoom Logo
 * Authentic Zoom Blue (#0B5CFF) with white video camera
 */
export function ZoomLogo({ className = "h-5 w-5", size, ...props }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      <rect width="24" height="24" rx="5.5" fill="#0B5CFF" />
      <path
        d="M4.5 9C4.5 7.619 5.619 6.5 7 6.5H13C14.381 6.5 15.5 7.619 15.5 9V15C15.5 16.381 14.381 17.5 13 17.5H7C5.619 17.5 4.5 16.381 4.5 15V9Z"
        fill="white"
      />
      <path
        d="M16 10.152L18.887 8.09C19.349 7.76 20 8.09 20 8.654V15.346C20 15.91 19.349 16.24 18.887 15.91L16 13.848V10.152Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Official Microsoft PowerPoint / Slide Logo (PPT / PPTX)
 * Authentic PowerPoint Orange-Red (#D24726) with distinctive "P" & presentation layout
 */
export function PowerPointLogo({ className = "h-5 w-5", size, ...props }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      {/* Right presentation background sheet */}
      <rect x="7" y="3" width="14" height="18" rx="2.5" fill="#F15B38" />
      {/* Circle pie/chart slice on presentation sheet */}
      <circle cx="14" cy="9.5" r="3.2" fill="white" fillOpacity="0.85" />
      <path d="M14 6.3V9.5H17.2C17.2 7.73 15.77 6.3 14 6.3Z" fill="#D24726" />
      {/* Left PowerPoint P emblem plate */}
      <rect x="3" y="5.5" width="10" height="13" rx="2" fill="#D24726" />
      {/* Crisp White Letter 'P' */}
      <path
        d="M6 8.5H9.2C10.3 8.5 11.2 9.4 11.2 10.5C11.2 11.6 10.3 12.5 9.2 12.5H7.5V15.5H6V8.5ZM7.5 10V11.1H9.1C9.4 11.1 9.7 10.8 9.7 10.5C9.7 10.2 9.4 10 9.1 10H7.5Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Official Microsoft Word / Docs Logo (DOC / DOCX)
 * Authentic Word Blue (#185ABD) with distinctive "W" & document lines
 */
export function WordLogo({ className = "h-5 w-5", size, ...props }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      {/* Right document background sheet */}
      <rect x="7" y="3" width="14" height="18" rx="2.5" fill="#2B7CD3" />
      {/* Document text lines */}
      <rect x="11.5" y="7" width="6.5" height="1.5" rx="0.75" fill="white" fillOpacity="0.9" />
      <rect x="11.5" y="10" width="6.5" height="1.5" rx="0.75" fill="white" fillOpacity="0.9" />
      <rect x="11.5" y="13" width="4.5" height="1.5" rx="0.75" fill="white" fillOpacity="0.9" />
      {/* Left Word W emblem plate */}
      <rect x="3" y="5.5" width="10" height="13" rx="2" fill="#185ABD" />
      {/* Crisp White Letter 'W' */}
      <path
        d="M4.8 9H6.1L7 13.5L8 9.8H8.8L9.8 13.5L10.7 9H12L10.5 15H9.2L8.4 11.8L7.6 15H6.3L4.8 9Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Official Microsoft Excel Logo (XLS / XLSX / CSV)
 * Authentic Excel Green (#107C41) with distinctive "X" & spreadsheet grid
 */
export function ExcelLogo({ className = "h-5 w-5", size, ...props }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      {/* Right spreadsheet background sheet */}
      <rect x="7" y="3" width="14" height="18" rx="2.5" fill="#21A366" />
      {/* Spreadsheet grid cells */}
      <rect x="11" y="6.5" width="4" height="3" rx="0.5" fill="white" fillOpacity="0.8" />
      <rect x="16" y="6.5" width="3" height="3" rx="0.5" fill="white" fillOpacity="0.8" />
      <rect x="11" y="10.5" width="4" height="3" rx="0.5" fill="white" fillOpacity="0.8" />
      <rect x="16" y="10.5" width="3" height="3" rx="0.5" fill="white" fillOpacity="0.8" />
      <rect x="11" y="14.5" width="4" height="3" rx="0.5" fill="white" fillOpacity="0.8" />
      <rect x="16" y="14.5" width="3" height="3" rx="0.5" fill="white" fillOpacity="0.8" />
      {/* Left Excel X emblem plate */}
      <rect x="3" y="5.5" width="10" height="13" rx="2" fill="#107C41" />
      {/* Crisp White Letter 'X' */}
      <path
        d="M5.5 8.8L7.1 11.5L5.4 14.5H6.9L8 12.5L9.1 14.5H10.6L8.9 11.5L10.5 8.8H9L8 10.6L7 8.8H5.5Z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Official YouTube Logo
 * Authentic YouTube Red (#FF0000) with smooth rounded badge & white play triangle
 */
export function YouTubeLogo({ className = "h-5 w-5", size, ...props }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      <path
        d="M21.58 7.19A2.5 2.5 0 0 0 19.82 5.43C18.26 5 12 5 12 5s-6.26 0-7.82.43A2.5 2.5 0 0 0 2.42 7.19C2 8.75 2 12 2 12s0 3.25.42 4.81a2.5 2.5 0 0 0 1.76 1.76C5.74 19 12 19 12 19s6.26 0 7.82-.43a2.5 2.5 0 0 0 1.76-1.76C22 15.25 22 12 22 12s0-3.25-.42-4.81z"
        fill="#FF0000"
      />
      <polygon points="10,15 15.5,12 10,9" fill="white" />
    </svg>
  );
}

/**
 * Adobe PDF Logo
 * Authentic PDF Red (#E5252A) with document layout
 */
export function PdfLogo({ className = "h-5 w-5", size, ...props }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      {...props}
    >
      <rect x="3" y="2.5" width="18" height="19" rx="3" fill="#E5252A" />
      <path
        d="M7 7.5H9.8C10.7 7.5 11.4 8.2 11.4 9.1C11.4 10 10.7 10.7 9.8 10.7H8.3V13.5H7V7.5ZM8.3 8.8V9.5H9.7C9.9 9.5 10.1 9.3 10.1 9.1C10.1 8.9 9.9 8.8 9.7 8.8H8.3Z"
        fill="white"
      />
      <path
        d="M12.5 7.5H14.5C15.9 7.5 17 8.6 17 10V11C17 12.4 15.9 13.5 14.5 13.5H12.5V7.5ZM13.8 8.8V12.2H14.5C15.2 12.2 15.7 11.7 15.7 11V10C15.7 9.3 15.2 8.8 14.5 8.8H13.8Z"
        fill="white"
      />
      <rect x="7" y="15" width="10" height="1.5" rx="0.75" fill="white" fillOpacity="0.85" />
    </svg>
  );
}
