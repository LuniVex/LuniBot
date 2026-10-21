import { Container } from "@/components/Container";
import { Skeleton } from "@/components/Motion";

export default function Loading() {
  return (
    <Container className="py-12">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mt-6 h-6 w-1/2" />
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48" /><Skeleton className="h-48" />
      </div>
    </Container>
  );
}
