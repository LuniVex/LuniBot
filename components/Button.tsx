"use client";
import { motion } from "framer-motion";
import Link from "next/link";

type Variant = "solid" | "outline";
const styles: Record<Variant, string> = {
  solid: "bg-ink text-paper border-ink hover:bg-accent hover:border-accent",
  outline: "bg-transparent text-ink border-ink hover:text-accent hover:border-accent",
};
const base = "inline-flex items-center justify-center rounded-sm border px-4 py-2 text-base font-bold no-underline transition-colors";
const MotionLink = motion.create(Link);

export function Button({ href, variant = "solid", download, external, className = "", children }: {
  href: string; variant?: Variant; download?: boolean; external?: boolean; className?: string; children: React.ReactNode;
}) {
  const props = { whileHover: { y: -1 }, whileTap: { scale: 0.98 }, className: `${base} ${styles[variant]} ${className}` };
  if (download || external || /^https?:/.test(href))
    return (
      <motion.a href={href} {...props} {...(download ? { download: "" } : { target: "_blank", rel: "noopener noreferrer" })}>
        {children}
      </motion.a>
    );
  return <MotionLink href={href} {...props}>{children}</MotionLink>;
}
