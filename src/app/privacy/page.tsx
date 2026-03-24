// src/app/privacy/page.tsx
import { PageShell } from "@/components/ui/page-shell";

export default function PrivacyPolicyPage() {
  return (
    <PageShell title="個人情報保護方針" subtitle="Privacy Policy">
      <div className="space-y-8 leading-relaxed">
        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">広告の配信について</h2>
          <p>
            当サイトでは、第三者配信の広告サービス「忍者AdMax」を利用しています。
          </p>
          <p>
            広告配信事業者は、ユーザーの興味に応じた商品やサービスの広告を表示するため、当サイトや他サイトへのアクセスに関する情報「Cookie」(氏名、住所、メールアドレス、電話番号は含まれません) を使用することがあります。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">アクセス解析ツールについて</h2>
          <p>
            当サイトでは、Vercelによるアクセス解析ツール「Vercel Analytics」を利用しています。
          </p>
          <p>
            これらはトラフィックデータの収集のためにCookieを使用しています。このトラフィックデータは匿名で収集されており、個人を特定するものではありません。
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold border-b border-wa-black/10 pb-2">免責事項</h2>
          <p>
            当サイトからのリンクやバナーなどで移動したサイトで提供される情報、サービス等について一切の責任を負いません。
          </p>
          <p>
            また、当サイトのコンテンツ・情報について、できる限り正確な情報を提供するよう努めておりますが、正確性や安全性を保証するものではありません。情報が古くなっていることもございます。当サイトに掲載された内容によって生じた損害等の一切の責任を負いかねますのでご了承ください。
          </p>
        </section>
      </div>
    </PageShell>
  );
}