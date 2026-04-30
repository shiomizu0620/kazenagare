import type { Metadata } from "next";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "kazenagare（風流）のプライバシーポリシー。収集する情報・利用目的・第三者提供について説明します。",
  robots: "noindex",
};

export default function PrivacyPolicyPage() {
  return (
    <PageShell title="個人情報保護方針" subtitle="Privacy Policy">
      <div className="space-y-8 leading-relaxed">

        <section className="space-y-3">
          <p>
            liberis（以下「当運営」）は、本サービス「kazenagare（風流）」（以下「当サービス」）における個人情報の取り扱いについて、以下のとおり定めます。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">1. 収集する情報</h2>
          <p>当サービスでは、以下の情報を収集することがあります。</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>メールアドレス（アカウント登録時）</li>
            <li>Google アカウントまたは X (Twitter) アカウントの公開プロフィール情報（氏名・メールアドレス等。OAuth連携時のみ）</li>
            <li>ユーザーが録音した音声データ</li>
            <li>庭の配置データ・背景設定・表示名等のユーザー生成コンテンツ</li>
            <li>アクセスログ（IPアドレス、ブラウザ種別、閲覧ページ等）</li>
          </ul>
          <p>
            ゲスト（未ログイン）でのご利用時は、メールアドレス等の個人情報は収集しません。ただし、端末上のローカルストレージに庭のデータが一時保存される場合があります。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">2. 利用目的</h2>
          <p>収集した情報は、以下の目的のために利用します。</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>アカウントの作成・認証・管理</li>
            <li>庭データ・音声データの保存および他ユーザーへの公開</li>
            <li>サービスの品質向上・不具合対応</li>
            <li>広告の配信（第三者広告サービスによるもの）</li>
          </ul>
          <p>上記以外の目的で個人情報を利用する場合は、事前にお知らせします。</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">3. データの保持期間</h2>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>公開された庭のデータは、最終更新から <strong>3日間</strong> 保持された後、自動的に削除されます。</li>
            <li>音声データは、庭データの削除に合わせて削除されます。</li>
            <li>アカウントを削除した場合、関連するデータはすべて削除されます。</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">4. 第三者提供・委託</h2>
          <p>当サービスは、以下の第三者サービスを利用してデータを処理・保管しています。法令に基づく場合を除き、本人の同意なく第三者に個人情報を提供しません。</p>
          <div className="space-y-3 pl-2">
            <div>
              <p className="font-semibold">Supabase, Inc.（米国）</p>
              <p className="text-sm opacity-80">認証・データベース・ファイルストレージの提供。収集した個人情報およびユーザーデータの保管に使用します。</p>
            </div>
            <div>
              <p className="font-semibold">忍者AdMax（GMOペパボ株式会社）</p>
              <p className="text-sm opacity-80">広告配信サービス。広告表示のためCookieを使用することがあります。</p>
            </div>
            <div>
              <p className="font-semibold">Vercel Inc.（米国）</p>
              <p className="text-sm opacity-80">サービスのホスティングおよびアクセス解析（Vercel Analytics）に使用します。収集データは匿名化されています。</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">5. 広告の配信について</h2>
          <p>
            当サービスでは、第三者配信の広告サービス「忍者AdMax」を利用しています。
            広告配信事業者は、ユーザーの興味に応じた広告を表示するため、Cookie を使用することがあります（氏名・住所・メールアドレス・電話番号は含まれません）。
          </p>
          <p>
            Cookie を無効にする方法やオプトアウトについては、ご利用のブラウザの設定からご確認ください。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">6. アクセス解析について</h2>
          <p>
            当サービスでは、Vercel Analytics によるアクセス解析を利用しています。
            収集されるデータは匿名であり、個人を特定するものではありません。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">7. ユーザーの権利</h2>
          <p>
            ユーザーは、当サービスが保有する自己の個人情報について、開示・訂正・削除・利用停止を請求する権利を有します。
            ご要望の場合は、下記お問い合わせ先までご連絡ください。合理的な期間内に対応いたします。
          </p>
          <p>
            アカウントの削除は、サービス内の設定またはお問い合わせにより行うことができます。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">8. 免責事項</h2>
          <p>
            当サービスからのリンクで移動した外部サイトで提供される情報・サービスについて、当運営は一切の責任を負いません。
          </p>
          <p>
            当サービスのコンテンツについて正確な情報の提供に努めますが、その正確性・安全性を保証するものではありません。当サービスの利用により生じた損害について、当運営は責任を負いかねます。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">9. プライバシーポリシーの変更</h2>
          <p>
            当運営は、必要に応じて本方針を変更することがあります。重要な変更がある場合はサービス内でお知らせします。変更後も継続してご利用いただいた場合、変更後の方針に同意したものとみなします。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">10. お問い合わせ</h2>
          <p>
            個人情報の取り扱いに関するお問い合わせは、以下までご連絡ください。
          </p>
          <p className="pl-2">
            運営：liberis<br />
            メール：<span className="opacity-60">[liberis.official@gmail.com]</span>
          </p>
        </section>

        <p className="text-xs opacity-40 pt-4">制定日：2026年4月22日</p>

      </div>
    </PageShell>
  );
}
