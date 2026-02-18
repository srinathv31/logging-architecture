package com.eventlog.sdk.template;

import com.eventlog.sdk.client.AsyncEventLogger;
import com.eventlog.sdk.model.EventLogEntry;
import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;
import com.eventlog.sdk.model.HttpMethod;
import org.slf4j.MDC;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * Convenience wrapper for logging common event patterns with shared defaults.
 *
 * <p>Default context is sourced from SLF4J MDC keys when present:</p>
 * <ul>
 *   <li>correlationId</li>
 *   <li>traceId</li>
 *   <li>spanId</li>
 *   <li>parentSpanId</li>
 *   <li>batchId</li>
 * </ul>
 *
 * <p>Explicit values provided via the template or process logger override MDC values.</p>
 */
public final class EventLogTemplate {

    private final AsyncEventLogger eventLog;
    private final String applicationId;
    private final String targetSystem;
    private final String originatingSystem;
    private final ContextProvider contextProvider;

    private EventLogTemplate(Builder builder) {
        this.eventLog = Objects.requireNonNull(builder.eventLog, "eventLog is required");
        this.applicationId = requireText(builder.applicationId, "applicationId is required");
        this.targetSystem = requireText(builder.targetSystem, "targetSystem is required");
        this.originatingSystem = requireText(builder.originatingSystem, "originatingSystem is required");
        this.contextProvider = builder.contextProvider != null ? builder.contextProvider : ContextProvider.mdc();
    }

    public static Builder builder(AsyncEventLogger eventLog) {
        return new Builder(eventLog);
    }

    public ProcessLogger forProcess(String processName) {
        return new ProcessLogger(processName);
    }

    public boolean logProcessStart(
            String correlationId,
            String traceId,
            String processName,
            String summary,
            String result) {
        EventLogEntry.Builder builder = baseBuilder(processName, EventType.PROCESS_START)
                .eventStatus(EventStatus.SUCCESS)
                .stepSequence(0)
                .summary(summary)
                .result(result);
        applyContext(builder, correlationId, traceId, null, null, null);
        return eventLog.log(builder.build());
    }

    public boolean logStep(
            String correlationId,
            String traceId,
            String processName,
            int stepSequence,
            String stepName,
            EventStatus status,
            String summary,
            String result) {
        EventLogEntry.Builder builder = baseBuilder(processName, EventType.STEP)
                .eventStatus(status)
                .stepSequence(stepSequence)
                .stepName(stepName)
                .summary(summary)
                .result(result);
        applyContext(builder, correlationId, traceId, null, null, null);
        return eventLog.log(builder.build());
    }

    public boolean logProcessEnd(
            String correlationId,
            String traceId,
            String processName,
            int stepSequence,
            EventStatus status,
            String summary,
            String result,
            Integer totalDurationMs) {
        EventLogEntry.Builder builder = baseBuilder(processName, EventType.PROCESS_END)
                .eventStatus(status)
                .stepSequence(stepSequence)
                .summary(summary)
                .result(result);
        if (totalDurationMs != null) {
            builder.executionTimeMs(totalDurationMs);
        }
        applyContext(builder, correlationId, traceId, null, null, null);
        return eventLog.log(builder.build());
    }

    public boolean logError(
            String correlationId,
            String traceId,
            String processName,
            String errorCode,
            String errorMessage,
            String summary,
            String result) {
        EventLogEntry.Builder builder = baseBuilder(processName, EventType.ERROR)
                .eventStatus(EventStatus.FAILURE)
                .errorCode(errorCode)
                .errorMessage(errorMessage)
                .summary(summary)
                .result(result);
        applyContext(builder, correlationId, traceId, null, null, null);
        return eventLog.log(builder.build());
    }

    public boolean logError(
            String correlationId,
            String traceId,
            String processName,
            String errorCode,
            String errorMessage,
            String summary) {
        return logError(correlationId, traceId, processName, errorCode, errorMessage, summary, "FAILED");
    }

    private EventLogEntry.Builder baseBuilder(String processName, EventType eventType) {
        return EventLogEntry.builder()
                .applicationId(applicationId)
                .targetSystem(targetSystem)
                .originatingSystem(originatingSystem)
                .processName(processName)
                .eventType(eventType);
    }

    private void applyContext(
            EventLogEntry.Builder builder,
            String correlationId,
            String traceId,
            String spanId,
            String parentSpanId,
            String batchId) {
        EventLogContext context = contextProvider != null ? contextProvider.get() : EventLogContext.empty();

        setIfPresent(correlationId, builder::correlationId);
        if (!hasText(correlationId)) {
            setIfPresent(context.correlationId(), builder::correlationId);
        }

        setIfPresent(traceId, builder::traceId);
        if (!hasText(traceId)) {
            setIfPresent(context.traceId(), builder::traceId);
        }

        setIfPresent(spanId, builder::spanId);
        if (!hasText(spanId)) {
            setIfPresent(context.spanId(), builder::spanId);
        }

        setIfPresent(parentSpanId, builder::parentSpanId);
        if (!hasText(parentSpanId)) {
            setIfPresent(context.parentSpanId(), builder::parentSpanId);
        }

        setIfPresent(batchId, builder::batchId);
        if (!hasText(batchId)) {
            setIfPresent(context.batchId(), builder::batchId);
        }
    }

    private static void setIfPresent(String value, Consumer<String> setter) {
        if (hasText(value)) {
            setter.accept(value);
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String requireText(String value, String message) {
        if (!hasText(value)) {
            throw new IllegalStateException(message);
        }
        return value;
    }

    public interface ContextProvider {
        EventLogContext get();

        static ContextProvider none() {
            return EventLogContext::empty;
        }

        static ContextProvider mdc() {
            return new MdcContextProvider();
        }
    }

    public record EventLogContext(
            String correlationId,
            String traceId,
            String spanId,
            String parentSpanId,
            String batchId) {

        static EventLogContext empty() {
            return new EventLogContext(null, null, null, null, null);
        }
    }

    private static final class MdcContextProvider implements ContextProvider {
        @Override
        public EventLogContext get() {
            return new EventLogContext(
                    firstMdcValue("correlationId", "correlation_id", "correlation-id"),
                    firstMdcValue("traceId", "trace_id", "trace-id"),
                    firstMdcValue("spanId", "span_id", "span-id"),
                    firstMdcValue("parentSpanId", "parent_span_id", "parent-span-id"),
                    firstMdcValue("batchId", "batch_id", "batch-id"));
        }

        private static String firstMdcValue(String... keys) {
            for (String key : keys) {
                String value = MDC.get(key);
                if (hasText(value)) {
                    return value;
                }
            }
            return null;
        }
    }

    public static final class Builder {
        private final AsyncEventLogger eventLog;
        private String applicationId;
        private String targetSystem;
        private String originatingSystem;
        private ContextProvider contextProvider = ContextProvider.mdc();

        private Builder(AsyncEventLogger eventLog) {
            this.eventLog = eventLog;
        }

        public Builder applicationId(String applicationId) {
            this.applicationId = applicationId;
            return this;
        }

        public Builder targetSystem(String targetSystem) {
            this.targetSystem = targetSystem;
            return this;
        }

        public Builder originatingSystem(String originatingSystem) {
            this.originatingSystem = originatingSystem;
            return this;
        }

        public Builder contextProvider(ContextProvider contextProvider) {
            this.contextProvider = contextProvider;
            return this;
        }

        public EventLogTemplate build() {
            return new EventLogTemplate(this);
        }
    }

    public final class ProcessLogger {
        private final String processName;
        private String correlationId;
        private String traceId;
        private String rootSpanId;
        private String callerParentSpanId;
        private boolean rootSpanInitialized = false;
        private String lastStepSpanId;
        private String batchId;
        private String applicationIdOverride;
        private String targetSystemOverride;
        private String originatingSystemOverride;
        private final Map<String, String> identifiers = new HashMap<>();
        private final Map<String, Object> metadata = new HashMap<>();
        private String accountId;
        private String endpoint;
        private HttpMethod httpMethod;
        private Integer httpStatusCode;
        private ProcessLogger(String processName) {
            this.processName = processName;
        }

        public ProcessLogger withCorrelationId(String correlationId) {
            this.correlationId = correlationId;
            return this;
        }

        public ProcessLogger withTraceId(String traceId) {
            this.traceId = traceId;
            return this;
        }

        public ProcessLogger withSpanId(String spanId) {
            this.rootSpanId = spanId;
            this.rootSpanInitialized = true;
            return this;
        }

        public ProcessLogger withParentSpanId(String parentSpanId) {
            this.callerParentSpanId = parentSpanId;
            return this;
        }

        public ProcessLogger withBatchId(String batchId) {
            this.batchId = batchId;
            return this;
        }

        public ProcessLogger withApplicationId(String applicationId) {
            this.applicationIdOverride = applicationId;
            return this;
        }

        public ProcessLogger withTargetSystem(String targetSystem) {
            this.targetSystemOverride = targetSystem;
            return this;
        }

        public ProcessLogger withOriginatingSystem(String originatingSystem) {
            this.originatingSystemOverride = originatingSystem;
            return this;
        }

        public ProcessLogger addIdentifier(String key, String value) {
            identifiers.put(key, value);
            return this;
        }

        public ProcessLogger addMetadata(String key, Object value) {
            metadata.put(key, value);
            return this;
        }

        public ProcessLogger withAccountId(String accountId) {
            this.accountId = accountId;
            return this;
        }

        public ProcessLogger withEndpoint(String endpoint) {
            this.endpoint = endpoint;
            return this;
        }

        public ProcessLogger withHttpMethod(HttpMethod httpMethod) {
            this.httpMethod = httpMethod;
            return this;
        }

        public ProcessLogger withHttpStatusCode(Integer httpStatusCode) {
            this.httpStatusCode = httpStatusCode;
            return this;
        }

        /**
         * Get the root span ID for this process, initializing lazily if needed.
         */
        public String getRootSpanId() {
            ensureRootSpan();
            return rootSpanId;
        }

        /**
         * Get the span ID generated by the most recent logStep/processEnd/error call.
         */
        public String getLastStepSpanId() {
            return lastStepSpanId;
        }

        private void ensureRootSpan() {
            if (!rootSpanInitialized) {
                EventLogContext ctx = contextProvider != null ? contextProvider.get() : EventLogContext.empty();
                if (hasText(ctx.spanId())) {
                    this.rootSpanId = ctx.spanId();
                }
                if (!hasText(this.rootSpanId)) {
                    this.rootSpanId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
                }
                rootSpanInitialized = true;
            }
        }

        public boolean processStart(String summary, String result) {
            EventLogEntry.Builder builder = baseBuilder(EventType.PROCESS_START)
                    .eventStatus(EventStatus.SUCCESS)
                    .stepSequence(0)
                    .summary(summary)
                    .result(result);
            applyProcessContext(builder, true);
            return eventLog.log(builder.build());
        }

        public boolean logStep(
                int stepSequence,
                String stepName,
                EventStatus status,
                String summary,
                String result) {
            EventLogEntry.Builder builder = baseBuilder(EventType.STEP)
                    .eventStatus(status)
                    .stepSequence(stepSequence)
                    .stepName(stepName)
                    .summary(summary)
                    .result(result);
            applyProcessContext(builder, false);
            return eventLog.log(builder.build());
        }

        /**
         * Log a step reusing an existing spanId (for status transitions of the same step).
         */
        public boolean logStep(
                int stepSequence,
                String stepName,
                EventStatus status,
                String summary,
                String result,
                String spanIdOverride) {
            EventLogEntry.Builder builder = baseBuilder(EventType.STEP)
                    .eventStatus(status)
                    .stepSequence(stepSequence)
                    .stepName(stepName)
                    .summary(summary)
                    .result(result);
            if (hasText(spanIdOverride)) {
                ensureRootSpan();
                this.lastStepSpanId = spanIdOverride;
                applyContext(builder, correlationId, traceId, spanIdOverride, this.rootSpanId, batchId);
            } else {
                applyProcessContext(builder, false);
            }
            return eventLog.log(builder.build());
        }

        public boolean logStep(
                int stepSequence,
                String stepName,
                EventStatus status,
                String summary) {
            return logStep(stepSequence, stepName, status, summary, status.name());
        }

        public boolean processEnd(
                int stepSequence,
                EventStatus status,
                String summary,
                String result,
                Integer totalDurationMs) {
            EventLogEntry.Builder builder = baseBuilder(EventType.PROCESS_END)
                    .eventStatus(status)
                    .stepSequence(stepSequence)
                    .summary(summary)
                    .result(result);
            if (totalDurationMs != null) {
                builder.executionTimeMs(totalDurationMs);
            }
            applyProcessContext(builder, false);
            return eventLog.log(builder.build());
        }

        public boolean processEnd(
                int stepSequence,
                EventStatus status,
                String summary) {
            return processEnd(stepSequence, status, summary, status.name(), null);
        }

        public boolean error(String errorCode, String errorMessage, String summary, String result) {
            EventLogEntry.Builder builder = baseBuilder(EventType.ERROR)
                    .eventStatus(EventStatus.FAILURE)
                    .errorCode(errorCode)
                    .errorMessage(errorMessage)
                    .summary(summary)
                    .result(result);
            applyProcessContext(builder, false);
            return eventLog.log(builder.build());
        }

        public boolean error(String errorCode, String errorMessage) {
            return error(errorCode, errorMessage, errorMessage, "FAILED");
        }

        public boolean error(String errorCode, String errorMessage, String summary) {
            return error(errorCode, errorMessage, summary, "FAILED");
        }

        private EventLogEntry.Builder baseBuilder(EventType eventType) {
            EventLogEntry.Builder builder = EventLogEntry.builder()
                    .applicationId(hasText(applicationIdOverride) ? applicationIdOverride : applicationId)
                    .targetSystem(hasText(targetSystemOverride) ? targetSystemOverride : targetSystem)
                    .originatingSystem(hasText(originatingSystemOverride) ? originatingSystemOverride : originatingSystem)
                    .processName(processName)
                    .eventType(eventType);

            if (hasText(accountId)) builder.accountId(accountId);
            if (hasText(endpoint)) builder.endpoint(endpoint);
            if (httpMethod != null) builder.httpMethod(httpMethod);
            if (httpStatusCode != null) builder.httpStatusCode(httpStatusCode);
            if (!identifiers.isEmpty()) {
                builder.identifiers(new HashMap<>(identifiers));
            }
            if (!metadata.isEmpty()) {
                builder.metadata(new HashMap<>(metadata));
            }
            return builder;
        }

        private void applyProcessContext(EventLogEntry.Builder builder, boolean isProcessStart) {
            ensureRootSpan();
            String eventSpanId;
            String eventParentSpanId;
            if (isProcessStart) {
                eventSpanId = this.rootSpanId;
                eventParentSpanId = this.callerParentSpanId;
            } else {
                eventSpanId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
                eventParentSpanId = this.rootSpanId;
            }
            this.lastStepSpanId = eventSpanId;
            applyContext(builder, correlationId, traceId, eventSpanId, eventParentSpanId, batchId);
        }
    }
}
