#!/usr/bin/env python3
"""
Test and evaluate query classification system.
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Any
import time

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from query_classifier.base_classifier import KeywordClassifier, HybridClassifier
from query_classifier.embedding_classifier import EmbeddingClassifier, HybridEmbeddingClassifier
from routing.query_router import QueryRouter, RoutingStrategy

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_test_dataset() -> List[Dict[str, str]]:
    """Create a comprehensive test dataset for evaluation."""
    test_queries = [
        # Mathematics
        {"query": "What is 15 + 27?", "subject": "mathematics"},
        {"query": "How do you solve quadratic equations?", "subject": "mathematics"},
        {"query": "Calculate the area of a circle with radius 5", "subject": "mathematics"},
        {"query": "What is the derivative of x squared?", "subject": "mathematics"},
        {"query": "Solve for x: 2x + 5 = 15", "subject": "mathematics"},
        {"query": "What is 25% of 80?", "subject": "mathematics"},
        {"query": "Find the integral of sin(x)", "subject": "mathematics"},
        {"query": "What is the Pythagorean theorem?", "subject": "mathematics"},
        {"query": "How do you calculate compound interest?", "subject": "mathematics"},
        {"query": "What is the mean of 5, 10, 15, 20?", "subject": "mathematics"},
        
        # Programming
        {"query": "How do you create a list in Python?", "subject": "programming"},
        {"query": "What is object-oriented programming?", "subject": "programming"},
        {"query": "How to implement binary search algorithm?", "subject": "programming"},
        {"query": "What is the difference between == and === in JavaScript?", "subject": "programming"},
        {"query": "How do you handle exceptions in Python?", "subject": "programming"},
        {"query": "What is a recursive function?", "subject": "programming"},
        {"query": "How to connect to a database?", "subject": "programming"},
        {"query": "What is the time complexity of quicksort?", "subject": "programming"},
        {"query": "How do you create a REST API?", "subject": "programming"},
        {"query": "What is the difference between list and tuple?", "subject": "programming"},
        
        # Science
        {"query": "What is photosynthesis?", "subject": "science"},
        {"query": "How does gravity work?", "subject": "science"},
        {"query": "What is the periodic table?", "subject": "science"},
        {"query": "Explain Newton's laws of motion", "subject": "science"},
        {"query": "What is DNA?", "subject": "science"},
        {"query": "How do vaccines work?", "subject": "science"},
        {"query": "What causes climate change?", "subject": "science"},
        {"query": "What is the speed of light?", "subject": "science"},
        {"query": "How do cells divide?", "subject": "science"},
        {"query": "What is the theory of evolution?", "subject": "science"},
        
        # History
        {"query": "When did World War II end?", "subject": "history"},
        {"query": "Who was Napoleon Bonaparte?", "subject": "history"},
        {"query": "What caused the American Civil War?", "subject": "history"},
        {"query": "When was the Renaissance period?", "subject": "history"},
        {"query": "Who built the pyramids?", "subject": "history"},
        {"query": "What was the Industrial Revolution?", "subject": "history"},
        {"query": "When did the Roman Empire fall?", "subject": "history"},
        {"query": "Who was Cleopatra?", "subject": "history"},
        {"query": "What was the Cold War?", "subject": "history"},
        {"query": "When did humans first land on the moon?", "subject": "history"},
        
        # Literature
        {"query": "Who wrote Romeo and Juliet?", "subject": "literature"},
        {"query": "What is a metaphor?", "subject": "literature"},
        {"query": "Who is the author of Pride and Prejudice?", "subject": "literature"},
        {"query": "What is the theme of To Kill a Mockingbird?", "subject": "literature"},
        {"query": "What is iambic pentameter?", "subject": "literature"},
        {"query": "Who wrote The Great Gatsby?", "subject": "literature"},
        {"query": "What is symbolism in literature?", "subject": "literature"},
        {"query": "What is the difference between simile and metaphor?", "subject": "literature"},
        {"query": "Who wrote 1984?", "subject": "literature"},
        {"query": "What is a sonnet?", "subject": "literature"},
        
        # Ambiguous queries (could belong to multiple subjects)
        {"query": "What is a function?", "subject": "programming"},  # Could be math or programming
        {"query": "How do you solve problems?", "subject": "mathematics"},  # Very general
        {"query": "What is analysis?", "subject": "mathematics"},  # Could be math, science, or literature
        {"query": "What is a variable?", "subject": "programming"},  # Could be math or programming
        {"query": "How do you write?", "subject": "literature"},  # Could be programming or literature
    ]
    
    return test_queries

def evaluate_classifier(classifier, test_queries: List[Dict[str, str]]) -> Dict[str, Any]:
    """Evaluate a classifier on test queries."""
    logger.info(f"Evaluating {type(classifier).__name__}")
    
    correct = 0
    total = len(test_queries)
    subject_stats = {}
    confidence_stats = []
    classification_times = []
    
    # Initialize subject stats
    subjects = set(query["subject"] for query in test_queries)
    for subject in subjects:
        subject_stats[subject] = {"correct": 0, "total": 0, "confidences": []}
    
    # Evaluate each query
    for query_data in test_queries:
        query = query_data["query"]
        true_subject = query_data["subject"]
        
        # Time the classification
        start_time = time.time()
        result = classifier.classify(query)
        classification_time = time.time() - start_time
        
        classification_times.append(classification_time)
        predicted_subject = result.predicted_subject
        confidence = result.confidence
        
        # Update stats
        subject_stats[true_subject]["total"] += 1
        subject_stats[true_subject]["confidences"].append(confidence)
        confidence_stats.append(confidence)
        
        if predicted_subject == true_subject:
            correct += 1
            subject_stats[true_subject]["correct"] += 1
        
        # Log misclassifications
        if predicted_subject != true_subject:
            logger.debug(f"Misclassified: '{query}' -> {predicted_subject} (expected: {true_subject}, confidence: {confidence:.3f})")
    
    # Calculate metrics
    overall_accuracy = correct / total if total > 0 else 0
    avg_confidence = sum(confidence_stats) / len(confidence_stats) if confidence_stats else 0
    avg_classification_time = sum(classification_times) / len(classification_times) if classification_times else 0
    
    # Calculate per-subject metrics
    subject_accuracies = {}
    subject_avg_confidences = {}
    
    for subject, stats in subject_stats.items():
        if stats["total"] > 0:
            subject_accuracies[subject] = stats["correct"] / stats["total"]
            subject_avg_confidences[subject] = sum(stats["confidences"]) / len(stats["confidences"])
        else:
            subject_accuracies[subject] = 0
            subject_avg_confidences[subject] = 0
    
    return {
        "classifier_name": type(classifier).__name__,
        "overall_accuracy": overall_accuracy,
        "average_confidence": avg_confidence,
        "average_classification_time": avg_classification_time,
        "total_queries": total,
        "correct_predictions": correct,
        "subject_accuracies": subject_accuracies,
        "subject_avg_confidences": subject_avg_confidences,
        "subject_stats": subject_stats
    }

def evaluate_router(router: QueryRouter, test_queries: List[Dict[str, str]]) -> Dict[str, Any]:
    """Evaluate the query router."""
    logger.info("Evaluating QueryRouter")
    
    correct_routes = 0
    total = len(test_queries)
    routing_times = []
    confidence_stats = []
    
    for query_data in test_queries:
        query = query_data["query"]
        true_subject = query_data["subject"]
        
        # Route the query
        start_time = time.time()
        decision = router.route_query(query)
        routing_time = time.time() - start_time
        
        routing_times.append(routing_time)
        
        if decision.classification_result:
            confidence_stats.append(decision.confidence)
        
        # Check if routing was correct
        if decision.primary_model == true_subject:
            correct_routes += 1
        elif true_subject in decision.fallback_models:
            # Partial credit for correct fallback
            correct_routes += 0.5
    
    # Calculate metrics
    routing_accuracy = correct_routes / total if total > 0 else 0
    avg_routing_time = sum(routing_times) / len(routing_times) if routing_times else 0
    avg_confidence = sum(confidence_stats) / len(confidence_stats) if confidence_stats else 0
    
    # Get router statistics
    router_stats = router.get_routing_statistics()
    
    return {
        "routing_accuracy": routing_accuracy,
        "average_routing_time": avg_routing_time,
        "average_confidence": avg_confidence,
        "total_queries": total,
        "correct_routes": correct_routes,
        "router_statistics": router_stats
    }

def run_comprehensive_evaluation():
    """Run comprehensive evaluation of all classifiers and router."""
    logger.info("Starting comprehensive evaluation")
    
    # Create test dataset
    test_queries = create_test_dataset()
    subjects = ["mathematics", "programming", "science", "history", "literature"]
    
    # Initialize classifiers
    classifiers = {
        "KeywordClassifier": KeywordClassifier(subjects),
        "HybridClassifier": HybridClassifier(subjects),
        "EmbeddingClassifier": EmbeddingClassifier(subjects),
        "HybridEmbeddingClassifier": HybridEmbeddingClassifier(subjects)
    }
    
    # Evaluate each classifier
    results = {}
    
    for name, classifier in classifiers.items():
        try:
            result = evaluate_classifier(classifier, test_queries)
            results[name] = result
            
            logger.info(f"{name} - Accuracy: {result['overall_accuracy']:.3f}, "
                       f"Avg Confidence: {result['average_confidence']:.3f}, "
                       f"Avg Time: {result['average_classification_time']:.4f}s")
        
        except Exception as e:
            logger.error(f"Failed to evaluate {name}: {e}")
            results[name] = {"error": str(e)}
    
    # Evaluate router
    try:
        router = QueryRouter(subjects, classifier=classifiers["HybridEmbeddingClassifier"])
        router_result = evaluate_router(router, test_queries)
        results["QueryRouter"] = router_result
        
        logger.info(f"QueryRouter - Accuracy: {router_result['routing_accuracy']:.3f}, "
                   f"Avg Time: {router_result['average_routing_time']:.4f}s")
    
    except Exception as e:
        logger.error(f"Failed to evaluate QueryRouter: {e}")
        results["QueryRouter"] = {"error": str(e)}
    
    return results

def print_evaluation_summary(results: Dict[str, Any]):
    """Print a summary of evaluation results."""
    print(f"\n{'='*60}")
    print("QUERY CLASSIFICATION EVALUATION SUMMARY")
    print(f"{'='*60}")
    
    # Sort by accuracy
    classifier_results = {k: v for k, v in results.items() if k != "QueryRouter" and "error" not in v}
    sorted_classifiers = sorted(
        classifier_results.items(),
        key=lambda x: x[1].get("overall_accuracy", 0),
        reverse=True
    )
    
    print(f"\n{'Classifier':<25} {'Accuracy':<10} {'Confidence':<12} {'Time (ms)':<10}")
    print("-" * 60)
    
    for name, result in sorted_classifiers:
        accuracy = result.get("overall_accuracy", 0)
        confidence = result.get("average_confidence", 0)
        time_ms = result.get("average_classification_time", 0) * 1000
        
        print(f"{name:<25} {accuracy:<10.3f} {confidence:<12.3f} {time_ms:<10.1f}")
    
    # Router results
    if "QueryRouter" in results and "error" not in results["QueryRouter"]:
        router_result = results["QueryRouter"]
        print(f"\nQuery Router:")
        print(f"  Routing Accuracy: {router_result['routing_accuracy']:.3f}")
        print(f"  Average Time: {router_result['average_routing_time']*1000:.1f} ms")
    
    # Subject-wise performance for best classifier
    if sorted_classifiers:
        best_classifier_name, best_result = sorted_classifiers[0]
        print(f"\nSubject-wise Performance ({best_classifier_name}):")
        print(f"{'Subject':<15} {'Accuracy':<10} {'Avg Confidence':<15}")
        print("-" * 40)
        
        for subject, accuracy in best_result["subject_accuracies"].items():
            confidence = best_result["subject_avg_confidences"][subject]
            print(f"{subject:<15} {accuracy:<10.3f} {confidence:<15.3f}")

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Test query classification system")
    
    parser.add_argument(
        "--output",
        type=str,
        default="evaluation_results.json",
        help="Output file for detailed results"
    )
    
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Run evaluation
    results = run_comprehensive_evaluation()
    
    # Save detailed results
    with open(args.output, 'w') as f:
        json.dump(results, f, indent=2)
    
    logger.info(f"Detailed results saved to {args.output}")
    
    # Print summary
    print_evaluation_summary(results)

if __name__ == "__main__":
    main()
