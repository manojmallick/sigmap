# Wiring configuration

`src/main/java/com/acme/Config.java` exposes `loadConfig(path)` and `mergeDefaults(defaults)`.
Filtering is `rankFiles(query, files)` in `src/main/java/com/acme/Ranker.java`; the existing test is `src/test/java/com/acme/ConfigTest.java`.
