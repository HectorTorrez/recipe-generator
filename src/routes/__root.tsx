import { createRootRoute } from '@tanstack/react-router'

import { RootDocument } from '../components/RootDocument'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Pantry — cook what you have' },
      {
        name: 'description',
        content:
          'Turn the ingredients in your fridge into recipes that fit your time and kitchen.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})
