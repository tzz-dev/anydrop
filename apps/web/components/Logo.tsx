export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md bg-foreground text-background"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[62%] w-[62%]"
      >
        <line x1="12" y1="4" x2="5" y2="20" />
        <line x1="12" y1="4" x2="19" y2="20" />
        <line x1="7.625" y1="14" x2="16.375" y2="14" />
        <circle cx="12" cy="4" r="1.6" />
        <circle cx="5" cy="20" r="1.6" />
        <circle cx="19" cy="20" r="1.6" />
      </svg>
    </div>
  );
}
