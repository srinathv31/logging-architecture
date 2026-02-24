package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.client.AsyncEventLogger;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

class EventLogMetricsBinder {

    EventLogMetricsBinder(AsyncEventLogger logger, MeterRegistry registry) {
        Gauge.builder("eventlog.events.queued", logger,
                        l -> l.getMetrics().eventsQueued)
                .description("Total events queued")
                .register(registry);

        Gauge.builder("eventlog.events.sent", logger,
                        l -> l.getMetrics().eventsSent)
                .description("Total events sent")
                .register(registry);

        Gauge.builder("eventlog.events.failed", logger,
                        l -> l.getMetrics().eventsFailed)
                .description("Total events failed")
                .register(registry);

        Gauge.builder("eventlog.events.spilled", logger,
                        l -> l.getMetrics().eventsSpilled)
                .description("Total events spilled to disk")
                .register(registry);

        Gauge.builder("eventlog.events.replayed", logger,
                        l -> l.getMetrics().eventsReplayed)
                .description("Total events replayed from spillover")
                .register(registry);

        Gauge.builder("eventlog.queue.depth", logger,
                        l -> l.getMetrics().currentQueueDepth)
                .description("Current queue size")
                .register(registry);

        Gauge.builder("eventlog.circuit-breaker.open", logger,
                        l -> l.getMetrics().circuitOpen ? 1 : 0)
                .description("Circuit breaker state (1=open, 0=closed)")
                .register(registry);
    }
}
