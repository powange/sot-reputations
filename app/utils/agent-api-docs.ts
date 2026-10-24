import examples from './agent-api-examples.json'

// Documentation des endpoints agent (page admin « Jetons d'API »). Les exemples sont
// de vraies réponses, réduites à un ou deux éléments par liste et au contenu tronqué
// (agent-api-examples.json) : les compteurs `count` gardent leur valeur réelle.
export interface AgentApiEndpoint {
  path: string
  description: string
  example: unknown
}

export interface AgentApiSection {
  title: string
  endpoints: AgentApiEndpoint[]
}

export const AGENT_API_SECTIONS: AgentApiSection[] = [
  {
    title: 'Notes de version (patch notes)',
    endpoints: [
      {
        path: '/api/agent/release-notes',
        description: 'Liste des versions publiées avec leur date (sans contenu), la plus récente d\'abord',
        example: examples['release-notes']
      },
      {
        path: '/api/agent/release-notes/<version>',
        description: 'Contenu d\'une version (numéro de la liste, ex. 3.9.0) — 404 si inconnue',
        example: examples['release-notes/3.9.0']
      },
      {
        path: '/api/agent/release-notes/latest',
        description: 'Dernière version sortie, avec son contenu',
        example: examples['release-notes/latest']
      }
    ]
  },
  {
    title: 'Recommandations',
    endpoints: [
      {
        path: '/api/agent/recommendations',
        description: 'Sommaire : factions et campagnes (noms FR/EN) avec leur nombre d\'emblèmes, sans les emblèmes',
        example: examples.recommendations
      },
      {
        path: '/api/agent/recommendations/<faction>',
        description: 'Emblèmes d\'une faction, noms et descriptions FR/EN (clé du sommaire, ex. HuntersCall)',
        example: examples['recommendations/HuntersCall']
      },
      {
        path: '/api/agent/recommendations/<faction>/<campagne>',
        description: 'Emblèmes d\'une campagne (ex. HuntersCall/splashtails)',
        example: examples['recommendations/HuntersCall/splashtails']
      }
    ]
  },
  {
    title: 'Catalogue du coffre',
    endpoints: [
      {
        path: '/api/agent/chest-items',
        description: 'Sommaire : catégories et sous-catégories (libellés FR/EN) avec leur nombre d\'items, sans les items',
        example: examples['chest-items']
      },
      {
        path: '/api/agent/chest-items/<catégorie>',
        description: 'Items d\'une catégorie, noms et descriptions FR/EN, coût et prérequis (ex. Pets)',
        example: examples['chest-items/Pets']
      },
      {
        path: '/api/agent/chest-items/<catégorie>/<sous-catégorie>',
        description: 'Items d\'une sous-catégorie (ex. Pets/Parrot) — nameEn / descriptionEn valent null sans traduction',
        example: examples['chest-items/Pets/Parrot']
      }
    ]
  }
]
