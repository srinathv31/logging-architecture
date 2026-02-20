package com.example.petresort.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Configuration
public class EventLogConfig {

    // The SDK starter auto-registers EventLogMdcFilter for correlation/trace/span.
    // This filter only adds the demo-specific X-Simulate header to MDC.
    @Bean
    public FilterRegistrationBean<SimulateHeaderFilter> simulateHeaderFilter() {
        FilterRegistrationBean<SimulateHeaderFilter> reg = new FilterRegistrationBean<>();
        reg.setFilter(new SimulateHeaderFilter());
        reg.addUrlPatterns("/api/*");
        reg.setOrder(2); // after starter's MDC filter (order 1)
        return reg;
    }

    static class SimulateHeaderFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request,
                                        HttpServletResponse response,
                                        FilterChain chain) throws ServletException, IOException {
            String simulate = request.getHeader("X-Simulate");
            if (simulate != null && !simulate.isBlank()) {
                MDC.put("simulate", simulate);
            }
            try {
                chain.doFilter(request, response);
            } finally {
                MDC.remove("simulate");
            }
        }
    }
}
