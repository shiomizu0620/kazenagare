import { redirect } from "next/navigation";

export default function TopPage() {
  redirect("/?login=1");
}
