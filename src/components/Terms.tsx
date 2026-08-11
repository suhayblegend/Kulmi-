import React from 'react';
import { motion } from 'motion/react';
import { FileText, ArrowLeft } from 'lucide-react';

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

        <div className="bg-white rounded-3xl p-8 md:p-12 border border-[#E5E0D8] shadow-sm space-y-8 prose prose-[#2D2926] max-w-none">
          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">1. Introduction</h2>
            <p className="text-[#5C574F] leading-relaxed">
              Welcome to Kulmi. These Terms of Service ("Terms") govern your use of our application, which is designed to facilitate serious, intention-driven Muslim marriages, with a particular focus on Somali culture and Islamic principles (Dhaqan and Deen). By accessing or using our service, you agree to be bound by these Terms and our Islamic code of conduct.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">2. Eligibility & Intent</h2>
            <p className="text-[#5C574F] leading-relaxed">
              You must be a practicing Muslim and at least 18 years old to use this platform. This service is strictly for individuals seeking a Halal marriage (Nikah). Casual dating, inappropriate behavior, or using the platform for any purpose other than finding a spouse is strictly prohibited and will result in immediate termination of your account. We expect all interactions to uphold the dignity and respect inherent in our cultural values.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">3. Verification & Safety</h2>
            <p className="text-[#5C574F] leading-relaxed">
              To maintain a secure and trustworthy community, we require photo and identity verification for all accounts. We reserve the right to suspend or terminate accounts that fail to verify their identity or violate our safety guidelines. Users are expected to report any suspicious, fraudulent, or inappropriate behavior to our moderation team immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">4. Privacy & Wali (Guardian) Integration</h2>
            <p className="text-[#5C574F] leading-relaxed">
              We respect your privacy and adhere to Islamic principles of modesty (Haya). Only your chosen main photo is shown to other verified members; any additional photos stay private and are revealed only after you mutually match. The platform fully supports Wali access — sisters are encouraged to involve their Wali, who can oversee conversations and matches when opted in, helping uphold Islamic boundaries.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">5. Code of Conduct (Adab)</h2>
            <p className="text-[#5C574F] leading-relaxed">
              All interactions on the platform must be respectful, modest, and purposeful. Users must communicate with the highest level of Adab (good manners). Abusive language, harassment, discrimination, or solicitation of any kind will not be tolerated. Members can report any conversation or profile, and our team reviews every report. Where a member has enabled Wali oversight, a guardian may also review their conversations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">6. Account Termination</h2>
            <p className="text-[#5C574F] leading-relaxed">
              We reserve the right to suspend or permanently ban any account that violates these Terms, receives multiple user reports, or is deemed detrimental to the safety, integrity, and spiritual environment of the Kulmi community. Decisions made by our moderation team in this regard are final.
            </p>
          </section>
        </div>

      </motion.div>
    </div>
  );
}
