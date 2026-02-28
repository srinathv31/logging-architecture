---
title: Java SDK
---

# Event Log SDK for Java

Java SDK for the Event Log API v1 — centralized event logging for distributed systems.

Designed for Spring Boot applications — add one dependency, configure properties, and start logging.

## Features

- **EventLogTemplate** — fluent API for multi-step process logging
- **@LogEvent annotation** — automatic method-level event logging
- **Spring Boot Starter** with auto-configuration and property-driven setup
- **OAuth client credentials** authentication
- **Batch operations** for bulk event creation
- **Fork-join pattern** with span links for parallel workflows

## Requirements

- Java 21 or higher
- Spring Boot 3.2+ (tested on 3.2.x, 3.3.x, 3.4.x)
- No external HTTP client dependencies (uses JDK HttpClient)

## Compatibility Matrix

| SDK Version | API Version | Java Version |
|-------------|-------------|--------------|
| 1.0.x       | v1          | 21+          |

Supported Spring Boot versions:
- 3.2.x
- 3.3.x
- 3.4.x

Run matrix tests from the starter module:

```bash
mvn -f eventlog-spring-boot-starter/pom.xml -Pboot-3.2 test
mvn -f eventlog-spring-boot-starter/pom.xml -Pboot-3.3 test
mvn -f eventlog-spring-boot-starter/pom.xml -Pboot-3.4 test
```

## Installation

### Maven

```xml
<dependency>
    <groupId>com.yourcompany.eventlog</groupId>
    <artifactId>eventlog-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

Or for the core SDK without Spring Boot:

```xml
<dependency>
    <groupId>com.yourcompany.eventlog</groupId>
    <artifactId>eventlog-sdk</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle

```groovy
implementation 'com.yourcompany.eventlog:eventlog-spring-boot-starter:1.0.0'
```

## Next Steps

- [Getting Started](/java-sdk/getting-started) — quick start guide
- [EventLogTemplate](/java-sdk/core/event-log-template) — fluent process logging
- [@LogEvent Annotation](/java-sdk/spring-boot/annotations) — automatic method-level logging
- [Auto-Configuration](/java-sdk/spring-boot/auto-configuration) — Spring Boot starter setup
