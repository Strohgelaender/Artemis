package de.tum.in.www1.artemis.domain.plagiarism.text;

import java.util.Comparator;
import java.util.stream.Collectors;

import javax.persistence.Entity;

import de.tum.in.www1.artemis.domain.plagiarism.PlagiarismComparison;
import de.tum.in.www1.artemis.domain.plagiarism.PlagiarismResult;
import jplag.JPlagComparison;
import jplag.JPlagResult;

/**
 * Result of the automatic plagiarism detection for text or programming exercises.
 */
@Entity
public class TextPlagiarismResult extends PlagiarismResult<TextSubmissionElement> {

    public void convertJPlagResult(JPlagResult result) {
        // sort and limit the number of comparisons to 500
        var comparisons = result.getComparisons().stream().sorted(Comparator.comparingDouble(JPlagComparison::percent).reversed()).limit(500).collect(Collectors.toList());
        // only convert those 500 comparisons to save memory and cpu power
        for (var jPlagComparison : comparisons) {
            var comparison = PlagiarismComparison.fromJPlagComparison(jPlagComparison);
            comparison.setPlagiarismResult(this);
            this.comparisons.add(comparison);
        }
        this.duration = result.getDuration();
        this.setSimilarityDistribution(result.getSimilarityDistribution());
    }
}
