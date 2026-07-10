const COLORS = [
  "bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-lime-500",
  "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-blue-500",
  "bg-indigo-500", "bg-violet-500", "bg-fuchsia-500", "bg-pink-500",
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export default function DeviceAvatar({
  id,
  name,
  size = "md",
}: {
  id: string;
  name: string;
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-8 w-8 text-sm" : "h-12 w-12 text-lg";
  return (
    <div
      className={`flex ${dimension} shrink-0 items-center justify-center rounded-full font-semibold text-white ${colorForId(id)}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
