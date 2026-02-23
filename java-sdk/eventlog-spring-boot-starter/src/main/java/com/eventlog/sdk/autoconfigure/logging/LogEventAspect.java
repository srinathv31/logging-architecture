package com.eventlog.sdk.autoconfigure.logging;

import com.eventlog.sdk.annotation.LogEvent;
import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import com.eventlog.sdk.util.EventLogUtils;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.env.Environment;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Aspect
public class LogEventAspect {

    private static final Logger log = LoggerFactory.getLogger(LogEventAspect.class);

    private final AsyncEventLogger eventLog;
    private final String applicationId;
    private final String targetSystem;
    private final String originatingSystem;
    private final AtomicBoolean missingDefaultsLogged = new AtomicBoolean(false);

    public LogEventAspect(AsyncEventLogger eventLog, String applicationId, String targetSystem, String originatingSystem) {
        this.eventLog = eventLog;
        this.applicationId = applicationId;
        this.targetSystem = targetSystem;
        this.originatingSystem = originatingSystem;
    }

    public static LogEventAspect from(Environment environment, com.eventlog.sdk.autoconfigure.EventLogProperties properties, AsyncEventLogger eventLog) {
        String resolvedApplicationId = firstNonBlank(
                properties.getApplicationId(),
                environment.getProperty("spring.application.name"),
                environment.getProperty("eventlog.target-system"),
                environment.getProperty("eventlog.originating-system"));
        String resolvedTargetSystem = firstNonBlank(environment.getProperty("eventlog.target-system"), resolvedApplicationId);
        String resolvedOriginatingSystem = firstNonBlank(environment.getProperty("eventlog.originating-system"), resolvedApplicationId);
        return new LogEventAspect(eventLog, resolvedApplicationId, resolvedTargetSystem, resolvedOriginatingSystem);
    }

    @Around("@annotation(logEvent)")
    public Object logEvent(ProceedingJoinPoint joinPoint, LogEvent logEvent) throws Throwable {
        long start = System.nanoTime();
        boolean success = false;
        Throwable error = null;
        try {
            Object result = joinPoint.proceed();
            success = true;
            return result;
        } catch (Throwable ex) {
            error = ex;
            throw ex;
        } finally {
            boolean shouldLog = success ? logEvent.logOnSuccess() : logEvent.logOnFailure();
            if (logEvent.eventType() == EventType.ERROR && success) {
                shouldLog = false;
            }
            if (shouldLog) {
                int durationMs = (int) TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
                try {
                    recordEvent(joinPoint, logEvent, success, error, durationMs);
                } catch (Exception logError) {
                    log.warn("Failed to log @LogEvent for {}", joinPoint.getSignature(), logError);
                }
            }
        }
    }

    private void recordEvent(
            ProceedingJoinPoint joinPoint,
            LogEvent annotation,
            boolean success,
            Throwable error,
            int durationMs) {
        String processName = annotation.process();
        if (!hasText(processName)) {
            String resolved = resolveProcessName(joinPoint);
            if (!hasText(resolved)) {
                resolved = resolveMethodName(joinPoint);
            }
            processName = resolved;
            log.warn("@LogEvent missing process name for {} - defaulting to {}", joinPoint.getSignature(), processName);
            if (!hasText(processName)) {
                return;
            }
        }
        if (!hasText(applicationId) || !hasText(targetSystem) || !hasText(originatingSystem)) {
            if (missingDefaultsLogged.compareAndSet(false, true)) {
                log.warn("@LogEvent requires applicationId/targetSystem/originatingSystem. " +
                        "Set eventlog.application-id or spring.application.name, or override target/origin via properties.");
            }
            return;
        }

        String correlationId = firstNonBlank(
                mdcValue("correlationId", "correlation_id", "correlation-id"),
                EventLogUtils.createCorrelationId(sanitizePrefix(processName)));
        String traceId = firstNonBlank(
                mdcValue("traceId", "trace_id", "trace-id"),
                EventLogUtils.createTraceId());
        String mdcSpanId = mdcValue("spanId", "span_id", "span-id");
        String spanId = EventLogUtils.createSpanId();
        String parentSpanId = mdcValue("parentSpanId", "parent_span_id", "parent-span-id");
        if (!hasText(parentSpanId) && hasText(mdcSpanId)) {
            parentSpanId = mdcSpanId;
        }
        String batchId = mdcValue("batchId", "batch_id", "batch-id");

        String stepName = hasText(annotation.name()) ? annotation.name() : resolveMethodName(joinPoint);
        EventType eventType = annotation.eventType();
        EventStatus status = success ? annotation.successStatus() : annotation.failureStatus();

        String summary = resolveSummary(joinPoint, annotation, success, error);
        String result = resolveResult(annotation, status, success);

        EventLogEntry.Builder builder = EventLogEntry.builder()
                .applicationId(applicationId)
                .targetSystem(targetSystem)
                .originatingSystem(originatingSystem)
                .processName(processName)
                .eventType(eventType)
                .eventStatus(status)
                .summary(summary)
                .result(result)
                .executionTimeMs(durationMs)
                .correlationId(correlationId)
                .traceId(traceId);

        if (hasText(stepName)) {
            builder.stepName(stepName);
        }
        if (annotation.step() >= 0) {
            builder.stepSequence(annotation.step());
        } else if (eventType == EventType.PROCESS_START) {
            builder.stepSequence(0);
        }
        builder.spanId(spanId);
        if (hasText(parentSpanId)) {
            builder.parentSpanId(parentSpanId);
        }
        if (hasText(batchId)) {
            builder.batchId(batchId);
        }

        if (!success) {
            String errorCode = hasText(annotation.errorCode())
                    ? annotation.errorCode()
                    : error != null ? error.getClass().getSimpleName() : null;
            String errorMessage = error != null ? error.getMessage() : null;
            if (hasText(errorCode)) {
                builder.errorCode(errorCode);
            }
            if (hasText(errorMessage)) {
                builder.errorMessage(errorMessage);
            }
        }

        Map<String, Object> metadata = new HashMap<>();
        metadata.put("class", joinPoint.getSignature().getDeclaringTypeName());
        metadata.put("method", resolveMethodName(joinPoint));
        builder.metadata(metadata);

        eventLog.log(builder.build());
    }

    private static String resolveProcessName(ProceedingJoinPoint joinPoint) {
        if (joinPoint.getSignature() != null) {
            Class<?> declaringType = joinPoint.getSignature().getDeclaringType();
            if (declaringType != null) {
                return declaringType.getSimpleName();
            }
            return joinPoint.getSignature().getDeclaringTypeName();
        }
        return null;
    }

    private static String resolveMethodName(ProceedingJoinPoint joinPoint) {
        if (joinPoint.getSignature() instanceof MethodSignature signature) {
            Method method = signature.getMethod();
            return method != null ? method.getName() : joinPoint.getSignature().getName();
        }
        return joinPoint.getSignature().getName();
    }

    private static String resolveSummary(
            ProceedingJoinPoint joinPoint,
            LogEvent annotation,
            boolean success,
            Throwable error) {
        if (success && hasText(annotation.summary())) {
            return annotation.summary();
        }
        if (!success && hasText(annotation.failureSummary())) {
            return annotation.failureSummary();
        }
        String method = resolveMethodName(joinPoint);
        if (success) {
            return "Completed " + method;
        }
        String message = error != null ? error.getClass().getSimpleName() : "error";
        return "Failed " + method + " - " + message;
    }

    private static String resolveResult(LogEvent annotation, EventStatus status, boolean success) {
        if (success && hasText(annotation.result())) {
            return annotation.result();
        }
        if (!success && hasText(annotation.failureResult())) {
            return annotation.failureResult();
        }
        return status.name();
    }

    private static String sanitizePrefix(String value) {
        if (!hasText(value)) {
            return "corr";
        }
        String sanitized = value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
        if (sanitized.isBlank()) {
            return "corr";
        }
        return sanitized;
    }

    private static String mdcValue(String... keys) {
        for (String key : keys) {
            String value = MDC.get(key);
            if (hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private static String firstNonBlank(String primary, String fallback) {
        if (hasText(primary)) {
            return primary;
        }
        return hasText(fallback) ? fallback : null;
    }

    private static String firstNonBlank(String first, String second, String third, String fourth) {
        if (hasText(first)) {
            return first;
        }
        if (hasText(second)) {
            return second;
        }
        if (hasText(third)) {
            return third;
        }
        return hasText(fourth) ? fourth : null;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
