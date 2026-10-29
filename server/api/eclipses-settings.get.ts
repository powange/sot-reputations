import { getEclipseSettings } from '../utils/eclipses'

// Réglages du calendrier des éclipses (public : la page les lit au chargement)
export default defineEventHandler(() => getEclipseSettings())
