import { useInfiniteQuery } from '@tanstack/react-query';
export function useCursor<T>(key: readonly unknown[], load: (cursor?: string) => Promise<{ items: T[]; nextCursor: string }>) {
 const query = useInfiniteQuery({ queryKey: key, initialPageParam: '', queryFn: ({ pageParam }) => load(pageParam), getNextPageParam: last => last.nextCursor || undefined });
 return { ...query, items: query.data?.pages.flatMap(page => page.items) ?? [] };
}
