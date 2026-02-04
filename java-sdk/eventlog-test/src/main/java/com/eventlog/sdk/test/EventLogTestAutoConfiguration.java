package com.eventlog.sdk.test;

import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.client.MockAsyncEventLogger;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Profile;

@AutoConfiguration
@Profile("test")
@ConditionalOnClass(MockAsyncEventLogger.class)
public class EventLogTestAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(AsyncEventLogger.class)
    public MockAsyncEventLogger mockAsyncEventLogger() {
        return new MockAsyncEventLogger();
    }
}
