import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export function AdsBannerSkeleton() {
  return (
    <SkeletonTheme baseColor="#1E293B" highlightColor="#334155" borderRadius={16}>
      <div
        aria-hidden="true"
        className="w-full h-[210px] sm:h-[245px] lg:h-[270px] rounded-2xl bg-[#1E293B] border border-[#334155] p-6 sm:p-8 flex flex-col justify-between"
      >
        <div className="space-y-3">
          <Skeleton width={110} height={24} borderRadius={999} />
          <Skeleton width="58%" height={28} />
          <Skeleton width="42%" height={18} />
        </div>
        <div className="flex items-center justify-between pt-2">
          <Skeleton width={135} height={42} borderRadius={16} />
          <div className="flex gap-1.5">
            <Skeleton width={22} height={8} borderRadius={999} />
            <Skeleton width={8} height={8} borderRadius={999} />
            <Skeleton width={8} height={8} borderRadius={999} />
          </div>
        </div>
      </div>
    </SkeletonTheme>
  );
}

export function StoresGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonTheme baseColor="#1E293B" highlightColor="#334155" borderRadius={16}>
      <div
        aria-hidden="true"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-[#1E293B] border border-[#334155] overflow-hidden"
          >
            <Skeleton height={168} borderRadius={0} />
            <div className="p-4 space-y-3">
              <Skeleton width="72%" height={20} />
              <Skeleton width="48%" height={14} />
              <div className="pt-2 border-t border-[#334155] flex items-center justify-between">
                <Skeleton width={56} height={16} />
                <Skeleton width={68} height={16} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}

export function ProductsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SkeletonTheme baseColor="#1E293B" highlightColor="#334155" borderRadius={16}>
      <div
        aria-hidden="true"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-[#1E293B] border border-[#334155] overflow-hidden flex flex-col"
          >
            <Skeleton height={164} borderRadius={0} />
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <Skeleton width="66%" height={18} />
                <Skeleton width="90%" height={14} />
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#334155]">
                <Skeleton width={64} height={22} />
                <Skeleton width={96} height={40} borderRadius={16} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}

export function OrdersListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonTheme baseColor="#1E293B" highlightColor="#334155" borderRadius={16}>
      <div aria-hidden="true" className="space-y-4">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-[#1E293B] border border-[#334155] p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-4">
              <Skeleton width="44%" height={20} />
              <Skeleton width={88} height={26} borderRadius={12} />
            </div>
            <Skeleton width="76%" height={15} />
            <div className="flex items-center justify-between pt-3 border-t border-[#334155]">
              <Skeleton width={110} height={18} />
              <Skeleton width={120} height={40} borderRadius={16} />
            </div>
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}
