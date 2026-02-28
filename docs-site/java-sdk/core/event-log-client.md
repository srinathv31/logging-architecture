---
title: EventLogClient
---

# EventLogClient

The synchronous HTTP client for the Event Log API. In Spring Boot, this bean is auto-configured. Use this only when you need confirmation that events were sent (rare). For most use cases, prefer [AsyncEventLogger](/java-sdk/core/async-event-logger).

## Creating a Client

```java
EventLogClient client = EventLogClient.builder()
    .baseUrl("https://eventlog-api.yourcompany.com")  // Required
    .apiKey("your-api-key")                           // Optional
    .applicationId("my-service")                      // Sets X-Application-Id header
    .connectTimeout(Duration.ofSeconds(10))           // Connection timeout
    .requestTimeout(Duration.ofSeconds(30))           // Request timeout
    .maxRetries(3)                                    // Retry attempts on 5xx/429
    .retryDelay(Duration.ofMillis(500))               // Base delay (exponential backoff)
    .build();
```

## Sending Events

### Single Event

```java
var response = client.createEvent(event);
System.out.println("Created event: " + response.getExecutionIds());
```

### Batch

```java
var batchResponse = client.createEvents(List.of(event1, event2, event3));
```

## Async Operations

All write operations have async variants returning `CompletableFuture`:

```java
// Async event creation
CompletableFuture<CreateEventResponse> future = client.createEventAsync(event);

// With callback
future.thenAccept(response -> {
    System.out.println("Event created: " + response.getExecutionIds());
}).exceptionally(ex -> {
    System.err.println("Failed: " + ex.getMessage());
    return null;
});

// Or wait for result
CreateEventResponse response = future.get();
```

## Querying Events

```java
// Get events by account
var accountEvents = client.getEventsByAccount("AC-1234567890");

// With filters
var filteredEvents = client.getEventsByAccount("AC-1234567890", Map.of(
    "startDate", "2025-01-01T00:00:00Z",
    "processName", "ADD_AUTH_USER",
    "eventStatus", "FAILURE"
));

// Get events by correlation ID
var processEvents = client.getEventsByCorrelation("corr-emp-20250126-a1b2c3");

// Get events by trace ID (distributed tracing)
var traceEvents = client.getEventsByTrace("4bf92f3577b34da6a3ce929d0e0e4736");
```

## Correlation Links

```java
client.createCorrelationLink(
    correlationId,           // Process correlation ID
    "AC-EMP-001234",        // New account ID
    "APP-998877",           // Application ID
    "EMP-456",              // Customer/Employee ID
    null                    // Card last 4 (optional)
);
```

## Error Handling

```java
try {
    client.createEvent(event);
} catch (EventLogException e) {
    System.err.println("Status: " + e.getStatusCode());
    System.err.println("Error code: " + e.getErrorCode());
    System.err.println("Message: " + e.getMessage());
}
```
