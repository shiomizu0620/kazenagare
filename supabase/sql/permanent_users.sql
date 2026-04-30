-- 永続化したい庭のユーザーID一覧
-- このファイルを編集して Supabase SQL Editor で実行するだけで管理できます。
-- 追加・削除したいときはこのファイルを更新して再実行してください。

begin;

-- 一度すべてリセット
update public.garden_posts set is_permanent = false;

-- 永続化したいユーザーIDをここに追加する
update public.garden_posts
set is_permanent = true
where user_id in (
  -- 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  -- 例: デモアカウント
  -- 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy'   -- 例: スタッフアカウント
  null  -- ダミー（上の行のコメントを外して使ってください）
);

commit;
