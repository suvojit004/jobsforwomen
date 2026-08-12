type LogoProps = {
  compact?: boolean
}

// Real brand mark (see public/logo-mark*.png / logo-full*.png -- cut from
// the JFW logotype supplied for the rebrand). Two crops:
//   mark: just the "JFW" glyph, roughly square -- used wherever space is
//     tight (collapsed sidebar, compact navbar).
//   full: the glyph plus the "A platform built for women, by women"
//     tagline -- used on standalone pages (auth screens, landing page)
//     where there's room for it.
// Each crop has a plum-on-transparent version for light backgrounds and a
// white-on-transparent version for dark ones, swapped via Tailwind's dark:
// variant rather than a single image with a CSS filter, so both stay crisp.
export function Logo({ compact = false }: LogoProps) {
  if (compact) {
    return (
      <div className="flex items-center">
        <img
          src="/logo-mark.png"
          alt="JobsForWomen"
          className="h-9 w-auto dark:hidden"
        />
        <img
          src="/logo-mark-white.png"
          alt="JobsForWomen"
          className="hidden h-9 w-auto dark:block"
        />
      </div>
    )
  }

  return (
    <div className="flex items-center">
      <img
        src="/logo-full.png"
        alt="JobsForWomen -- a platform built for women, by women"
        className="h-14 w-auto dark:hidden"
      />
      <img
        src="/logo-full-white.png"
        alt="JobsForWomen -- a platform built for women, by women"
        className="hidden h-14 w-auto dark:block"
      />
    </div>
  )
}
