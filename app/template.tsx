"use client";
import { motion } from "framer-motion";
import { ease } from "@/lib/motion";

/** Page transition: each page fades in as it arrives. template.tsx remounts on every navigation. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease }}>{children}</motion.div>;
}
