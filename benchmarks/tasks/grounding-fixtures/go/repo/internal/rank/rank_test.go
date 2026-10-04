package rank

import "testing"

func TestRankFiles(t *testing.T) {
	if got := RankFiles("a", []string{"a", "b"}); len(got) != 1 {
		t.Fatal(got)
	}
}
