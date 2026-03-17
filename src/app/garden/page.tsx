import Link from "next/link";
import { PageShell } from "@/components/ui/page-shell";
import { fetchPublishedGardenPosts } from "@/lib/garden/posts";
import {
  GARDEN_BACKGROUNDS,
  GARDEN_SEASONS,
  GARDEN_TIME_SLOTS,
} from "@/lib/garden/setup/options";

function resolveOptionName(options: { id: string; name: string }[], id: string) {
  return options.find((option) => option.id === id)?.name ?? id;
}

function formatGardenOwnerLabel(ownerDisplayName: string | null | undefined, userId: string) {
  // owner_display_name を優先的に表示、なければ userId をフォールバック
  const displayValue = ownerDisplayName || userId;
  
  if (displayValue.length <= 12) {
    return displayValue;
  }

  return `${displayValue.slice(0, 8)}...`;
}

function formatPublishedAt(publishedAt: string | null) {
  if (!publishedAt) {
    return "公開日時不明";
  }

  const date = new Date(publishedAt);

  if (Number.isNaN(date.getTime())) {
    return "公開日時不明";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRemainingAutoDeleteTime(updatedAt: string | null) {
  if (!updatedAt) {
    return "残り時間不明";
  }

  const updatedAtDate = new Date(updatedAt);
  if (Number.isNaN(updatedAtDate.getTime())) {
    return "残り時間不明";
  }

  const expireAtMs = updatedAtDate.getTime() + 3 * 24 * 60 * 60 * 1000;
  const remainingMs = expireAtMs - Date.now();

  if (remainingMs <= 0) {
    return "まもなく削除";
  }

  const totalMinutes = Math.floor(remainingMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}日 ${hours}時間`;
  }

  if (hours > 0) {
    return `${hours}時間 ${minutes}分`;
  }

  return `${Math.max(minutes, 1)}分`;
}

export default async function GardenIndexPage() {
  const publishedPosts = await fetchPublishedGardenPosts();

  return (
    <PageShell
      title="庭一覧"
      subtitle="訪問したい庭を選択してください"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/?login=1"
          className="rounded-md border border-wa-black px-4 py-3 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
        >
          トップへ戻る
        </Link>
        <Link
          href="/garden/me"
          className="rounded-md border border-wa-black px-4 py-3 text-sm transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-wa-red/10 active:translate-y-[1px] active:scale-[0.98]"
        >
          自分の庭へ
        </Link>
      </div>

      <section className="grid gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">公開された庭</h2>
          <p className="text-sm text-wa-black/70">
            投稿済みの庭はここに並びます。カードを選ぶと、そのまま訪問できます。
          </p>
        </div>

        {publishedPosts.length === 0 ? (
          <p className="rounded-xl border border-wa-black/15 bg-white/70 px-4 py-4 text-sm text-wa-black/70">
            まだ公開された庭はありません。自分の庭を投稿すると、この一覧から他の人が訪問できるようになります。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {publishedPosts.map((post) => {
              const backgroundName = resolveOptionName(
                GARDEN_BACKGROUNDS,
                post.backgroundId,
              );
              const seasonName = resolveOptionName(GARDEN_SEASONS, post.seasonId);
              const timeSlotName = resolveOptionName(
                GARDEN_TIME_SLOTS,
                post.timeSlotId,
              );

              return (
                <Link
                  key={post.userId}
                  href={`/garden/${post.userId}`}
                  className="grid gap-3 rounded-2xl border border-wa-black/15 bg-white/80 px-4 py-4 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-wa-black/40 hover:bg-wa-red/5 active:translate-y-[1px] active:scale-[0.99]"
                >
                  <div className="space-y-1">
                    <p className="text-xs tracking-[0.22em] text-wa-black/45">PUBLIC GARDEN</p>
                    <p className="text-lg font-semibold">
                      {formatGardenOwnerLabel(post.ownerDisplayName, post.userId)} の庭
                    </p>
                    <p className="break-all text-xs text-wa-black/55">ID: {post.userId}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-wa-black/15 px-3 py-1">
                      背景: {backgroundName}
                    </span>
                    <span className="rounded-full border border-wa-black/15 px-3 py-1">
                      季節: {seasonName}
                    </span>
                    <span className="rounded-full border border-wa-black/15 px-3 py-1">
                      時間帯: {timeSlotName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm text-wa-black/65">
                    <span>{formatPublishedAt(post.publishedAt)}</span>
                    <span className="rounded-full border border-wa-black/20 px-2 py-0.5 text-xs text-wa-black/70">
                      自動削除まで: {formatRemainingAutoDeleteTime(post.updatedAt)}
                    </span>
                    <span className="font-semibold text-wa-red">庭を見る</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
