import { redirect } from "next/navigation";

export default async function ReferralPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/auth?ref=${slug}`);
}
