package com.eventlog.sdk.autoconfigure;

import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.util.ClassUtils;

final class EventLogBaseAutoConfigurationCondition implements Condition {

    private static final String REFRESH_SCOPE_CLASS = "org.springframework.cloud.context.scope.refresh.RefreshScope";

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        boolean refreshScopePresent = ClassUtils.isPresent(REFRESH_SCOPE_CLASS, context.getClassLoader());
        String refreshEnabledProperty = context.getEnvironment().getProperty("eventlog.refresh.enabled");
        boolean refreshEnabled = refreshEnabledProperty == null || Boolean.parseBoolean(refreshEnabledProperty);
        return !refreshScopePresent || !refreshEnabled;
    }
}
