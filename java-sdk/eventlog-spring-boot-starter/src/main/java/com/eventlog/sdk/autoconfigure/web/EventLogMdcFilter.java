package com.eventlog.sdk.autoconfigure.web;

import com.eventlog.sdk.util.EventLogUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Servlet filter that populates SLF4J MDC with correlation, trace, and span IDs.
 *
 * <p>For each request, the filter reads incoming headers (falling back to generated IDs),
 * puts them into MDC, echoes them on the response, and clears MDC after the request.</p>
 */
public class EventLogMdcFilter extends OncePerRequestFilter {

    private final String correlationHeader;
    private final String traceHeader;
    private final String spanHeader;

    public EventLogMdcFilter(String correlationHeader, String traceHeader, String spanHeader) {
        this.correlationHeader = correlationHeader;
        this.traceHeader = traceHeader;
        this.spanHeader = spanHeader;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String correlationId = request.getHeader(correlationHeader);
            if (correlationId == null || correlationId.isBlank()) {
                correlationId = EventLogUtils.createCorrelationId();
            }

            String traceId = request.getHeader(traceHeader);
            if (traceId == null || traceId.isBlank()) {
                traceId = EventLogUtils.createTraceId();
            }

            String spanId = request.getHeader(spanHeader);
            if (spanId == null || spanId.isBlank()) {
                spanId = EventLogUtils.createSpanId();
            }

            MDC.put("correlationId", correlationId);
            MDC.put("traceId", traceId);
            MDC.put("spanId", spanId);

            response.setHeader(correlationHeader, correlationId);
            response.setHeader(traceHeader, traceId);
            response.setHeader(spanHeader, spanId);

            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("correlationId");
            MDC.remove("traceId");
            MDC.remove("spanId");
        }
    }
}
