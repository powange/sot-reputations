import { getFireworksAnchor } from '../utils/fireworks'

// Ancrage du planning des feux d'artifice (public : la page le lit au chargement)
export default defineEventHandler(() => getFireworksAnchor())
