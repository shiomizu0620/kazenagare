import Image from "next/image";
import QRCode from "qrcode";

type GardenShareQrProps = {
  shareUrl: string;
};

export async function GardenShareQr({ shareUrl }: GardenShareQrProps) {
  const qrDataUrl = await QRCode.toDataURL(shareUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
  });

  return (
    <section className="rounded-lg border border-wa-black/20 bg-white/70 p-4">
      <p className="text-sm">この QR を読み込むと、この庭に入れます。</p>
      <div className="mt-3 flex justify-center">
        <Image
          src={qrDataUrl}
          alt="この庭に入るためのQRコード"
          width={192}
          height={192}
          unoptimized
          className="h-48 w-48 rounded-md border border-wa-black/20 bg-white"
        />
      </div>
      <a
        href={shareUrl}
        className="mt-3 block break-all text-xs text-wa-black/80 underline"
      >
        {shareUrl}
      </a>
    </section>
  );
}
