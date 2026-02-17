package com.example.petresort.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class EventLogConfig {

    @Bean
    public FilterRegistrationBean<EventLogMdcFilter> eventLogMdcFilter() {
        FilterRegistrationBean<EventLogMdcFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new EventLogMdcFilter());
        registration.addUrlPatterns("/api/*");
        registration.setOrder(1);
        return registration;
    }
}
