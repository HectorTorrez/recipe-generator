import { createRootRoute } from '@tanstack/react-router'

import { RootDocument } from '../components/RootDocument'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Smart Recipe Generator' },
      {
        name: 'description',
        content:
          'AI-powered recipe recommendations based on your ingredients and available cooking time.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})
