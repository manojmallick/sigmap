package com.acme;

/** Project configuration. */
public class Config {
    /** Load configuration from the given path. */
    public static Config loadConfig(String path) {
        return new Config();
    }

    /** Overlay this configuration on top of defaults. */
    public Config mergeDefaults(Config defaults) {
        return this;
    }
}
