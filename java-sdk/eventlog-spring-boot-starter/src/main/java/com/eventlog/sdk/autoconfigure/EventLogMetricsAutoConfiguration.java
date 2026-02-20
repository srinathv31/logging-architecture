package com.eventlog.sdk.autoconfigure;

import com.eventlog.sdk.client.AsyncEventLogger;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;

@AutoConfiguration(after = EventLogAutoConfiguration.class)
@ConditionalOnClass(MeterRegistry.class)
@ConditionalOnBean({AsyncEventLogger.class, MeterRegistry.class})
@ConditionalOnProperty(prefix = "eventlog.metrics", name = "enabled", havingValue = "true", matchIfMissing = true)
class EventLogMetricsAutoConfiguration {

    @Bean
    EventLogMetricsBinder eventLogMetricsBinder(AsyncEventLogger logger, MeterRegistry registry) {
        return new EventLogMetricsBinder(logger, registry);
    }
}
