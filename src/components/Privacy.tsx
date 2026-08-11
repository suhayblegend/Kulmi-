import React from 'react';
import { motion } from 'motion/react';
import { Shield, ArrowLeft } from 'lucide-react';

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
          <p className="text-[#8B7355]">Last updated: October 2023</p>
        </div>

        <div className="bg-white rounded-3xl p-8 md:p-12 border border-[#E5E0D8] shadow-sm space-y-8 prose prose-[#2D2926] max-w-none">
          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">1. Information We Collect</h2>
            <p className="text-[#5C574F] leading-relaxed">
              We collect information that you provide directly to us to facilitate Islamic matchmaking. This includes your name, email address, date of birth, photos, religious preferences (such as prayer frequency and sect), cultural background (Somali heritage and language preferences), and marital goals. For verification purposes to ensure community safety, we also collect a real-time selfie which is processed securely to verify your identity.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">2. How We Use Your Information</h2>
            <p className="text-[#5C574F] leading-relaxed">
              Your information is exclusively used to match you with compatible potential spouses based on your shared Deen (faith), values, and life goals. We utilize this data to provide our services, maintain safety and security through active moderation, process identity verifications, and refine our matchmaking algorithms to better serve the Kulmi community.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">3. Privacy by Design (Haya)</h2>
            <p className="text-[#5C574F] leading-relaxed">
              Our platform is architected with Islamic privacy principles at its core. Your photos are blurred by default across the platform. They are only revealed to a specific match when both parties mutually agree after establishing compatibility. Your full name, exact location, and direct contact information are never shared publicly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">4. Data Security & Storage</h2>
            <p className="text-[#5C574F] leading-relaxed">
              We implement industry-standard security measures, including end-to-end encryption for sensitive data and private chats, to protect your personal information from unauthorized access, alteration, or disclosure. We do not sell your personal data to third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">5. Wali (Guardian) Access & Oversight</h2>
            <p className="text-[#5C574F] leading-relaxed">
              If you choose to invite a Wali to the platform using our dedicated Wali Access feature, you consent to sharing your match profiles and conversation history with them. This is strictly for the purpose of Islamic guardianship, transparency, and guidance in the marriage process, honoring both our Deen and Dhaqan.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif text-[#1B4332] mb-4">6. Your Rights & Data Deletion</h2>
            <p className="text-[#5C574F] leading-relaxed">
              You maintain full control over your data. You have the right to access, correct, or delete your personal data at any time. If you choose to delete your account (whether you found a spouse or otherwise), your profile, photos, and all associated conversation data will be permanently and securely removed from our active databases.
            </p>
          </section>
        </div>

      </motion.div>
    </div>
  );
}
