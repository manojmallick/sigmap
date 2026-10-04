package com.acme;

import java.util.ArrayList;
import java.util.List;

/** Ranks candidate files. */
public final class Ranker {
    /** Keep the candidates that contain the query. */
    public static List<String> rankFiles(String query, List<String> files) {
        List<String> out = new ArrayList<>();
        for (String f : files) {
            if (f.contains(query)) out.add(f);
        }
        return out;
    }
}
