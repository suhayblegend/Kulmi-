import React from 'react';
import { motion } from 'motion/react';
import { Shield, ArrowLeft } from 'lucide-react';

const SECTIONS: [string, React.ReactNode][] = [
  ['1. Who we are', <>
    Kulmi ("we", "us") operates the marriage platform at kulmi.uk. This Privacy Policy explains what personal
    data we collect, why, how we protect it, and your rights. We are the data controller for the information you
    provide. Contact us any time at <b>support@kulmi.uk</b>.
  </>],
  ['2. Information we collect', <>
    <b>You give us:</b> your name, email, gender, age/date of birth, location (country/city, and optionally
    approximate coordinates if you use "detect location"), photos, a live verification selfie, optional voice
    recordings, and the answers you write about your faith, values, lifestyle and marriage intentions. Optionally,
    your Wali's email. <br /><br />
    <b>Automatically:</b> basic technical data needed to run the service (e.g. session tokens, and which profiles
    you view, to power the "who viewed you" feature). <br /><br />
    <b>Payments:</b> if you subscribe to Kulmi+, our payment processor Stripe collects your payment details —
    <b> Kulmi never sees or stores your card number.</b> We only receive a subscription status and a customer
    reference.
  </>],
  ['3. How we use your information', <>
    To create and verify your account; to show your profile to suitable, verified members of the opposite gender;
    to run compatibility sessions, matching, chat and voice notes; to enable Wali oversight when you opt in; to
    keep the community safe (verification, moderation, reports, bans); to process Kulmi+ subscriptions; and to send
    you essential service emails (verification results, account and security notices) and — unless you opt out —
    occasional product updates.
  </>],
  ['4. Modesty & who can see what', <>
    Only your <b>main photo</b> and safe profile details are visible in discovery, and only to <b>verified members
    of the opposite gender</b>. Additional photos and voice recordings are stored privately and are revealed only
    after you and another member mutually match. Your email, exact location, your Wali's email, your private
    "deal-breakers", and your verification selfie are <b>never</b> shown to other members. A confirmed Wali you
    appoint can view your introductions and conversations, read-only.
  </>],
  ['5. Where your data is stored (our processors)', <>
    We use trusted providers who process data on our behalf: <b>Supabase</b> (secure database, authentication and
    encrypted file storage for photos, selfies and voice), <b>Stripe</b> (payments), and <b>Resend</b> (sending
    emails). Private media is kept in a non-public store and served only via short-lived, access-controlled links.
    Our servers are hosted in the EU/UK region where available.
  </>],
  ['6. Cookies & local storage', <>
    We use only essential storage — a login/session token and small preferences kept in your browser to keep you
    signed in and remember settings. We do <b>not</b> use advertising trackers or sell your data.
  </>],
  ['7. Data retention & deletion', <>
    We keep your data while your account is active. You can <b>delete your account at any time</b> from Settings —
    this permanently removes your profile, photos, voice recordings, matches and login. For safety, limited
    moderation records (e.g. a report you were the subject of, or a ban) may be retained without your profile
    data, and we may keep minimal records required by law or for fraud prevention.
  </>],
  ['8. Your rights', <>
    Under UK/EU data protection law you have the right to access, correct, or delete your data, to object to or
    restrict certain processing, and to data portability. You can exercise most of these directly in the app
    (edit your profile, unsubscribe from emails, delete your account) or by emailing <b>support@kulmi.uk</b>. You
    may also complain to the UK Information Commissioner's Office (ICO).
  </>],
  ['9. Security', <>
    Access to your data is protected by strict database rules so members can only see what they are entitled to;
    passwords are handled by our authentication provider and never stored by us in plain text; private media is
    access-controlled. No system is perfectly secure, so please use a strong password and tell us immediately if
    you suspect a problem.
  </>],
  ['10. Children', <>
    Kulmi is strictly for adults aged 18 and over. We do not knowingly collect data from anyone under 18; if we
    learn that we have, we will delete it.
  </>],
  ['11. Changes & contact', <>
    We may update this policy; material changes will be notified in-app or by email. For any privacy question or
    request, contact <b>support@kulmi.uk</b>.
  </>],
];

export function Privacy({ onBack }: { onBack?: () => void }) {
  return (
    <div className="w-full max-w-3xl mx-auto py-8 relative">
      {onBack && (
        <button onClick={onBack} className="absolute left-0 top-10 flex items-center gap-2 text-[#8B7355] hover:text-[#1B4332] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </button>
      )}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#FDFBF7] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#E5E0D8]">
            <Shield className="w-8 h-8 text-[#1B4332]" />
          </div>
          <h1 className="text-4xl font-serif text-[#1B4332] mb-4">Privacy Policy</h1>
          <p className="text-[#8B7355]">Last updated: August 2026</p>
        </div>

        <div className="bg-white rounded-3xl p-8 md:p-12 border border-[#E5E0D8] shadow-sm space-y-8 max-w-none">
          {SECTIONS.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-xl md:text-2xl font-serif text-[#1B4332] mb-3">{title}</h2>
              <p className="text-[#5C574F] leading-relaxed">{body}</p>
            </section>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
