"use client"

export function PortalFooter() {
  return (
    <footer className="mt-auto border-t border-gray-100 py-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="h-px w-8 bg-gray-200" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-portal-secondary">
          Hackathon Support System
        </span>
        <div className="h-px w-8 bg-gray-200" />
      </div>
      <div className="flex items-center justify-center gap-6 text-xs text-portal-secondary">
        <a href="#" className="hover:text-foreground transition-colors">Code of Conduct</a>
        <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
        <a href="#" className="hover:text-foreground transition-colors">Safety Hotline</a>
      </div>
    </footer>
  )
}
