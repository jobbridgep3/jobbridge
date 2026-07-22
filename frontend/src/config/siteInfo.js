// Single editable place for PESO Pila's public-facing contact/social info, used by
// the public Header/Footer and the Citizen Charter link.
export const SITE_INFO = {
  officeName: 'PESO Pila, Laguna',
  address: 'PESO Pila, Municipal Hall Complex, Pila, Laguna 4010',
  telefax: '(049) 559-05-50',
  mobile: '0906 649 4583',
  email: 'jobbridgepesooffice@gmail.com',
  officeHours: 'Monday to Friday, 8:00 AM – 5:00 PM (except national and local holidays)',
  facebookUrl: 'https://www.facebook.com/share/18pjyfuvxs/',
  contactEmail: 'jobbridgepilalaguna@gmail.com',
  citizenCharterUrl: '/citizen-charter.pdf',
}

export function openCitizenCharter() {
  window.open(SITE_INFO.citizenCharterUrl, '_blank', 'noopener,noreferrer')
}
