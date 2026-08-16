import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)
dayjs.extend(timezone)

export const MANILA_TZ = 'Asia/Manila'

/** Interprets an interview datetime (ISO string from the API) in Asia/Manila,
 * so it renders identically for every viewer regardless of browser timezone. */
export function manila(value) {
  return dayjs(value).tz(MANILA_TZ)
}
