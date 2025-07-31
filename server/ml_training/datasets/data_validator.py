"""
Data validation and quality assurance for training datasets.
"""

import json
import os
import re
from typing import List, Dict, Any, Tuple, Set
import logging
from pathlib import Path
from collections import Counter, defaultdict
import statistics

logger = logging.getLogger(__name__)

class DataValidator:
    """
    Validates training datasets for quality and consistency.
    """
    
    def __init__(self, subject: str, data_dir: str):
        self.subject = subject
        self.data_dir = Path(data_dir)
        self.validation_results = {}
        
    def validate_dataset(self) -> Dict[str, Any]:
        """Run comprehensive validation on the dataset."""
        logger.info(f"Validating dataset for {self.subject}")
        
        results = {
            "subject": self.subject,
            "data_dir": str(self.data_dir),
            "validation_passed": True,
            "issues": [],
            "statistics": {},
            "recommendations": []
        }
        
        # Check if data directory exists
        if not self.data_dir.exists():
            results["validation_passed"] = False
            results["issues"].append(f"Data directory does not exist: {self.data_dir}")
            return results
        
        # Validate each split
        splits = ["train", "val", "test"]
        split_data = {}
        
        for split in splits:
            split_file = self.data_dir / f"{split}.jsonl"
            if split_file.exists():
                data = self._load_jsonl(split_file)
                split_data[split] = data
                
                # Validate split
                split_results = self._validate_split(data, split)
                results[f"{split}_validation"] = split_results
                
                if not split_results["valid"]:
                    results["validation_passed"] = False
                    results["issues"].extend(split_results["issues"])
            else:
                results["issues"].append(f"Missing {split} split file: {split_file}")
                if split == "train":  # Train split is required
                    results["validation_passed"] = False
        
        # Cross-split validation
        if len(split_data) > 1:
            cross_results = self._validate_cross_splits(split_data)
            results["cross_split_validation"] = cross_results
            
            if not cross_results["valid"]:
                results["validation_passed"] = False
                results["issues"].extend(cross_results["issues"])
        
        # Generate statistics
        results["statistics"] = self._generate_statistics(split_data)
        
        # Generate recommendations
        results["recommendations"] = self._generate_recommendations(results)
        
        self.validation_results = results
        return results
    
    def _load_jsonl(self, file_path: Path) -> List[Dict[str, Any]]:
        """Load data from JSONL file."""
        data = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    if line.strip():
                        try:
                            data.append(json.loads(line))
                        except json.JSONDecodeError as e:
                            logger.warning(f"Invalid JSON on line {line_num} in {file_path}: {e}")
        except Exception as e:
            logger.error(f"Error reading {file_path}: {e}")
        
        return data
    
    def _validate_split(self, data: List[Dict[str, Any]], split: str) -> Dict[str, Any]:
        """Validate a single data split."""
        results = {
            "valid": True,
            "issues": [],
            "size": len(data),
            "empty_examples": 0,
            "missing_fields": 0,
            "duplicate_inputs": 0
        }
        
        if len(data) == 0:
            results["valid"] = False
            results["issues"].append(f"{split} split is empty")
            return results
        
        # Check minimum size requirements
        min_sizes = {"train": 100, "val": 20, "test": 20}
        if len(data) < min_sizes.get(split, 10):
            results["issues"].append(f"{split} split has only {len(data)} examples, recommended minimum: {min_sizes.get(split, 10)}")
        
        # Track seen inputs for duplicate detection
        seen_inputs = set()
        
        # Validate each example
        for i, example in enumerate(data):
            # Check required fields
            if not isinstance(example, dict):
                results["issues"].append(f"{split} example {i}: Not a dictionary")
                results["missing_fields"] += 1
                continue
            
            required_fields = ["input", "target"]
            missing = [field for field in required_fields if field not in example or not example[field]]
            
            if missing:
                results["issues"].append(f"{split} example {i}: Missing fields: {missing}")
                results["missing_fields"] += 1
            
            # Check for empty content
            if example.get("input", "").strip() == "" or example.get("target", "").strip() == "":
                results["empty_examples"] += 1
                results["issues"].append(f"{split} example {i}: Empty input or target")
            
            # Check for duplicates
            input_text = example.get("input", "").strip().lower()
            if input_text in seen_inputs:
                results["duplicate_inputs"] += 1
                results["issues"].append(f"{split} example {i}: Duplicate input")
            else:
                seen_inputs.add(input_text)
            
            # Validate text quality
            quality_issues = self._validate_text_quality(example, i, split)
            results["issues"].extend(quality_issues)
        
        # Set validation status
        if results["missing_fields"] > 0 or results["empty_examples"] > 0:
            results["valid"] = False
        
        return results
    
    def _validate_text_quality(self, example: Dict[str, Any], index: int, split: str) -> List[str]:
        """Validate text quality for an example."""
        issues = []
        
        input_text = example.get("input", "")
        target_text = example.get("target", "")
        
        # Check text length
        if len(input_text) < 10:
            issues.append(f"{split} example {index}: Input text too short ({len(input_text)} chars)")
        
        if len(target_text) < 10:
            issues.append(f"{split} example {index}: Target text too short ({len(target_text)} chars)")
        
        if len(input_text) > 2000:
            issues.append(f"{split} example {index}: Input text very long ({len(input_text)} chars)")
        
        if len(target_text) > 2000:
            issues.append(f"{split} example {index}: Target text very long ({len(target_text)} chars)")
        
        # Check for suspicious patterns
        if input_text.count("?") == 0 and "what" in input_text.lower():
            issues.append(f"{split} example {index}: Question missing question mark")
        
        # Check encoding issues
        if "�" in input_text or "�" in target_text:
            issues.append(f"{split} example {index}: Encoding issues detected")
        
        # Check for excessive repetition
        words = input_text.lower().split()
        if len(words) > 5:
            word_counts = Counter(words)
            most_common = word_counts.most_common(1)[0]
            if most_common[1] > len(words) * 0.3:  # More than 30% repetition
                issues.append(f"{split} example {index}: Excessive word repetition: '{most_common[0]}'")
        
        return issues
    
    def _validate_cross_splits(self, split_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Validate consistency across splits."""
        results = {
            "valid": True,
            "issues": [],
            "overlap_train_val": 0,
            "overlap_train_test": 0,
            "overlap_val_test": 0
        }
        
        # Extract inputs from each split
        split_inputs = {}
        for split, data in split_data.items():
            split_inputs[split] = set(example.get("input", "").strip().lower() for example in data)
        
        # Check for overlaps
        if "train" in split_inputs and "val" in split_inputs:
            overlap = split_inputs["train"] & split_inputs["val"]
            results["overlap_train_val"] = len(overlap)
            if overlap:
                results["issues"].append(f"Train-Val overlap: {len(overlap)} examples")
        
        if "train" in split_inputs and "test" in split_inputs:
            overlap = split_inputs["train"] & split_inputs["test"]
            results["overlap_train_test"] = len(overlap)
            if overlap:
                results["issues"].append(f"Train-Test overlap: {len(overlap)} examples")
        
        if "val" in split_inputs and "test" in split_inputs:
            overlap = split_inputs["val"] & split_inputs["test"]
            results["overlap_val_test"] = len(overlap)
            if overlap:
                results["issues"].append(f"Val-Test overlap: {len(overlap)} examples")
        
        # Check split size ratios
        if "train" in split_data and "val" in split_data:
            train_size = len(split_data["train"])
            val_size = len(split_data["val"])
            val_ratio = val_size / (train_size + val_size)
            
            if val_ratio < 0.05 or val_ratio > 0.3:
                results["issues"].append(f"Unusual train-val ratio: {val_ratio:.2%} validation data")
        
        if results["issues"]:
            results["valid"] = False
        
        return results
    
    def _generate_statistics(self, split_data: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Generate dataset statistics."""
        stats = {}
        
        for split, data in split_data.items():
            if not data:
                continue
            
            # Text length statistics
            input_lengths = [len(example.get("input", "")) for example in data]
            target_lengths = [len(example.get("target", "")) for example in data]
            
            split_stats = {
                "size": len(data),
                "input_length": {
                    "mean": statistics.mean(input_lengths),
                    "median": statistics.median(input_lengths),
                    "min": min(input_lengths),
                    "max": max(input_lengths)
                },
                "target_length": {
                    "mean": statistics.mean(target_lengths),
                    "median": statistics.median(target_lengths),
                    "min": min(target_lengths),
                    "max": max(target_lengths)
                }
            }
            
            # Category distribution
            categories = [example.get("category", "unknown") for example in data]
            split_stats["category_distribution"] = dict(Counter(categories))
            
            # Difficulty distribution
            difficulties = [example.get("difficulty", "unknown") for example in data]
            split_stats["difficulty_distribution"] = dict(Counter(difficulties))
            
            stats[split] = split_stats
        
        return stats
    
    def _generate_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on validation results."""
        recommendations = []
        
        # Size recommendations
        stats = results.get("statistics", {})
        if "train" in stats and stats["train"]["size"] < 1000:
            recommendations.append("Consider collecting more training data (current: {}, recommended: 1000+)".format(stats["train"]["size"]))
        
        # Quality recommendations
        if results.get("train_validation", {}).get("duplicate_inputs", 0) > 0:
            recommendations.append("Remove duplicate examples to improve training efficiency")
        
        if results.get("train_validation", {}).get("empty_examples", 0) > 0:
            recommendations.append("Remove or fix examples with empty input/target text")
        
        # Balance recommendations
        if "train" in stats:
            cat_dist = stats["train"].get("category_distribution", {})
            if len(cat_dist) > 1:
                max_count = max(cat_dist.values())
                min_count = min(cat_dist.values())
                if max_count > min_count * 5:  # Imbalanced
                    recommendations.append("Dataset is imbalanced across categories. Consider balancing or using weighted sampling")
        
        # Cross-split recommendations
        cross_val = results.get("cross_split_validation", {})
        if cross_val.get("overlap_train_val", 0) > 0:
            recommendations.append("Remove overlapping examples between train and validation sets")
        
        return recommendations
    
    def save_report(self, output_file: str):
        """Save validation report to file."""
        if not self.validation_results:
            logger.error("No validation results to save. Run validate_dataset() first.")
            return
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.validation_results, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Validation report saved to {output_file}")
    
    def print_summary(self):
        """Print a summary of validation results."""
        if not self.validation_results:
            logger.error("No validation results. Run validate_dataset() first.")
            return
        
        results = self.validation_results
        
        print(f"\n{'='*50}")
        print(f"VALIDATION SUMMARY: {self.subject.upper()}")
        print(f"{'='*50}")
        
        # Overall status
        status = "✅ PASSED" if results["validation_passed"] else "❌ FAILED"
        print(f"Status: {status}")
        
        # Statistics
        stats = results.get("statistics", {})
        for split, split_stats in stats.items():
            print(f"\n{split.upper()} Split:")
            print(f"  Size: {split_stats['size']}")
            print(f"  Avg input length: {split_stats['input_length']['mean']:.1f} chars")
            print(f"  Avg target length: {split_stats['target_length']['mean']:.1f} chars")
        
        # Issues
        if results["issues"]:
            print(f"\nISSUES ({len(results['issues'])}):")
            for issue in results["issues"][:10]:  # Show first 10
                print(f"  • {issue}")
            if len(results["issues"]) > 10:
                print(f"  ... and {len(results['issues']) - 10} more")
        
        # Recommendations
        if results["recommendations"]:
            print(f"\nRECOMMENDATIONS:")
            for rec in results["recommendations"]:
                print(f"  • {rec}")

def validate_all_subjects(base_data_dir: str = "datasets"):
    """Validate datasets for all subjects."""
    base_path = Path(base_data_dir)
    
    if not base_path.exists():
        logger.error(f"Base data directory does not exist: {base_data_dir}")
        return
    
    results = {}
    
    # Find all subject directories
    for subject_dir in base_path.iterdir():
        if subject_dir.is_dir():
            subject = subject_dir.name
            logger.info(f"Validating {subject}...")
            
            validator = DataValidator(subject, str(subject_dir))
            result = validator.validate_dataset()
            results[subject] = result
            
            validator.print_summary()
    
    # Overall summary
    print(f"\n{'='*60}")
    print("OVERALL VALIDATION SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for r in results.values() if r["validation_passed"])
    total = len(results)
    
    print(f"Subjects validated: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    
    if total - passed > 0:
        print("\nFailed subjects:")
        for subject, result in results.items():
            if not result["validation_passed"]:
                print(f"  ❌ {subject}")
    
    return results

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    validate_all_subjects()
