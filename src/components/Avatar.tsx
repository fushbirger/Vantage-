const SIZES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  color,
  size = "md",
  ring = false,
  className = "",
}: {
  name: string;
  color: string;
  size?: keyof typeof SIZES;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${SIZES[size]} ${ring ? "ring-2 ring-card" : ""} ${className}`}
      style={{ backgroundColor: color }}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  members,
  max = 5,
}: {
  members: Array<{ userId: string; name: string; avatarColor: string }>;
  max?: number;
}) {
  const visible = members.slice(0, max);
  const extra = members.length - visible.length;
  return (
    <div className="flex -space-x-2" aria-label={`${members.length} members`}>
      {visible.map((member) => (
        <Avatar
          key={member.userId}
          name={member.name}
          color={member.avatarColor}
          size="sm"
          ring
        />
      ))}
      {extra > 0 && (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-900 text-[11px] font-bold text-white ring-2 ring-card">
          +{extra}
        </span>
      )}
    </div>
  );
}
