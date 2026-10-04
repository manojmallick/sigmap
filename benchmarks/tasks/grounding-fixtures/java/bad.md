# Wiring configuration

`src/main/java/com/acme/Config.java` exposes `loadConfg(path)` and `mergeDefaults(defaults)`.
Filtering is `rankFiles(query, files)` in `src/main/java/com/acme/Ranker.java`, with auditing in `src/main/java/com/acme/AuditLog.java` through `phantomHandler(event)`.
Cover it with `src/test/java/com/acme/AuditLogTest.java`.
