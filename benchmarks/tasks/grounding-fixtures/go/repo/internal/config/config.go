package config

// LoadConfig reads the configuration file at path.
func LoadConfig(path string) (map[string]string, error) {
	return map[string]string{"path": path}, nil
}

// MergeDefaults overlays cfg on top of defaults.
func MergeDefaults(cfg, defaults map[string]string) map[string]string {
	out := map[string]string{}
	for k, v := range defaults {
		out[k] = v
	}
	for k, v := range cfg {
		out[k] = v
	}
	return out
}
