"use client";
import { motion } from "framer-motion";
import { rise, stagger } from "@/lib/motion";
import { Button } from "./Button";
import { Container } from "./Container";

/** The terminal block shows the real steps to run a bot; its lines appear one after another. */
export function Hero({ count, sample }: { count: number; sample: { zip: string } }) {
  const lines = [`unzip ${sample.zip}`, "cp .env.example .env", "npm ci && npm start"];
  return (
    <section className="border-b border-rule py-12 md:py-16">
      <Container className="grid gap-x-6 gap-y-8 md:grid-cols-12">
        <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="md:col-span-7">
          <motion.h1 variants={rise} className="max-w-[22ch] text-3xl font-bold md:text-4xl">Discord bots you run yourself.</motion.h1>
          <motion.p variants={rise} className="prose-measure mt-6 text-xl">
            {count} bots, free and open source. Download the code from this site, run it on your own machine, and invite it to your own server. No accounts, no analytics.
          </motion.p>
          <motion.div variants={rise} className="mt-8 flex flex-wrap gap-3">
            <Button href="#bots">Browse bots</Button>
            <Button href="/about" variant="outline">Safety and licensing</Button>
          </motion.div>
        </motion.div>

        <motion.div variants={stagger(0.25)} initial="hidden" animate="show" className="md:col-span-5">
          <p className="mb-2 text-sm text-muted">Running a bot takes three commands</p>
          <div className="rounded-sm border border-ink p-4 font-mono text-sm">
            {lines.map((l) => (
              <motion.p key={l} variants={rise} className="break-all"><span className="text-muted select-none">$ </span>{l}</motion.p>
            ))}
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
