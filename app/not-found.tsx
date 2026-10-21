import { Button } from "@/components/Button";
import { Container } from "@/components/Container";

export default function NotFound() {
  return (
    <Container className="py-16">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-4">That bot doesn&apos;t exist.</p>
      <div className="mt-6"><Button href="/">Back to all bots</Button></div>
    </Container>
  );
}
