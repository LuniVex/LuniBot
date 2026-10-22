import { Container } from "@/components/Container";
import { Skeleton } from "@/components/Motion";

/** Shaped like the hub: title lines, then two unequal cards. */
export default function Loading() {
  return (
    <Container className="py-12 md:py-16">
      <div aria-busy="true" aria-label="Loading">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="mt-3 h-12 w-1/3" />
        <div className="mt-12 grid gap-6 md:grid-cols-12">
          <Skeleton className="h-64 md:col-span-7" />
          <Skeleton className="h-64 md:col-span-5" />
        </div>
      </div>
    </Container>
  );
}
