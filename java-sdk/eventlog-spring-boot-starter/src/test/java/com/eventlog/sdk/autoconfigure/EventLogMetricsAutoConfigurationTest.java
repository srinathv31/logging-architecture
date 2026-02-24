package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.client.AsyncEventLogger;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;

class EventLogMetricsAutoConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(
                    EventLogAutoConfiguration.class,
                    EventLogMetricsAutoConfiguration.class))
            .withPropertyValues(
                    "eventlog.enabled=true",
                    "eventlog.base-url=https://api.test",
                    "eventlog.transport=jdk")
            .withUserConfiguration(MeterRegistryConfig.class);

    @Test
    void registersAllGaugesWhenMicrometerPresent() {
        contextRunner.run(context -> {
            assertThat(context).hasSingleBean(EventLogMetricsBinder.class);
            MeterRegistry registry = context.getBean(MeterRegistry.class);
            assertThat(registry.find("eventlog.events.queued").gauge()).isNotNull();
            assertThat(registry.find("eventlog.events.sent").gauge()).isNotNull();
            assertThat(registry.find("eventlog.events.failed").gauge()).isNotNull();
            assertThat(registry.find("eventlog.events.spilled").gauge()).isNotNull();
            assertThat(registry.find("eventlog.events.replayed").gauge()).isNotNull();
            assertThat(registry.find("eventlog.queue.depth").gauge()).isNotNull();
            assertThat(registry.find("eventlog.circuit-breaker.open").gauge()).isNotNull();
        });
    }

    @Test
    void doesNotRegisterWhenMetricsDisabled() {
        contextRunner
                .withPropertyValues("eventlog.metrics.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(EventLogMetricsBinder.class);
                });
    }

    @Test
    void doesNotRegisterWhenAsyncDisabled() {
        contextRunner
                .withPropertyValues("eventlog.async.enabled=false")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(AsyncEventLogger.class);
                    assertThat(context).doesNotHaveBean(EventLogMetricsBinder.class);
                });
    }

    @Test
    void doesNotRegisterWhenNoMeterRegistry() {
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(
                        EventLogAutoConfiguration.class,
                        EventLogMetricsAutoConfiguration.class))
                .withPropertyValues(
                        "eventlog.enabled=true",
                        "eventlog.base-url=https://api.test",
                        "eventlog.transport=jdk")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(EventLogMetricsBinder.class);
                });
    }

    @Test
    void initialGaugeValuesAreZero() {
        contextRunner.run(context -> {
            MeterRegistry registry = context.getBean(MeterRegistry.class);
            assertThat(gauge(registry, "eventlog.events.queued")).isZero();
            assertThat(gauge(registry, "eventlog.events.sent")).isZero();
            assertThat(gauge(registry, "eventlog.events.failed")).isZero();
            assertThat(gauge(registry, "eventlog.events.spilled")).isZero();
            assertThat(gauge(registry, "eventlog.events.replayed")).isZero();
            assertThat(gauge(registry, "eventlog.queue.depth")).isZero();
            assertThat(gauge(registry, "eventlog.circuit-breaker.open")).isZero();
        });
    }

    private static double gauge(MeterRegistry registry, String name) {
        Gauge g = registry.find(name).gauge();
        assertThat(g).as("gauge '%s' should exist", name).isNotNull();
        return g.value();
    }

    @Configuration(proxyBeanMethods = false)
    static class MeterRegistryConfig {
        @Bean
        MeterRegistry meterRegistry() {
            return new SimpleMeterRegistry();
        }
    }
}
