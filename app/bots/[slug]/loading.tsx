import { Container } from "@/components/Container";
import { Skeleton } from "@/components/Motion";

/** Shaped like a bot page: mark, title, metadata row, reading column and download panel. */
export default function Loading() {
  return (
    <Container className="py-12" >
      <div aria-busy="true" aria-label="Loading">
        <Skeleton className="size-16" />
        <Skeleton className="mt-6 h-12 w-1/2" />
        <Skeleton className="mt-4 h-6 w-2/3" />
        <Skeleton className="mt-8 h-12 w-full" />
        <div className="mt-12 grid gap-6 md:grid-cols-12">
          <div className="md:col-span-7"><Skeleton className="h-6 w-full" /><Skeleton className="mt-2 h-6 w-5/6" /><Skeleton className="mt-8 h-40 w-full" /></div>
          <Skeleton className="h-64 md:col-span-4 md:col-start-9" />
        </div>
      </div>
    </Container>
  );
}
