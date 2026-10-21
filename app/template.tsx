"use client";
import { motion } from "framer-motion";

/** template.tsx remounts on every navigation, which gives each route an enter transition. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{children}</motion.div>;
}
