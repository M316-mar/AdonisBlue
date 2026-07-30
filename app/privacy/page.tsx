import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — AdonisBlue",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-[#0d9488] hover:underline">
          ← Back to home
        </Link>

        <h1 className="mb-2 text-3xl font-bold text-[#1a2744]">AdonisBlue Privacy Policy</h1>
        <p className="mb-8 text-sm text-slate-500"><strong>Effective Date:</strong> July 27, 2026</p>

        <hr className="mb-8 border-slate-200" />

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">1. Who This Applies To</h2>
          <p className="text-slate-500 leading-relaxed">
            This Privacy Policy explains how AdonisBlue ("we," "us," "our") collects, uses, and protects information — both about <strong>Practitioners</strong> (nurse injectors who create AdonisBlue accounts) and their <strong>Clients</strong> (the people who interact with a Practitioner&apos;s AI chat widget or receive emails through AdonisBlue).
          </p>
          <p className="mt-3 text-slate-500 leading-relaxed">
            Contact: <a href="mailto:hi@adonisblue.io" className="text-[#0d9488] underline">hi@adonisblue.io</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">2. Information We Collect</h2>
          <p className="mb-2 font-medium text-slate-700">From Practitioners (account holders):</p>
          <ul className="mb-4 list-disc pl-6 text-slate-500 leading-relaxed space-y-1">
            <li>Name, email, phone, practice name, booking link, and other account setup information</li>
            <li>Payment information (processed by Stripe — we do not store full card numbers)</li>
            <li>Procedures offered and associated aftercare/prep content you configure</li>
          </ul>
          <p className="mb-2 font-medium text-slate-700">From Clients (via the chat widget, intake forms, or manual entry by the Practitioner):</p>
          <ul className="mb-4 list-disc pl-6 text-slate-500 leading-relaxed space-y-1">
            <li>Name, email, phone number</li>
            <li>Procedure interest and treatment history</li>
            <li>Health-related intake information you or your Practitioner chooses to collect, which may include allergies, blood thinner use, and prior procedure history</li>
            <li>Messages sent through the healing/aftercare chat, including anything shared about symptoms or concerns after a treatment</li>
          </ul>
          <p className="mb-2 font-medium text-slate-700">Automatically collected:</p>
          <ul className="list-disc pl-6 text-slate-500 leading-relaxed space-y-1">
            <li>Basic technical information (IP address, browser type, general usage data) for security and service operation</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">3. How We Use Information</h2>
          <ul className="list-disc pl-6 text-slate-500 leading-relaxed space-y-1">
            <li>To operate the chat widget, intake forms, and dashboard</li>
            <li>To send aftercare instructions, prep guides, appointment reminders, and review requests on behalf of Practitioners</li>
            <li>To detect potential medical emergencies mentioned in healing chat messages and alert the relevant Practitioner</li>
            <li>To process payments and manage subscriptions</li>
            <li>To improve and troubleshoot the service</li>
            <li>To comply with legal obligations</li>
          </ul>
          <p className="mt-3 text-slate-500 leading-relaxed">We do not sell personal information.</p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">4. Who We Share Information With</h2>
          <p className="mb-4 text-slate-500 leading-relaxed">
            We share information only as needed to operate the service, with these service providers (our "subprocessors"):
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm text-slate-500">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-6 text-left font-semibold text-slate-700">Provider</th>
                  <th className="py-2 pr-6 text-left font-semibold text-slate-700">Purpose</th>
                  <th className="py-2 text-left font-semibold text-slate-700">Data Shared</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Supabase", "Database hosting and account authentication", "Account data, client records"],
                  ["Stripe", "Payment processing", "Email, billing address"],
                  ["Resend", "Transactional emails", "Email address, name"],
                  ["Anthropic", "AI chatbot responses", "Anonymized client questions"],
                  ["Vercel", "Website hosting", "IP address, browser data"],
                  ["Google Analytics", "Website analytics", "IP address, page views"],
                ].map(([provider, purpose, data]) => (
                  <tr key={provider} className="border-b border-slate-100">
                    <td className="py-2 pr-6 font-medium">{provider}</td>
                    <td className="py-2 pr-6">{purpose}</td>
                    <td className="py-2 text-slate-400">{data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-slate-500 leading-relaxed">
            Each of these providers has its own privacy and security practices governing how they handle data on our behalf.
          </p>
          <p className="mt-3 text-slate-500 leading-relaxed">
            We do not share client information with anyone outside these service providers except: (a) with the Practitioner whose account the client interacted with, (b) if required by law, or (c) with your consent.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">5. Data Retention</h2>
          <p className="text-slate-500 leading-relaxed">
            We retain Practitioner and Client data for as long as the Practitioner&apos;s account is active. If an account is cancelled, we will delete or anonymize associated data within <strong>90 days</strong>, except where we&apos;re required to keep it longer by law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">6. Security</h2>
          <p className="text-slate-500 leading-relaxed">
            We use industry-standard measures to protect information, including encrypted data storage and access controls. No system is perfectly secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">7. Your Rights</h2>
          <p className="mb-3 text-slate-500 leading-relaxed">
            <strong>If you are a California resident</strong>, you have rights under the CCPA/CPRA, including the right to know what personal information we&apos;ve collected, to request deletion, and to opt out of the sale of personal information (we do not sell personal information). To exercise these rights, contact us at <a href="mailto:hi@adonisblue.io" className="text-[#0d9488] underline">hi@adonisblue.io</a>.
          </p>
          <p className="mb-3 text-slate-500 leading-relaxed">
            <strong>If you are a Client of a Practitioner using AdonisBlue</strong> and want your information corrected or deleted, you can contact your Practitioner directly, or reach out to us and we&apos;ll assist.
          </p>
          <p className="text-slate-500 leading-relaxed">
            <strong>Practitioners</strong> can access, export, or delete their account data through their dashboard, or by contacting us.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">8. Health Information — Important Note</h2>
          <p className="text-slate-500 leading-relaxed">
            AdonisBlue may collect health-adjacent information (e.g., allergies, blood thinner use) as part of client intake. Whether this information is subject to HIPAA depends on factors specific to each Practitioner&apos;s business (e.g., whether they bill insurance) and how AdonisBlue is characterized as a vendor. This section should be finalized with an attorney&apos;s guidance before AdonisBlue is used with real paying clients at scale, and this policy should be updated to reflect the actual determination (e.g., whether AdonisBlue operates as a HIPAA Business Associate, and what that requires).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">9. Children&apos;s Privacy</h2>
          <p className="text-slate-500 leading-relaxed">
            AdonisBlue is not intended for anyone under 18. We do not knowingly collect information from minors. If you believe a minor&apos;s information has been submitted, contact us and we will delete it.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">10. Cookies &amp; Tracking</h2>
          <p className="text-slate-500 leading-relaxed">
            Our website uses basic cookies to operate the site, and Google Analytics to understand how visitors use it. We display a cookie consent notice on first visit.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">11. Changes to This Policy</h2>
          <p className="text-slate-500 leading-relaxed">
            We may update this Privacy Policy from time to time. We&apos;ll note the effective date at the top, and notify you of material changes.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="mb-3 text-xl font-semibold text-[#1a2744]">12. Contact Us</h2>
          <p className="text-slate-500 leading-relaxed">
            Questions about this policy? Contact us at <a href="mailto:hi@adonisblue.io" className="text-[#0d9488] underline">hi@adonisblue.io</a>.
          </p>
        </section>

        <div className="border-t border-slate-100 pt-6 text-center">
          <Link href="/terms" className="text-sm text-[#0d9488] hover:underline">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}
