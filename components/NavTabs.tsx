import Link from "next/link";

const TABS = [
  { href: "/map", key: "world", label: "World" },
  { href: "/us", key: "us", label: "US" },
  { href: "/passport", key: "passport", label: "Passport" },
  { href: "/friends", key: "friends", label: "Friends" },
] as const;

export type NavKey = (typeof TABS)[number]["key"];

/** Shared top-nav tabs used by the map overlay and the passport/friends headers. */
export default function NavTabs({ active }: { active: NavKey }) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`rounded-md px-2.5 py-1 ${
            active === t.key
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
