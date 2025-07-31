"""
Dataset management for subject-specific training data.
"""

import json
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer
from typing import List, Dict, Any, Optional, Tuple
import logging
import os
from pathlib import Path
import random

logger = logging.getLogger(__name__)

class SubjectDataset(Dataset):
    """
    Dataset class for subject-specific training data.
    """
    
    def __init__(
        self,
        data_path: str,
        tokenizer: AutoTokenizer,
        max_length: int = 512,
        subject_domain: str = "general",
        split: str = "train"
    ):
        self.data_path = data_path
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.subject_domain = subject_domain
        self.split = split
        
        # Load data
        self.data = self._load_data()
        
        logger.info(f"Loaded {len(self.data)} examples for {subject_domain} ({split})")
    
    def _load_data(self) -> List[Dict[str, Any]]:
        """Load data from file."""
        file_path = os.path.join(self.data_path, f"{self.split}.jsonl")
        
        if not os.path.exists(file_path):
            logger.warning(f"Data file not found: {file_path}")
            return []
        
        data = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        data.append(json.loads(line))
        except Exception as e:
            logger.error(f"Error loading data from {file_path}: {e}")
            return []
        
        return data
    
    def __len__(self) -> int:
        return len(self.data)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        """Get a single training example."""
        item = self.data[idx]
        
        # Extract input and target text
        input_text = item.get('input', '')
        target_text = item.get('target', '')
        
        # Create conversation format
        conversation = f"Human: {input_text}\nAssistant: {target_text}"
        
        # Tokenize
        encoding = self.tokenizer(
            conversation,
            truncation=True,
            max_length=self.max_length,
            padding='max_length',
            return_tensors='pt'
        )
        
        # Create labels (same as input_ids for causal LM)
        labels = encoding['input_ids'].clone()
        
        # Mask padding tokens in labels
        labels[labels == self.tokenizer.pad_token_id] = -100
        
        return {
            'input_ids': encoding['input_ids'].squeeze(),
            'attention_mask': encoding['attention_mask'].squeeze(),
            'labels': labels.squeeze()
        }

class SubjectDatasetManager:
    """
    Manager for handling multiple subject datasets.
    """
    
    def __init__(self, tokenizer: AutoTokenizer, data_config: Dict[str, Any]):
        self.tokenizer = tokenizer
        self.data_config = data_config
        self.datasets = {}
    
    def create_dataset(
        self,
        subject: str,
        data_path: str,
        split: str = "train"
    ) -> SubjectDataset:
        """Create a dataset for a specific subject."""
        dataset = SubjectDataset(
            data_path=data_path,
            tokenizer=self.tokenizer,
            max_length=self.data_config.get('max_length', 512),
            subject_domain=subject,
            split=split
        )
        
        key = f"{subject}_{split}"
        self.datasets[key] = dataset
        
        return dataset
    
    def get_dataloader(
        self,
        subject: str,
        split: str = "train",
        batch_size: int = 8,
        shuffle: bool = True,
        num_workers: int = 0
    ) -> DataLoader:
        """Get a DataLoader for a specific subject and split."""
        key = f"{subject}_{split}"
        
        if key not in self.datasets:
            raise ValueError(f"Dataset not found: {key}")
        
        dataset = self.datasets[key]
        
        return DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=shuffle,
            num_workers=num_workers,
            pin_memory=torch.cuda.is_available()
        )
    
    def create_all_dataloaders(
        self,
        subjects: List[str],
        data_paths: Dict[str, str],
        batch_size: int = 8
    ) -> Dict[str, Dict[str, DataLoader]]:
        """Create dataloaders for all subjects and splits."""
        dataloaders = {}
        
        for subject in subjects:
            if subject not in data_paths:
                logger.warning(f"No data path specified for {subject}")
                continue
            
            subject_loaders = {}
            
            # Create datasets for each split
            for split in ['train', 'val', 'test']:
                try:
                    dataset = self.create_dataset(
                        subject=subject,
                        data_path=data_paths[subject],
                        split=split
                    )
                    
                    if len(dataset) > 0:
                        subject_loaders[split] = self.get_dataloader(
                            subject=subject,
                            split=split,
                            batch_size=batch_size,
                            shuffle=(split == 'train')
                        )
                except Exception as e:
                    logger.error(f"Failed to create {split} dataset for {subject}: {e}")
            
            if subject_loaders:
                dataloaders[subject] = subject_loaders
        
        return dataloaders

class DataPreprocessor:
    """
    Preprocessor for subject-specific data.
    """
    
    def __init__(self, subject_domain: str):
        self.subject_domain = subject_domain
    
    def preprocess_text(self, text: str) -> str:
        """Preprocess text for the specific domain."""
        # Basic preprocessing
        text = text.strip()
        
        # Domain-specific preprocessing
        if self.subject_domain == "mathematics":
            text = self._preprocess_math(text)
        elif self.subject_domain == "programming":
            text = self._preprocess_code(text)
        elif self.subject_domain == "science":
            text = self._preprocess_science(text)
        
        return text
    
    def _preprocess_math(self, text: str) -> str:
        """Preprocess mathematical text."""
        # Handle mathematical notation, equations, etc.
        # This is a placeholder for more sophisticated preprocessing
        return text
    
    def _preprocess_code(self, text: str) -> str:
        """Preprocess programming-related text."""
        # Handle code blocks, syntax highlighting, etc.
        # This is a placeholder for more sophisticated preprocessing
        return text
    
    def _preprocess_science(self, text: str) -> str:
        """Preprocess scientific text."""
        # Handle scientific notation, formulas, etc.
        # This is a placeholder for more sophisticated preprocessing
        return text
    
    def create_training_examples(
        self,
        raw_data: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        """Convert raw data to training examples."""
        examples = []
        
        for item in raw_data:
            # Extract relevant fields based on data format
            if 'question' in item and 'answer' in item:
                input_text = self.preprocess_text(item['question'])
                target_text = self.preprocess_text(item['answer'])
            elif 'input' in item and 'output' in item:
                input_text = self.preprocess_text(item['input'])
                target_text = self.preprocess_text(item['output'])
            else:
                logger.warning(f"Unknown data format: {item.keys()}")
                continue
            
            examples.append({
                'input': input_text,
                'target': target_text,
                'subject': self.subject_domain
            })
        
        return examples

def create_sample_data(subject: str, num_samples: int = 100) -> List[Dict[str, str]]:
    """Create sample training data for testing."""
    samples = []
    
    if subject == "mathematics":
        for i in range(num_samples):
            a, b = random.randint(1, 100), random.randint(1, 100)
            samples.append({
                'input': f"What is {a} + {b}?",
                'target': f"The sum of {a} and {b} is {a + b}."
            })
    
    elif subject == "programming":
        for i in range(num_samples):
            samples.append({
                'input': "How do you create a list in Python?",
                'target': "You can create a list in Python using square brackets: my_list = [1, 2, 3] or using the list() constructor: my_list = list()."
            })
    
    elif subject == "science":
        for i in range(num_samples):
            samples.append({
                'input': "What is photosynthesis?",
                'target': "Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to produce glucose and oxygen."
            })
    
    # Add more subjects as needed
    
    return samples

def save_sample_data(subject: str, output_dir: str, num_samples: int = 1000):
    """Save sample data for a subject."""
    os.makedirs(output_dir, exist_ok=True)
    
    # Create sample data
    all_samples = create_sample_data(subject, num_samples)
    
    # Split data
    train_size = int(0.8 * len(all_samples))
    val_size = int(0.1 * len(all_samples))
    
    train_data = all_samples[:train_size]
    val_data = all_samples[train_size:train_size + val_size]
    test_data = all_samples[train_size + val_size:]
    
    # Save splits
    for split, data in [('train', train_data), ('val', val_data), ('test', test_data)]:
        file_path = os.path.join(output_dir, f"{split}.jsonl")
        with open(file_path, 'w', encoding='utf-8') as f:
            for item in data:
                f.write(json.dumps(item) + '\n')
    
    logger.info(f"Saved sample data for {subject} to {output_dir}")
    logger.info(f"Train: {len(train_data)}, Val: {len(val_data)}, Test: {len(test_data)}")

if __name__ == "__main__":
    # Create sample datasets for testing
    subjects = ["mathematics", "programming", "science", "history", "literature"]
    
    for subject in subjects:
        output_dir = f"datasets/{subject}"
        save_sample_data(subject, output_dir, num_samples=500)
