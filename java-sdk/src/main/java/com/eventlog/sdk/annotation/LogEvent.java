package com.eventlog.sdk.annotation;

import com.eventlog.sdk.model.EventStatus;
import com.eventlog.sdk.model.EventType;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Log a method execution as an Event Log entry.
 *
 * <p>Designed for Spring AOP integration. Requires the Event Log Spring Boot starter.</p>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogEvent {

    /**
     * Business process name.
     * If blank, defaults to the declaring class name when using Spring AOP.
     */
    String process();

    /**
     * Step number within the process (optional).
     */
    int step() default -1;

    /**
     * Human-readable step name (defaults to method name).
     */
    String name() default "";

    /**
     * Event type to log (defaults to STEP).
     */
    EventType eventType() default EventType.STEP;

    /**
     * Event status to use on success.
     */
    EventStatus successStatus() default EventStatus.SUCCESS;

    /**
     * Event status to use on failure.
     */
    EventStatus failureStatus() default EventStatus.FAILURE;

    /**
     * Optional summary override for success.
     */
    String summary() default "";

    /**
     * Optional summary override for failure.
     */
    String failureSummary() default "";

    /**
     * Optional result override for success.
     */
    String result() default "";

    /**
     * Optional result override for failure.
     */
    String failureResult() default "";

    /**
     * Optional error code override for failures.
     */
    String errorCode() default "";

    /**
     * Log on success (default: true).
     */
    boolean logOnSuccess() default true;

    /**
     * Log on failure (default: true).
     */
    boolean logOnFailure() default true;
}
