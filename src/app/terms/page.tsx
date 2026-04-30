import type { Metadata } from "next";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = {
  title: "利用規約",
  description: "kazenagare（風流）の利用規約。対象年齢・禁止事項・コンテンツの取り扱いについて説明します。",
  robots: "noindex",
};

export default function TermsPage() {
  return (
    <PageShell title="利用規約" subtitle="Terms of Service">
      <div className="space-y-8 leading-relaxed">

        <section className="space-y-3">
          <p>
            本利用規約（以下「本規約」）は、liberis（以下「当運営」）が提供するサービス「kazenagare（風流）」（以下「当サービス」）の利用条件を定めるものです。ご利用の前に必ずお読みください。
          </p>
          <p>
            当サービスを利用した時点で、本規約に同意したものとみなします。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">1. 対象年齢</h2>
          <p>
            当サービスは、13歳以上の方を対象としています。13歳未満の方はご利用いただけません。
            13歳以上18歳未満の方は、保護者の同意のもとでご利用ください。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">2. アカウント</h2>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>ユーザーは、正確な情報を用いてアカウントを登録するものとします。</li>
            <li>アカウントの管理はユーザー自身の責任で行ってください。</li>
            <li>第三者にアカウントを譲渡・貸与することはできません。</li>
            <li>1人のユーザーが複数のアカウントを不正な目的で使用することを禁止します。</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">3. ユーザーが投稿するコンテンツ</h2>
          <p>
            当サービスでは、ユーザーが音声を録音し、庭として公開することができます。
            投稿したコンテンツの著作権はユーザー本人に帰属しますが、当サービスの提供・運営に必要な範囲で、当運営がそのコンテンツを利用することを許諾するものとします（表示・配信・保存等）。
          </p>
          <p>
            他のユーザーの庭に音声を追加する「ハーモニー」機能を利用する際は、追加する音声が他者の権利を侵害しないことを確認したうえでご利用ください。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">4. 禁止事項</h2>
          <p>ユーザーは以下の行為を行ってはなりません。</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>他者の音声・肖像を本人の同意なく録音・投稿すること</li>
            <li>他のユーザーへの嫌がらせ・誹謗中傷・差別的な表現を含むコンテンツの投稿</li>
            <li>第三者の著作権・肖像権・プライバシーを侵害するコンテンツの投稿</li>
            <li>わいせつ・暴力的・犯罪を助長するコンテンツの投稿</li>
            <li>当サービスへの不正アクセス・サーバーへの過度な負荷をかける行為</li>
            <li>スパム・自動化ツールを用いた大量投稿</li>
            <li>当運営または第三者になりすます行為</li>
            <li>その他、法令または本規約に違反する行為</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">5. コンテンツの削除・アカウント停止</h2>
          <p>
            当運営は、以下の場合にコンテンツの削除またはアカウントの停止・削除を行うことができます。事前通知を行う場合もありますが、緊急性が高い場合は予告なく対応することがあります。
          </p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>本規約の禁止事項に違反した場合</li>
            <li>法令に違反するコンテンツが投稿された場合</li>
            <li>当運営が当サービスの運営上必要と判断した場合</li>
          </ul>
          <p>
            なお、公開された庭のデータは最終更新から3日後に自動削除されます。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">6. サービスの変更・停止</h2>
          <p>
            当運営は、ユーザーへの事前通知なく当サービスの内容を変更、または提供を一時停止・終了する場合があります。これによりユーザーに生じた損害について、当運営は責任を負いません。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">7. 免責事項</h2>
          <p>
            当サービスは現状有姿で提供されます。当運営は、当サービスの完全性・正確性・継続性を保証しません。
            当サービスの利用により生じた損害（データの消失、機会の喪失等を含む）について、当運営は責任を負いません。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">8. 準拠法・管轄</h2>
          <p>
            本規約は日本法に準拠します。当サービスに関する紛争については、当運営の所在地を管轄する裁判所を専属的合意管轄とします。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">9. 規約の変更</h2>
          <p>
            当運営は必要に応じて本規約を変更することがあります。重要な変更がある場合はサービス内でお知らせします。変更後も継続してご利用いただいた場合、変更後の規約に同意したものとみなします。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">10. お問い合わせ</h2>
          <p>
            本規約に関するお問い合わせは、プライバシーポリシーに記載のお問い合わせ先までご連絡ください。
          </p>
        </section>

        <p className="text-xs opacity-40 pt-4">制定日：2026年4月22日</p>

      </div>
    </PageShell>
  );
}
