import Link from "next/link";

export const metadata = {
  title: "Terms of Service — AdonisBlue",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-[#0d9488] hover:underline">
          ← Back to home
        </Link>

        <h1 className="mb-2 text-3xl font-bold text-[#1a2744]">AdonisBlue Terms of Service</h1>
        <p className="mb-8 text-sm text-slate-500"><strong>Effective Date:</strong> July 27, 2026</p>

        <hr className="mb-8 border-slate-200" />

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">1. Who We Are</h2>
          <p className="text-slate-500 leading-relaxed">
            AdonisBlue ("AdonisBlue," "we," "us," or "our") is a software-as-a-service platform operated by{" "}
            <strong>[PLACEHOLDER: your legal name, since no LLC is formed yet — update to your LLC name once formed]</strong>, providing tools for aesthetic nurse injectors ("Practitioners," "you," "your account") to manage client communication, intake, aftercare, and follow-up.
          </p>
          <p className="mt-3 text-slate-500 leading-relaxed">
            Contact: <strong>[PLACEHOLDER: support/legal email, e.g. hello@adonisblue.io]</strong>
          </p>
          <p className="mt-3 text-slate-500 leading-relaxed">
            By creating an account or using AdonisBlue, you agree to these Terms of Service ("Terms"). If you don&apos;t agree, don&apos;t use the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">2. What AdonisBlue Does</h2>
          <p className="mb-2 text-slate-500 leading-relaxed">AdonisBlue provides:</p>
          <ul className="list-disc pl-6 text-slate-500 leading-relaxed space-y-1">
            <li>An AI-powered chat widget that answers prospective client questions and collects intake information</li>
            <li>Automated aftercare instructions sent to your clients after you log a treatment</li>
            <li>Pre-appointment prep guides</li>
            <li>Follow-up and rebooking reminder emails</li>
            <li>Review request emails</li>
            <li>Emergency keyword detection in client healing chats, with alerts sent to you</li>
            <li>A dashboard to track clients, treatments, and communications</li>
            <li>Optional integration with third-party booking software</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">3. Not Medical Advice</h2>
          <p className="text-slate-500 leading-relaxed">
            <strong>AdonisBlue is a communication and practice-management tool. It is not a medical device, does not provide medical advice, and does not replace your professional clinical judgment.</strong> Aftercare instructions, prep guides, and any AI-generated content are templates and starting points only. You are solely responsible for reviewing, editing, and approving all content sent to your clients, and for all clinical decisions related to your practice. Automated emergency keyword detection is a supplementary tool, not a substitute for your own client communication practices or a monitored medical emergency line — clients should always be directed to call 911 or seek in-person emergency care for urgent medical concerns.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">4. Your Account &amp; Responsibilities</h2>
          <ul className="list-disc pl-6 text-slate-500 leading-relaxed space-y-1">
            <li>You must provide accurate information when creating your account and keep it up to date.</li>
            <li>You are responsible for all activity under your account, including content sent to your clients.</li>
            <li>You are responsible for obtaining any consents required by law before collecting your clients&apos; information through AdonisBlue (including health-related intake information).</li>
            <li>You will not use AdonisBlue for any unlawful purpose, to send spam, or to collect information from anyone without their knowledge.</li>
            <li>You are responsible for the accuracy of the aftercare, prep, and procedure content you configure in your account.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">5. Subscription, Billing &amp; Free Trial</h2>
          <ul className="list-disc pl-6 text-slate-500 leading-relaxed space-y-1">
            <li>AdonisBlue offers a free trial period (currently 14 days, subject to change) before a paid subscription begins.</li>
            <li>Paid plans are billed monthly or annually through our payment processor, Stripe, in advance.</li>
            <li>You may cancel your subscription at any time; cancellation takes effect at the end of your current billing period unless otherwise stated.</li>
            <li><strong>[PLACEHOLDER: your refund policy — e.g., "Fees already paid are non-refundable except as required by law" or whatever you decide]</strong></li>
            <li>We may change our pricing with notice; continued use after a price change constitutes acceptance of the new pricing.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">6. Suspension &amp; Termination</h2>
          <p className="mb-2 text-slate-500 leading-relaxed">We may suspend or terminate your account if:</p>
          <ul className="list-disc pl-6 text-slate-500 leading-relaxed space-y-1">
            <li>You violate these Terms</li>
            <li>Your payment fails and is not resolved within a reasonable period</li>
            <li>We reasonably believe your use of AdonisBlue creates legal risk or harm to us or others</li>
          </ul>
          <p className="mt-3 text-slate-500 leading-relaxed">You may stop using AdonisBlue and cancel your account at any time.</p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">7. Data Ownership</h2>
          <p className="text-slate-500 leading-relaxed">
            You retain ownership of your client data. We process it on your behalf to provide the service, as described in our{" "}
            <Link href="/privacy" className="text-[#0d9488] underline">Privacy Policy</Link>. Upon account cancellation, we will delete or anonymize your data within{" "}
            <strong>[PLACEHOLDER: a retention period you choose, e.g. 90 days]</strong>, except where retention is required by law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">8. Third-Party Services</h2>
          <p className="text-slate-500 leading-relaxed">
            AdonisBlue relies on third-party providers to operate, including Supabase (database and authentication), Resend (email delivery), Stripe (payments), and Anthropic (AI-generated content). Your use of AdonisBlue is also subject to these providers&apos; own terms where applicable. We are not responsible for outages or issues caused by these third parties.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">9. Disclaimers</h2>
          <p className="text-slate-500 leading-relaxed uppercase text-sm">
            AdonisBlue is provided "as is" without warranties of any kind, express or implied. We do not guarantee that the service will be uninterrupted, error-free, or that automated content (including emergency alerts) will be accurate or timely in every case.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">10. Limitation of Liability</h2>
          <p className="text-slate-500 leading-relaxed uppercase text-sm">
            To the maximum extent permitted by law, AdonisBlue and its operator will not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service, including but not limited to lost profits, lost data, or claims by your clients. Our total liability for any claim will not exceed the amount you paid us in the 3 months before the claim arose.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">11. Governing Law</h2>
          <p className="text-slate-500 leading-relaxed">
            These Terms are governed by the laws of the State of <strong>[PLACEHOLDER: your state, e.g. Texas]</strong>, without regard to conflict-of-law principles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">12. Changes to These Terms</h2>
          <p className="text-slate-500 leading-relaxed">
            We may update these Terms from time to time. We&apos;ll notify you of material changes (e.g., by email or a notice in the app). Continued use after changes take effect means you accept the updated Terms.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">13. Contact</h2>
          <p className="text-slate-500 leading-relaxed">
            Questions about these Terms? Contact us at <strong>[PLACEHOLDER: email]</strong>.
          </p>
        </section>

        <div className="border-t border-slate-100 pt-6 text-center">
          <Link href="/privacy" className="text-sm text-[#0d9488] hover:underline">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
