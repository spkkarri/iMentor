#!/usr/bin/env python3
"""
Dataset preparation script for subject-specific training.
"""

import os
import sys
import argparse
import logging
from pathlib import Path

# Setup logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

try:
    from datasets.dataset_collector import collect_all_datasets, MathematicsDatasetCollector, ProgrammingDatasetCollector, ScienceDatasetCollector
except ImportError as e:
    logger.warning(f"Could not import dataset collectors: {e}")
    collect_all_datasets = None
    MathematicsDatasetCollector = None
    ProgrammingDatasetCollector = None
    ScienceDatasetCollector = None

try:
    from datasets.data_validator import validate_all_subjects, DataValidator
except ImportError as e:
    logger.warning(f"Could not import data validator: {e}")
    validate_all_subjects = None
    DataValidator = None

try:
    from configs.base_config import get_all_subjects
except ImportError as e:
    logger.warning(f"Could not import base config: {e}")
    def get_all_subjects():
        return ["mathematics", "programming", "science", "history", "literature"]

def create_enhanced_datasets(output_dir: str = "datasets"):
    """Create enhanced datasets with more variety and quality."""
    logger.info("Creating enhanced datasets for all subjects...")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Subject-specific collectors
    collectors = {
        "mathematics": MathematicsDatasetCollector,
        "programming": ProgrammingDatasetCollector,
        "science": ScienceDatasetCollector,
    }
    
    # Add simple collectors for other subjects
    for subject in ["history", "literature"]:
        if subject not in collectors:
            collectors[subject] = create_simple_collector(subject)
    
    # Collect data for each subject
    for subject, collector_class in collectors.items():
        logger.info(f"Creating dataset for {subject}...")
        
        subject_dir = os.path.join(output_dir, subject)
        os.makedirs(subject_dir, exist_ok=True)
        
        try:
            if callable(collector_class):
                collector = collector_class(subject, subject_dir)
                data = collector.collect_data()
                collector.save_data(data)
                logger.info(f"✅ Created {len(data)} examples for {subject}")
            else:
                # Handle simple data creation
                data = collector_class
                save_simple_data(data, subject_dir)
                logger.info(f"✅ Created {len(data)} examples for {subject}")
                
        except Exception as e:
            logger.error(f"❌ Failed to create dataset for {subject}: {e}")

def create_simple_collector(subject: str):
    """Create simple data for subjects without specialized collectors."""
    if subject == "history":
        return [
            {
                "input": "What caused World War I?",
                "target": "World War I was caused by a complex mix of factors including militarism, alliances, imperialism, and nationalism. The immediate trigger was the assassination of Archduke Franz Ferdinand in 1914.",
                "category": "world_wars",
                "difficulty": "intermediate"
            },
            {
                "input": "Who was Napoleon Bonaparte?",
                "target": "Napoleon Bonaparte was a French military leader and emperor who rose to power during the French Revolution. He conquered much of Europe in the early 19th century before his defeat at Waterloo in 1815.",
                "category": "european_history",
                "difficulty": "intermediate"
            },
            {
                "input": "What was the Renaissance?",
                "target": "The Renaissance was a period of cultural, artistic, and intellectual rebirth in Europe from the 14th to 17th centuries. It marked the transition from medieval to modern times and saw advances in art, science, and literature.",
                "category": "cultural_history",
                "difficulty": "intermediate"
            }
        ] * 500  # Repeat to create more examples
    
    elif subject == "literature":
        return [
            {
                "input": "Who wrote Romeo and Juliet?",
                "target": "Romeo and Juliet was written by William Shakespeare, the famous English playwright and poet. It's one of his most famous tragedies, written in the early part of his career.",
                "category": "shakespeare",
                "difficulty": "beginner"
            },
            {
                "input": "What is a metaphor?",
                "target": "A metaphor is a figure of speech that compares two unlike things without using 'like' or 'as'. It states that one thing is another thing. For example, 'Life is a journey' is a metaphor.",
                "category": "literary_devices",
                "difficulty": "beginner"
            },
            {
                "input": "What is the theme of To Kill a Mockingbird?",
                "target": "The main themes of To Kill a Mockingbird include racial injustice, moral growth, and the loss of innocence. Harper Lee explores these themes through the eyes of Scout Finch in Depression-era Alabama.",
                "category": "american_literature",
                "difficulty": "intermediate"
            }
        ] * 500  # Repeat to create more examples
    
    return []

def save_simple_data(data, output_dir):
    """Save simple data to train/val/test splits."""
    import random
    import json
    
    # Shuffle data
    random.shuffle(data)
    
    # Calculate split sizes
    total_size = len(data)
    train_size = int(total_size * 0.8)
    val_size = int(total_size * 0.1)
    
    # Split data
    train_data = data[:train_size]
    val_data = data[train_size:train_size + val_size]
    test_data = data[train_size + val_size:]
    
    # Save splits
    splits = {"train": train_data, "val": val_data, "test": test_data}
    
    for split_name, split_data in splits.items():
        file_path = os.path.join(output_dir, f"{split_name}.jsonl")
        with open(file_path, 'w', encoding='utf-8') as f:
            for item in split_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')

def augment_datasets(data_dir: str = "datasets"):
    """Augment existing datasets with variations."""
    logger.info("Augmenting datasets with variations...")
    
    # This could include:
    # - Paraphrasing questions
    # - Adding synonyms
    # - Creating variations of problems
    # - Back-translation for diversity
    
    # For now, this is a placeholder
    logger.info("Dataset augmentation completed (placeholder)")

def clean_datasets(data_dir: str = "datasets"):
    """Clean and preprocess datasets."""
    logger.info("Cleaning datasets...")
    
    data_path = Path(data_dir)
    
    for subject_dir in data_path.iterdir():
        if not subject_dir.is_dir():
            continue
        
        subject = subject_dir.name
        logger.info(f"Cleaning {subject} dataset...")
        
        for split_file in subject_dir.glob("*.jsonl"):
            # Load data
            data = []
            with open(split_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        try:
                            data.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
            
            # Clean data
            cleaned_data = []
            for item in data:
                if isinstance(item, dict) and "input" in item and "target" in item:
                    # Clean text
                    item["input"] = item["input"].strip()
                    item["target"] = item["target"].strip()
                    
                    # Skip empty items
                    if item["input"] and item["target"]:
                        cleaned_data.append(item)
            
            # Save cleaned data
            with open(split_file, 'w', encoding='utf-8') as f:
                for item in cleaned_data:
                    f.write(json.dumps(item, ensure_ascii=False) + '\n')
            
            logger.info(f"Cleaned {split_file.name}: {len(data)} -> {len(cleaned_data)} examples")

def generate_statistics(data_dir: str = "datasets"):
    """Generate comprehensive statistics for all datasets."""
    logger.info("Generating dataset statistics...")
    
    data_path = Path(data_dir)
    stats = {}
    
    for subject_dir in data_path.iterdir():
        if not subject_dir.is_dir():
            continue
        
        subject = subject_dir.name
        subject_stats = {}
        
        for split in ["train", "val", "test"]:
            split_file = subject_dir / f"{split}.jsonl"
            if split_file.exists():
                # Load and analyze data
                data = []
                with open(split_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            try:
                                data.append(json.loads(line))
                            except json.JSONDecodeError:
                                continue
                
                # Calculate statistics
                if data:
                    input_lengths = [len(item.get("input", "")) for item in data]
                    target_lengths = [len(item.get("target", "")) for item in data]
                    
                    subject_stats[split] = {
                        "count": len(data),
                        "avg_input_length": sum(input_lengths) / len(input_lengths),
                        "avg_target_length": sum(target_lengths) / len(target_lengths),
                        "max_input_length": max(input_lengths),
                        "max_target_length": max(target_lengths)
                    }
        
        stats[subject] = subject_stats
    
    # Save statistics
    stats_file = data_path / "dataset_statistics.json"
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print(f"\n{'='*50}")
    print("DATASET STATISTICS SUMMARY")
    print(f"{'='*50}")
    
    for subject, subject_stats in stats.items():
        print(f"\n{subject.upper()}:")
        for split, split_stats in subject_stats.items():
            print(f"  {split}: {split_stats['count']} examples")
    
    logger.info(f"Statistics saved to {stats_file}")

def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Prepare datasets for subject-specific training")
    
    parser.add_argument(
        "--action",
        choices=["create", "validate", "clean", "augment", "stats", "all"],
        default="all",
        help="Action to perform (default: all)"
    )
    
    parser.add_argument(
        "--data-dir",
        type=str,
        default="datasets",
        help="Data directory (default: datasets)"
    )
    
    parser.add_argument(
        "--subject",
        type=str,
        choices=get_all_subjects() + ["all"],
        default="all",
        help="Subject to process (default: all)"
    )
    
    args = parser.parse_args()
    
    # Create data directory
    os.makedirs(args.data_dir, exist_ok=True)
    
    if args.action in ["create", "all"]:
        logger.info("Creating datasets...")
        create_enhanced_datasets(args.data_dir)
    
    if args.action in ["clean", "all"]:
        logger.info("Cleaning datasets...")
        clean_datasets(args.data_dir)
    
    if args.action in ["augment", "all"]:
        logger.info("Augmenting datasets...")
        augment_datasets(args.data_dir)
    
    if args.action in ["validate", "all"]:
        logger.info("Validating datasets...")
        validate_all_subjects(args.data_dir)
    
    if args.action in ["stats", "all"]:
        logger.info("Generating statistics...")
        generate_statistics(args.data_dir)
    
    logger.info("Dataset preparation completed!")

if __name__ == "__main__":
    main()
