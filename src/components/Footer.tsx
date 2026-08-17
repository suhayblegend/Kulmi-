import React from 'react';

// Navigate within the SPA via the popstate router (works from any page).
function go(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <button onClick={() => go(to)} className="text-white/75 hover:text-white transition-colors">
      {children}
    </button>
  );
}

export function Footer() {
  return (
    <footer className="w-full bg-[#1B4332] text-white mt-16">
      <div className="max-w-5xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <button onClick={() => go('/')} className="font-serif text-2xl font-bold uppercase tracking-tight mb-1 hover:opacity-80 transition-opacity">Kulmi</button>
          <p className="font-serif italic text-sm text-white/80 mb-3">Isla Kulma, Isla Noolada</p>
          <p className="text-sm text-white/60 leading-relaxed">
            A serious, verified, wali-friendly marriage platform for the Somali community. Deen iyo dhaqan.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-4">Platform</p>
          <ul className="space-y-2.5 text-sm">
            <li><FooterLink to="/how-it-works">How Kulmi works</FooterLink></li>
            <li><FooterLink to="/pricing">Pricing</FooterLink></li>
            <li><FooterLink to="/blog">The Journal</FooterLink></li>
            <li><FooterLink to="/faq">FAQ</FooterLink></li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-4">Company</p>
          <ul className="space-y-2.5 text-sm">
            <li><FooterLink to="/about">About us</FooterLink></li>
            <li><FooterLink to="/contact">Contact us</FooterLink></li>
            <li><FooterLink to="/pricing">Support us ☕</FooterLink></li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-4">Legal</p>
          <ul className="space-y-2.5 text-sm">
            <li><FooterLink to="/terms">Terms of Service</FooterLink></li>
            <li><FooterLink to="/privacy">Privacy Policy</FooterLink></li>
            <li><FooterLink to="/safety">Trust &amp; Safety</FooterLink></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
          <p>
            © {new Date().getFullYear()} Kulmi — kulmi.uk · Built by{' '}
            <a href="https://egehagency.com/" target="_blank" rel="noreferrer" className="text-white/60 hover:text-white underline underline-offset-2">Egeh Agency</a>
          </p>
          <p className="font-serif italic text-white/50">"And We created you in pairs" — Qur'an 78:8</p>
        </div>
      </div>
    </footer>
  );
}
