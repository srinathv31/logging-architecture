package com.example.petresort.config;

import com.eventlog.sdk.util.EventLogUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class EventLogMdcFilter extends OncePerRequestFilter {

    private static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    private static final String TRACE_ID_HEADER = "X-Trace-Id";
    private static final String SPAN_ID_HEADER = "X-Span-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        try {
            String correlationId = request.getHeader(CORRELATION_ID_HEADER);
            if (correlationId == null || correlationId.isBlank()) {
                correlationId = EventLogUtils.createCorrelationId();
            }

            String traceId = request.getHeader(TRACE_ID_HEADER);
            if (traceId == null || traceId.isBlank()) {
                traceId = EventLogUtils.createTraceId();
            }

            String spanId = request.getHeader(SPAN_ID_HEADER);
            if (spanId == null || spanId.isBlank()) {
                spanId = EventLogUtils.createSpanId();
            }

            MDC.put("correlationId", correlationId);
            MDC.put("traceId", traceId);
            MDC.put("spanId", spanId);

            String simulate = request.getHeader("X-Simulate");
            if (simulate != null && !simulate.isBlank()) {
                MDC.put("simulate", simulate);
            }

            response.setHeader(CORRELATION_ID_HEADER, correlationId);
            response.setHeader(TRACE_ID_HEADER, traceId);
            response.setHeader(SPAN_ID_HEADER, spanId);

            filterChain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
