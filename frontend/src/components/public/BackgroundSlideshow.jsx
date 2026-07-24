import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

/**
 * Full-screen, looping crossfade image slideshow — no buttons, no dots, fully
 * automatic. Every image is rendered up front (stacked, absolutely
 * positioned) so switching the active slide is a pure opacity crossfade with
 * no load/flicker gap. `images` is just a plain array (see
 * config/loginSlideshowImages.js) — add, remove, or reorder entries there
 * without touching this component.
 */
export function BackgroundSlideshow({ images, intervalMs = 5000 }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (images.length < 2) return undefined
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), intervalMs)
    return () => clearInterval(timer)
  }, [images.length, intervalMs])

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-900">
      {images.map((src, i) => (
        <motion.img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          initial={false}
          animate={{ opacity: i === index ? 1 : 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/50 to-slate-950/70" />
    </div>
  )
}
