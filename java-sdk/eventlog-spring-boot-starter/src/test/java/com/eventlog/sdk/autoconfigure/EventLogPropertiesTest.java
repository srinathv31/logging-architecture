package com.eventlog.sdk.autoconfigure;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class EventLogPropertiesTest {

    // --- Root properties: constructor & defaults ---

    @Test
    void defaultValuesWhenAllNulls() {
        EventLogProperties props = new EventLogProperties(
                null, null, null, null, null, null, null, null, null, null, null);
        assertThat(props.isEnabled()).isFalse();
        assertThat(props.getConnectTimeout()).isEqualTo(Duration.ofSeconds(10));
        assertThat(props.getRequestTimeout()).isEqualTo(Duration.ofSeconds(30));
        assertThat(props.getMaxRetries()).isEqualTo(3);
        assertThat(props.getRetryDelay()).isEqualTo(Duration.ofMillis(500));
        assertThat(props.getOauth()).isNotNull();
        assertThat(props.getAsync()).isNotNull();
    }

    @Test
    void enabledTrueWhenSetTrue() {
        EventLogProperties props = createProps(true, "http://localhost");
        assertThat(props.isEnabled()).isTrue();
    }

    @Test
    void enabledFalseWhenNull() {
        EventLogProperties props = new EventLogProperties(
                null, null, null, null, null, null, null, null, null, null, null);
        assertThat(props.isEnabled()).isFalse();
    }

    @Test
    void enabledFalseWhenSetFalse() {
        EventLogProperties props = createProps(false, null);
        assertThat(props.isEnabled()).isFalse();
    }

    @Test
    void customValuesPreserved() {
        Duration ct = Duration.ofSeconds(5);
        Duration rt = Duration.ofSeconds(15);
        Duration rd = Duration.ofMillis(200);
        EventLogProperties props = new EventLogProperties(
                true, "http://api.test", "my-app", ct, rt, 5, rd, "my-key", "jdk", null, null);
        assertThat(props.isEnabled()).isTrue();
        assertThat(props.getBaseUrl()).isEqualTo("http://api.test");
        assertThat(props.getApplicationId()).isEqualTo("my-app");
        assertThat(props.getConnectTimeout()).isEqualTo(ct);
        assertThat(props.getRequestTimeout()).isEqualTo(rt);
        assertThat(props.getMaxRetries()).isEqualTo(5);
        assertThat(props.getRetryDelay()).isEqualTo(rd);
        assertThat(props.getApiKey()).isEqualTo("my-key");
        assertThat(props.getTransport()).isEqualTo("jdk");
    }

    @Test
    void nullBaseUrlReturnsNull() {
        EventLogProperties props = createProps(false, null);
        assertThat(props.getBaseUrl()).isNull();
    }

    // --- Validators ---

    @Test
    void baseUrlValidWhenDisabled() {
        EventLogProperties props = createProps(false, null);
        assertThat(props.isBaseUrlValid()).isTrue();
    }

    @Test
    void baseUrlInvalidWhenEnabledButMissing() {
        EventLogProperties props = createProps(true, null);
        assertThat(props.isBaseUrlValid()).isFalse();
    }

    @Test
    void baseUrlInvalidWhenEnabledWithBlankUrl() {
        EventLogProperties props = createProps(true, "  ");
        assertThat(props.isBaseUrlValid()).isFalse();
    }

    @Test
    void baseUrlValidWhenEnabledAndPresent() {
        EventLogProperties props = createProps(true, "http://localhost");
        assertThat(props.isBaseUrlValid()).isTrue();
    }

    @Test
    void oauthValidWhenDisabled() {
        EventLogProperties props = new EventLogProperties(
                false, null, null, null, null, null, null, null, null,
                new EventLogProperties.OAuth("http://token", "id", null, null, null, null, null), null);
        assertThat(props.isOAuthValid()).isTrue();
    }

    @Test
    void oauthValidWhenNoOauthFieldsSet() {
        EventLogProperties props = createProps(true, "http://localhost");
        assertThat(props.isOAuthValid()).isTrue();
    }

    @Test
    void oauthInvalidWithOnlyTokenUrl() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, null,
                new EventLogProperties.OAuth("http://token", null, null, null, null, null, null), null);
        assertThat(props.isOAuthValid()).isFalse();
    }

    @Test
    void oauthInvalidWithOnlyClientId() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, null,
                new EventLogProperties.OAuth(null, "client-id", null, null, null, null, null), null);
        assertThat(props.isOAuthValid()).isFalse();
    }

    @Test
    void oauthValidWhenAllFieldsSet() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, null,
                new EventLogProperties.OAuth("http://token", "id", "secret", "scope", null, null, null), null);
        assertThat(props.isOAuthValid()).isTrue();
    }

    @Test
    void transportValidForWebclient() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, "webclient", null, null);
        assertThat(props.isTransportValid()).isTrue();
    }

    @Test
    void transportValidForRestclient() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, "restclient", null, null);
        assertThat(props.isTransportValid()).isTrue();
    }

    @Test
    void transportValidForJdk() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, "jdk", null, null);
        assertThat(props.isTransportValid()).isTrue();
    }

    @Test
    void transportInvalidForUnknownValue() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, "grpc", null, null);
        assertThat(props.isTransportValid()).isFalse();
    }

    @Test
    void transportValidWhenNull() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, null, null, null);
        assertThat(props.isTransportValid()).isTrue();
    }

    @Test
    void transportValidWhenBlank() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, "  ", null, null);
        assertThat(props.isTransportValid()).isTrue();
    }

    // --- Transport normalization ---

    @Test
    void normalizeTransportLowerCases() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, "JDK", null, null);
        assertThat(props.getTransport()).isEqualTo("jdk");
    }

    @Test
    void normalizeTransportTrims() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, " restclient ", null, null);
        assertThat(props.getTransport()).isEqualTo("restclient");
    }

    @Test
    void normalizeTransportReturnsNullForBlank() {
        EventLogProperties props = new EventLogProperties(
                true, "http://localhost", null, null, null, null, null, null, "  ", null, null);
        assertThat(props.getTransport()).isNull();
    }

    // --- OAuth nested class ---

    @Test
    void oauthDefaultValues() {
        EventLogProperties.OAuth oauth = new EventLogProperties.OAuth(
                null, null, null, null, null, null, null);
        assertThat(oauth.getTokenUrl()).isNull();
        assertThat(oauth.getClientId()).isNull();
        assertThat(oauth.getClientSecret()).isNull();
        assertThat(oauth.getScope()).isNull();
        assertThat(oauth.getRefreshBuffer()).isEqualTo(Duration.ofSeconds(60));
        assertThat(oauth.getConnectTimeout()).isEqualTo(Duration.ofSeconds(10));
        assertThat(oauth.getRequestTimeout()).isEqualTo(Duration.ofSeconds(30));
    }

    @Test
    void oauthCustomValues() {
        Duration rb = Duration.ofSeconds(30);
        Duration ct = Duration.ofSeconds(5);
        Duration rt = Duration.ofSeconds(15);
        EventLogProperties.OAuth oauth = new EventLogProperties.OAuth(
                "http://token", "id", "secret", "scope", rb, ct, rt);
        assertThat(oauth.getTokenUrl()).isEqualTo("http://token");
        assertThat(oauth.getClientId()).isEqualTo("id");
        assertThat(oauth.getClientSecret()).isEqualTo("secret");
        assertThat(oauth.getScope()).isEqualTo("scope");
        assertThat(oauth.getRefreshBuffer()).isEqualTo(rb);
        assertThat(oauth.getConnectTimeout()).isEqualTo(ct);
        assertThat(oauth.getRequestTimeout()).isEqualTo(rt);
    }

    @Test
    void oauthScopeNullWhenNotSet() {
        EventLogProperties.OAuth oauth = new EventLogProperties.OAuth(
                "http://token", "id", "secret", null, null, null, null);
        assertThat(oauth.getScope()).isNull();
    }

    // --- Async nested class ---

    @Test
    void asyncDefaultValues() {
        EventLogProperties.Async async = new EventLogProperties.Async(
                null, null, null, null, null, null, null, null, null, null);
        assertThat(async.isEnabled()).isTrue();
        assertThat(async.getQueueCapacity()).isEqualTo(10_000);
        assertThat(async.getMaxRetries()).isEqualTo(3);
        assertThat(async.getBaseRetryDelayMs()).isEqualTo(1000);
        assertThat(async.getMaxRetryDelayMs()).isEqualTo(30_000);
        assertThat(async.getCircuitBreakerThreshold()).isEqualTo(5);
        assertThat(async.getCircuitBreakerResetMs()).isEqualTo(30_000);
    }

    @Test
    void asyncCustomValues() {
        Path spillover = Path.of("/tmp/spill");
        EventLogProperties.Async async = new EventLogProperties.Async(
                true, 5000, 5, 2000L, 60000L, 10, 60000L, spillover, true, "myExecutor");
        assertThat(async.isEnabled()).isTrue();
        assertThat(async.getQueueCapacity()).isEqualTo(5000);
        assertThat(async.getMaxRetries()).isEqualTo(5);
        assertThat(async.getBaseRetryDelayMs()).isEqualTo(2000);
        assertThat(async.getMaxRetryDelayMs()).isEqualTo(60000);
        assertThat(async.getCircuitBreakerThreshold()).isEqualTo(10);
        assertThat(async.getCircuitBreakerResetMs()).isEqualTo(60000);
        assertThat(async.getSpilloverPath()).isEqualTo(spillover);
        assertThat(async.isVirtualThreads()).isTrue();
        assertThat(async.getExecutor()).isEqualTo("myExecutor");
    }

    @Test
    void asyncEnabledDefaultsToTrue() {
        EventLogProperties.Async async = new EventLogProperties.Async(
                null, null, null, null, null, null, null, null, null, null);
        assertThat(async.isEnabled()).isTrue();
    }

    @Test
    void asyncEnabledFalseWhenSetFalse() {
        EventLogProperties.Async async = new EventLogProperties.Async(
                false, null, null, null, null, null, null, null, null, null);
        assertThat(async.isEnabled()).isFalse();
    }

    @Test
    void asyncVirtualThreadsDefaultsToFalse() {
        EventLogProperties.Async async = new EventLogProperties.Async(
                null, null, null, null, null, null, null, null, null, null);
        assertThat(async.isVirtualThreads()).isFalse();
    }

    @Test
    void asyncExecutorTrimmed() {
        EventLogProperties.Async async = new EventLogProperties.Async(
                null, null, null, null, null, null, null, null, null, " myBean ");
        assertThat(async.getExecutor()).isEqualTo("myBean");
    }

    @Test
    void asyncExecutorNullWhenBlank() {
        EventLogProperties.Async async = new EventLogProperties.Async(
                null, null, null, null, null, null, null, null, null, "  ");
        assertThat(async.getExecutor()).isNull();
    }

    @Test
    void asyncSpilloverPathPreserved() {
        Path path = Path.of("/var/log/spillover");
        EventLogProperties.Async async = new EventLogProperties.Async(
                null, null, null, null, null, null, null, path, null, null);
        assertThat(async.getSpilloverPath()).isEqualTo(path);
    }

    // --- Helpers ---

    private static EventLogProperties createProps(boolean enabled, String baseUrl) {
        return new EventLogProperties(
                enabled, baseUrl, null, null, null, null, null, null, null, null, null);
    }
}
