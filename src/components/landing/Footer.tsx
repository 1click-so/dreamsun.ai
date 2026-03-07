import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-black pt-20 pb-10 px-6 md:px-12">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
        <div className="md:col-span-2">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <Logo size={16} />
            <span className="font-display font-bold text-xl tracking-tight">DreamSun</span>
          </Link>
          <p className="text-white/50 max-w-sm">
            The creative engine for the next generation of artists. Build, generate, and animate with the power of AI.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-4">Product</h4>
          <ul className="space-y-3 text-white/50 text-sm">
            <li><Link href="/images" className="hover:text-accent transition-colors">Image Gen</Link></li>
            <li><Link href="/video" className="hover:text-accent transition-colors">Video Gen</Link></li>
            <li><Link href="#" className="hover:text-accent transition-colors">API</Link></li>
            <li><Link href="#pricing" className="hover:text-accent transition-colors">Pricing</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-4">Company</h4>
          <ul className="space-y-3 text-white/50 text-sm">
            <li><Link href="#" className="hover:text-accent transition-colors">About</Link></li>
            <li><Link href="#" className="hover:text-accent transition-colors">Blog</Link></li>
            <li><Link href="#" className="hover:text-accent transition-colors">Careers</Link></li>
            <li><Link href="#" className="hover:text-accent transition-colors">Contact</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border text-white/40 text-sm">
        <p>&copy; 2026 DreamSun AI. All rights reserved.</p>
        <div className="flex gap-6 mt-4 md:mt-0">
          <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
          <Link href="#" className="hover:text-white transition-colors">Discord</Link>
          <Link href="#" className="hover:text-white transition-colors">Instagram</Link>
        </div>
      </div>
    </footer>
  );
}
