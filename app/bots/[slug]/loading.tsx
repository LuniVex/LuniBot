import { Container } from "@/components/Container";
import { Skeleton } from "@/components/Motion";

export default function Loading() {
  return (
    <Container className="grid gap-x-6 gap-y-6 py-12 md:grid-cols-12">
      <div className="md:col-span-3"><Skeleton className="size-16" /><Skeleton className="mt-4 h-6 w-32" /></div>
      <div className="md:col-span-9">
        <Skeleton className="h-6 w-full" /><Skeleton className="mt-2 h-6 w-5/6" />
        <Skeleton className="mt-8 h-56 w-full" />
      </div>
    </Container>
  );
}
