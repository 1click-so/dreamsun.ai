import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border pt-16 pb-8 px-6 md:px-12">
      <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-10 mb-14">
        {/* Brand */}
        <div className="col-span-2 sm:col-span-1">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <Logo size={14} />
            <span className="font-display font-bold text-lg tracking-tight">DreamSun</span>
          </Link>
          <p className="text-muted text-xs leading-relaxed max-w-[220px]">
            AI image &amp; video generation platform. Create with the world&apos;s best models.
          </p>
        </div>

        {/* Product */}
        <div>
          <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-foreground/50 mb-4">
            Product
          </h4>
          <ul className="space-y-2.5 text-sm text-muted">
            <li>
              <Link href="/images" className="hover:text-accent transition-colors">
                Image Generation
              </Link>
            </li>
            <li>
              <Link href="/video" className="hover:text-accent transition-colors">
                Video Generation
              </Link>
            </li>
            <li>
              <Link href="/shots" className="hover:text-accent transition-colors">
                Shots
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-foreground/50 mb-4">
            Legal
          </h4>
          <ul className="space-y-2.5 text-sm text-muted">
            <li>
              <Link href="/privacy" className="hover:text-accent transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-accent transition-colors">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-foreground/50 mb-4">
            Contact
          </h4>
          <ul className="space-y-2.5 text-sm text-muted">
            <li>
              <Link href="/contact" className="hover:text-accent transition-colors">
                Get in Touch
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-border text-muted/50 text-xs">
        <p>&copy; {new Date().getFullYear()} DreamSun AI. All rights reserved.</p>
      </div>
    </footer>
  );
}
