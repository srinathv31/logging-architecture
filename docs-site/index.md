---
layout: home
hero:
  name: Event Log Platform
  text: Centralized Event Logging
  tagline: Capture, correlate, and visualize process flows across distributed systems
  actions:
    - theme: brand
      text: Get Started
      link: /overview/introduction
    - theme: alt
      text: Java SDK
      link: /java-sdk/
    - theme: alt
      text: Node SDK
      link: /node-sdk/

features:
  - icon:
      src: /icons/rocket.svg
    title: REST API
    details: Fastify-powered event ingestion with OpenAPI docs, batch operations, and full-text search.
    link: /api/
    linkText: API Reference
  - icon:
      src: /icons/coffee.svg
    title: Java SDK
    details: Spring Boot starter with auto-configuration, @LogEvent annotations, async queue, retry, and disk spillover.
    link: /java-sdk/
    linkText: Java Docs
  - icon:
      src: /icons/package.svg
    title: Node SDK
    details: TypeScript SDK with AsyncEventLogger, OAuth, circuit breaker, and fire-and-forget logging.
    link: /node-sdk/
    linkText: Node Docs
  - icon:
      src: /icons/building.svg
    title: Pet Resort Example
    details: Spring Boot reference app demonstrating all three SDK approaches in a realistic pet boarding scenario.
    link: /pet-resort/
    linkText: View Example
  - icon:
      src: /icons/search.svg
    title: Distributed Tracing
    details: W3C Trace Context support with traceId, spanId, parentSpanId, and span links for fork-join patterns.
  - icon:
      src: /icons/bar-chart.svg
    title: Dashboard
    details: Next.js management UI for trace visualization, event search, and aggregate statistics.
---
