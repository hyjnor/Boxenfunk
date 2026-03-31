interface SectionHeaderProps {
  title: string
  subtitle?: string
  className?: string
}

export default function SectionHeader({ title, subtitle, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-1 h-6 bg-primary rounded-full" />
        <h2 className="text-2xl font-black tracking-tight text-text-base uppercase">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="text-sm text-text-secondary ml-4 pl-3 border-l border-muted">
          {subtitle}
        </p>
      )}
    </div>
  )
}
