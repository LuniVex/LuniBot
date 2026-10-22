"use client";
import { motion } from "framer-motion";
import { tBase } from "@/lib/motion";

/** template.tsx remounts on every navigation: a short fade and 6px rise, same ease as everything else (M1). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={tBase}>{children}</motion.div>;
}
