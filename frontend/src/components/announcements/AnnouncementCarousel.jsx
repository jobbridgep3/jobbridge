import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { cn } from '../../lib/utils'

/** Featured 1-5 pinned-announcement banner carousel for the homepage.
 * Auto-slides via embla-carousel-autoplay, pauses on interaction. */
export function AnnouncementCarousel({ announcements = [] }) {
  const navigate = useNavigate()
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: announcements.length > 1 }, [
    Autoplay({ delay: 6000, stopOnInteraction: false }),
  ])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap())
    emblaApi.on('select', onSelect)
    onSelect()
    return () => emblaApi.off('select', onSelect)
  }, [emblaApi])

  if (!announcements.length) return null

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {announcements.map((a) => (
            <div key={a.id} className="relative min-w-0 flex-[0_0_100%] cursor-pointer" onClick={() => navigate(`/announcements/${a.id}`)}>
              {a.banner_url ? (
                <img src={a.banner_url} alt={a.title} className="aspect-[21/9] w-full bg-surface-secondary object-contain" />
              ) : (
                <div className="flex aspect-[21/9] w-full items-center justify-center bg-primary-50 dark:bg-primary-900/30">
                  <Megaphone className="h-10 w-10 text-primary-400" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-5">
                <h3 className="text-lg font-semibold text-white">{a.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>

      {announcements.length > 1 && (
        <>
          <button
            type="button"
            onClick={scrollPrev}
            aria-label="Previous"
            className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface/80 text-text-secondary shadow hover:bg-surface"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            aria-label="Next"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface/80 text-text-secondary shadow hover:bg-surface"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {announcements.map((a, i) => (
              <button
                key={a.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => emblaApi?.scrollTo(i)}
                className={cn('h-1.5 w-1.5 rounded-full', i === selectedIndex ? 'bg-white' : 'bg-white/50')}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
