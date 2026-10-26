import { useId } from "react";

function IconBase({ children, size = 24, strokeWidth = 2, title, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : "true"}
      aria-label={title}
      role={title ? "img" : undefined}
      {...props}
    >
      {children}
    </svg>
  );
}

export function VisaGuideMark({ size = 48, title, ...props }) {
  const gradientId = useId().replace(/:/g, "");
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden={title ? undefined : "true"}
      aria-label={title}
      role={title ? "img" : undefined}
      data-icon="visaguide-mark"
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="7" x2="57" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff476f" />
          <stop offset="1" stopColor="#d91545" />
        </linearGradient>
      </defs>
      <path d="M5 15.8 21.5 7v41.2L5 57V15.8Z" fill={`url(#${gradientId})`} />
      <path d="m24.2 7 15.6 8.8V57l-15.6-8.8V7Z" fill={`url(#${gradientId})`} opacity=".9" />
      <path d="m42.5 15.8 16.5-8.8v41.2L42.5 57V15.8Z" fill={`url(#${gradientId})`} />
      <path d="m14.8 31.5 11 10.4 22.8-22" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DashboardIcon(props) {
  return <IconBase data-icon="dashboard" {...props}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></IconBase>;
}

export function FormIcon(props) {
  return <IconBase data-icon="form" {...props}><path d="M6 2.8h8.2L19 7.6V21H6V2.8Z" /><path d="M14 3v5h5M9 12h6M9 16h3.2" /><path d="m13.8 17 1.4 1.4 2.8-3" /></IconBase>;
}

export function TimelineIcon(props) {
  return <IconBase data-icon="timeline" {...props}><path d="M4 12h16" /><circle cx="4" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="20" cy="12" r="2" /></IconBase>;
}

export function DocumentIcon(props) {
  return <IconBase data-icon="document" {...props}><path d="M6 2.8h8.2L19 7.6V21H6V2.8Z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></IconBase>;
}

export function FolderIcon(props) {
  return <IconBase data-icon="folder" {...props}><path d="M3 6.5h6l2 2H21v10.7H3V6.5Z" /></IconBase>;
}

export function PaymentIcon(props) {
  return <IconBase data-icon="payment" {...props}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9h19M6 15h4" /></IconBase>;
}

export function CalendarIcon(props) {
  return <IconBase data-icon="calendar" {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01" /></IconBase>;
}

export function InterviewIcon(props) {
  return <IconBase data-icon="interview" {...props}><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.8 20c.4-4 2.2-6 5.2-6s4.8 2 5.2 6M14 15c3.8-.7 6.4 1 7 5" /></IconBase>;
}

export function ChatIcon(props) {
  return <IconBase data-icon="chat" {...props}><path d="M4.5 4h15A2.5 2.5 0 0 1 22 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-5.5 4v-4h-1A2.5 2.5 0 0 1 2 14.5v-8A2.5 2.5 0 0 1 4.5 4Z" /><path d="M7.5 10.5h.01M12 10.5h.01M16.5 10.5h.01" /></IconBase>;
}

export function BellIcon(props) {
  return <IconBase data-icon="bell" {...props}><path d="M5 17h14l-1.5-2.2V10a5.5 5.5 0 0 0-11 0v4.8L5 17Z" /><path d="M10 20h4" /></IconBase>;
}

export function ProfileIcon(props) {
  return <IconBase data-icon="profile" {...props}><circle cx="12" cy="12" r="9.5" /><circle cx="12" cy="9" r="3" /><path d="M6.7 19c.7-3.1 2.5-4.6 5.3-4.6s4.6 1.5 5.3 4.6" /></IconBase>;
}

export function SeniorGlassesIcon(props) {
  return <IconBase data-icon="senior-glasses" {...props}><circle cx="7.5" cy="12.5" r="4" /><circle cx="16.5" cy="12.5" r="4" /><path d="M11.5 12.5h1M3.5 12.5 2 10M20.5 12.5 22 10" /></IconBase>;
}

export function ApplicationsIcon(props) {
  return <IconBase data-icon="applications" {...props}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M8.5 9h7M8.5 13h7M8.5 17h4" /></IconBase>;
}

export function AdvisorIcon(props) {
  return <IconBase data-icon="advisor" {...props}><circle cx="9" cy="7" r="3" /><path d="M3.5 18c.5-3.6 2.3-5.5 5.5-5.5 1.1 0 2 .2 2.8.6" /><rect x="13" y="13" width="8" height="6.5" rx="1.3" /><path d="M15.5 13v-1.5h3V13M13 16h8" /></IconBase>;
}

export function UsersIcon(props) {
  return <IconBase data-icon="users" {...props}><circle cx="9" cy="8" r="3" /><circle cx="17.5" cy="9" r="2.3" /><path d="M3 20c.4-4 2.4-6.2 6-6.2s5.6 2.2 6 6.2M15 15c3.4-.5 5.5 1.2 6 4.5" /></IconBase>;
}

export function AssignmentIcon(props) {
  return <IconBase data-icon="assignment" {...props}><circle cx="8" cy="7" r="3" /><path d="M2.5 19c.5-4 2.3-6 5.5-6 1.2 0 2.3.3 3.1.8" /><circle cx="17" cy="16" r="4" /><path d="m15.2 16 1.2 1.2 2.4-2.6" /></IconBase>;
}

export function ChecklistIcon(props) {
  return <IconBase data-icon="checklist" {...props}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3V2h6v1M8.5 9l1.2 1.2 2-2.2M13.5 9h2.5M8.5 15l1.2 1.2 2-2.2M13.5 15h2.5" /></IconBase>;
}

export function QuestionBankIcon(props) {
  return <IconBase data-icon="question-bank" {...props}><path d="M3 5.5c3.8-.8 6.8.1 9 2.2v12c-2.2-2.1-5.2-3-9-2.2v-12ZM21 5.5c-3.8-.8-6.8.1-9 2.2v12c2.2-2.1 5.2-3 9-2.2v-12Z" /><path d="M15.3 9.8c.2-1 1-1.6 2-1.6 1.2 0 2 .7 2 1.7 0 1.5-1.8 1.6-1.8 2.8M17.5 15h.01" /></IconBase>;
}

export function ReportsIcon(props) {
  return <IconBase data-icon="reports" {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></IconBase>;
}

export function ActivityIcon(props) {
  return <IconBase data-icon="activity" {...props}><path d="M2 13h4l2-7 4 13 3-9 2 3h5" /></IconBase>;
}

export function ReminderIcon(props) {
  return <IconBase data-icon="reminder" {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 15h8M8 18h5" /></IconBase>;
}

export function SettingsIcon(props) {
  return <IconBase data-icon="settings" {...props}><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4" /><circle cx="16" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="14" cy="18" r="2" /></IconBase>;
}

