package rank

import "strings"

// RankFiles keeps the candidates that contain the query.
func RankFiles(query string, files []string) []string {
	var out []string
	for _, f := range files {
		if strings.Contains(f, query) {
			out = append(out, f)
		}
	}
	return out
}
