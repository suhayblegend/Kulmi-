import React from 'react';
import { motion } from 'motion/react';
import { FileText, ArrowLeft } from 'lucide-react';

const SECTIONS: [string, React.ReactNode][] = [
  ['1. Introduction', <>
    Welcome to Kulmi ("Kulmi", "we", "us"). These Terms of Service ("Terms") govern your use of the Kulmi
    website and application at kulmi.uk, a platform designed to facilitate serious, intention-driven Muslim
    marriage, with a particular focus on Somali culture and Islamic principles (Dhaqan and Deen). By creating
    an account or using the service you agree to these Terms and to our <b>Privacy Policy</b>. If you do not
    agree, please do not use Kulmi.
  </>],
  ['2. Eligibility & intent', <>
    You must be at least <b>18 years old</b> and seeking a Halal marriage (Nikah). Kulmi is strictly for
    marriage-minded individuals. Casual dating, hook-ups, solicitation, commercial use, or any conduct contrary
    to the purpose of marriage is prohibited and will result in removal. To keep the community active and
    respectful of everyone's time, invitations expire automatically after 7 days if unanswered, and new matches
    close if neither person begins the conversation within 48 hours. You confirm that the information you
    provide is true and that you are legally free to marry.
  </>],
  ['3. Verification & identity', <>
    To keep the community trustworthy, every member must pass <b>live selfie verification</b>, which a human
    reviewer compares against your profile photo and stated gender. We reject AI-generated, stock, celebrity,
    obscured, or duplicate photos. You must upload genuine, recent photos of yourself only. We may suspend,
    unverify, or remove accounts that fail verification or that we reasonably believe are fraudulent,
    impersonating others, or misrepresenting their gender or identity.
  </>],
  ['4. Modesty, privacy & Wali (guardian)', <>
    In keeping with Islamic principles of modesty (Haya): only your main photo is shown in discovery, to
    verified members of the opposite gender; additional photos and voice recordings remain private until you
    both match. You may appoint a <b>Wali (guardian)</b> who — only after they confirm by email — can oversee
    your introductions and conversations, read-only. Wali oversight is offered as part of Kulmi+ membership.
  </>],
  ['5. Code of conduct (Adab)', <>
    All interactions must be respectful, modest and purposeful, upholding the highest Adab (good manners).
    Harassment, abuse, hate, discrimination, sexual content, deception, financial requests, off-platform
    solicitation, or contacting anyone against their wishes are forbidden. Ending contact with someone is
    final and mutual — you will not be shown to each other again. You must not scrape, copy, or misuse other
    members' data, photos or messages — including by screenshot or screen recording, which the mobile app
    additionally blocks at the device level. Sharing another member's photos, messages or identity outside the
    platform without their consent is a serious violation and grounds for permanent removal.
  </>],
  ['6. Membership & payments (Kulmi+)', <>
    The core Kulmi experience — creating a profile, verification, discovery, compatibility sessions and chatting
    with your matches — is <b>free</b>. <b>Kulmi+</b> is an optional paid membership (currently £9.99/month or
    £19.99 every 3 months) that unlocks additional features such as Wali oversight, seeing who viewed your
    profile, more open introductions, and priority verification. Payments are processed securely by <b>Stripe</b>;
    Kulmi never sees or stores your card details. Subscriptions renew automatically until cancelled — you can
    cancel any time from Settings → Manage subscription, and cancellation takes effect at the end of the current
    billing period. Promotional offers (such as free founding membership periods) are time-limited gifts and may end or change as
    announced. Prices may change with notice; changes never affect the period you have already paid for.
    Except where required by law, payments are non-refundable. Optional donations ("Support Kulmi") are
    voluntary and non-refundable.
  </>],
  ['7. Reports, moderation & account removal', <>
    You can report any profile or conversation; a human reviews every report. We may warn, suspend, or
    permanently remove and ban accounts that break these Terms, receive credible reports, or threaten the
    safety or integrity of the community. Serious cases result in a permanent ban that prevents re-registration.
    Moderation decisions are made in good faith and are final.
  </>],
  ['8. Your content', <>
    You retain ownership of the photos, recordings and text you upload, but you grant Kulmi a limited licence to
    store, process and display them <b>solely to operate the service for you</b> (e.g. showing your profile to
    suitable members, enabling verification and Wali oversight). You are responsible for your content and must
    have the right to share it.
  </>],
  ['9. No guarantee', <>
    Kulmi is an introduction platform, not a marriage broker. We do not guarantee that you will find a spouse,
    receive matches, or that any member is suitable, sincere, or who they claim to be. Verification reduces but
    cannot eliminate risk — always exercise caution, involve your Wali and family, and meet safely and in
    accordance with Islamic guidelines.
  </>],
  ['10. Limitation of liability', <>
    To the fullest extent permitted by law, Kulmi is provided "as is" and we are not liable for the conduct of
    any member, for interactions or meetings that arise through the platform, or for indirect or consequential
    loss. Nothing in these Terms excludes liability that cannot lawfully be excluded.
  </>],
  ['11. Changes & governing law', <>
    We may update these Terms from time to time; material changes will be notified in-app or by email, and
    continued use means acceptance. These Terms are governed by the laws of England and Wales. If any provision
    is unenforceable, the remainder still applies.
  </>],
  ['12. Contact', <>
    Questions about these Terms? Contact us at <b>support@kulmi.uk</b> or via the Contact page.
  </>],
];

export function Terms({ onBack }: { onBack?: () => void }) {
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
            <FileText className="w-8 h-8 text-[#1B4332]" />
          </div>
          <h1 className="text-4xl font-serif text-[#1B4332] mb-4">Terms of Service</h1>
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
