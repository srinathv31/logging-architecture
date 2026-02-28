import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'Event Log Platform',
    description: 'Centralized event logging for distributed systems',

    lastUpdated: true,
    cleanUrls: true,
    ignoreDeadLinks: [
      /localhost/,
    ],

    head: [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ],

    themeConfig: {
      logo: '/logo.svg',

      nav: [
        { text: 'Overview', link: '/overview/introduction' },
        {
          text: 'Libraries',
          items: [
            { text: 'REST API', link: '/api/' },
            { text: 'Java SDK', link: '/java-sdk/' },
            { text: 'Node SDK', link: '/node-sdk/' },
          ],
        },
        { text: 'Pet Resort', link: '/pet-resort/' },
        { text: 'Contributing', link: '/contributing/' },
      ],

      sidebar: {
        '/overview/': [
          {
            text: 'Overview',
            items: [
              { text: 'Introduction', link: '/overview/introduction' },
              { text: 'Architecture', link: '/overview/architecture' },
              { text: 'Changelog', link: '/overview/changelog' },
            ],
          },
        ],

        '/api/': [
          {
            text: 'REST API',
            items: [
              { text: 'Overview', link: '/api/' },
              { text: 'Getting Started', link: '/api/getting-started' },
              { text: 'Authentication', link: '/api/authentication' },
            ],
          },
          {
            text: 'Endpoints',
            collapsed: false,
            items: [
              { text: 'Events', link: '/api/endpoints/events' },
              { text: 'Traces', link: '/api/endpoints/traces' },
              { text: 'Dashboard', link: '/api/endpoints/dashboard' },
              { text: 'Correlation Links', link: '/api/endpoints/correlation-links' },
              { text: 'Batch Operations', link: '/api/endpoints/batch-operations' },
              { text: 'Processes', link: '/api/endpoints/processes' },
            ],
          },
          {
            text: 'Reference',
            items: [
              { text: 'Error Handling', link: '/api/error-handling' },
            ],
          },
        ],

        '/java-sdk/': [
          {
            text: 'Java SDK',
            items: [
              { text: 'Overview', link: '/java-sdk/' },
              { text: 'Getting Started', link: '/java-sdk/getting-started' },
            ],
          },
          {
            text: 'Spring Boot',
            collapsed: false,
            items: [
              { text: 'Auto-Configuration', link: '/java-sdk/spring-boot/auto-configuration' },
              { text: 'Configuration Reference', link: '/java-sdk/spring-boot/configuration' },
              { text: '@LogEvent Annotation', link: '/java-sdk/spring-boot/annotations' },
              { text: 'Refresh Scope', link: '/java-sdk/spring-boot/refresh-scope' },
            ],
          },
          {
            text: 'Core',
            collapsed: false,
            items: [
              { text: 'EventLogClient', link: '/java-sdk/core/event-log-client' },
              { text: 'AsyncEventLogger', link: '/java-sdk/core/async-event-logger' },
              { text: 'EventLogTemplate', link: '/java-sdk/core/event-log-template' },
              { text: 'OAuth Provider', link: '/java-sdk/core/oauth' },
              { text: 'Event Builders', link: '/java-sdk/core/event-builders' },
            ],
          },
          {
            text: 'Advanced',
            collapsed: false,
            items: [
              { text: 'Architecture', link: '/java-sdk/advanced/architecture' },
              { text: 'Spillover', link: '/java-sdk/advanced/spillover' },
              { text: 'Fork-Join', link: '/java-sdk/advanced/fork-join' },
              { text: 'Batch Operations', link: '/java-sdk/advanced/batch-operations' },
              { text: 'Custom Components', link: '/java-sdk/advanced/custom-components' },
            ],
          },
          {
            text: 'Reference',
            collapsed: false,
            items: [
              { text: 'Testing', link: '/java-sdk/testing' },
              { text: 'Migration Guide', link: '/java-sdk/migration' },
              { text: 'Troubleshooting', link: '/java-sdk/troubleshooting' },
              { text: 'Examples', link: '/java-sdk/examples' },
            ],
          },
        ],

        '/node-sdk/': [
          {
            text: 'Node SDK',
            items: [
              { text: 'Overview', link: '/node-sdk/' },
              { text: 'Getting Started', link: '/node-sdk/getting-started' },
            ],
          },
          {
            text: 'Core',
            collapsed: false,
            items: [
              { text: 'EventLogClient', link: '/node-sdk/core/event-log-client' },
              { text: 'AsyncEventLogger', link: '/node-sdk/core/async-event-logger' },
              { text: 'OAuth Provider', link: '/node-sdk/core/oauth' },
              { text: 'Event Builders', link: '/node-sdk/core/event-builders' },
            ],
          },
          {
            text: 'Advanced',
            collapsed: false,
            items: [
              { text: 'Fork-Join', link: '/node-sdk/advanced/fork-join' },
              { text: 'Batch Operations', link: '/node-sdk/advanced/batch-operations' },
              { text: 'Correlation Links', link: '/node-sdk/advanced/correlation-links' },
            ],
          },
          {
            text: 'Reference',
            collapsed: false,
            items: [
              { text: 'Querying', link: '/node-sdk/querying' },
              { text: 'Error Handling', link: '/node-sdk/error-handling' },
            ],
          },
        ],

        '/pet-resort/': [
          {
            text: 'Pet Resort',
            items: [
              { text: 'Overview', link: '/pet-resort/' },
              { text: 'Runbook', link: '/pet-resort/runbook' },
              { text: 'SDK Approaches', link: '/pet-resort/sdk-approaches' },
            ],
          },
        ],

        '/contributing/': [
          {
            text: 'Contributing',
            items: [
              { text: 'Guide', link: '/contributing/' },
              { text: 'Branching Strategy', link: '/contributing/branching-strategy' },
              { text: 'Publishing', link: '/contributing/publishing' },
              { text: 'Logging Standard', link: '/contributing/logging-standard' },
            ],
          },
        ],
      },

      socialLinks: [
        { icon: 'github', link: 'https://github.com/your-org/event-log-platform' },
      ],

      search: {
        provider: 'local',
      },

      editLink: {
        pattern: 'https://github.com/your-org/event-log-platform/edit/main/docs-site/:path',
        text: 'Edit this page on GitHub',
      },

      footer: {
        message: 'Event Log Platform Documentation',
      },
    },

    markdown: {
      lineNumbers: true,
    },
  })
)
