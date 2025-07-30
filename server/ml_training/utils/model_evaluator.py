"""
Model evaluation and benchmarking utilities.
"""

import torch
import numpy as np
import time
import json
import logging
from typing import Dict, List, Any, Tuple
from pathlib import Path
from transformers import AutoTokenizer
import matplotlib.pyplot as plt
import seaborn as sns
from collections import defaultdict

logger = logging.getLogger(__name__)

class ModelEvaluator:
    """
    Comprehensive model evaluation and benchmarking.
    """
    
    def __init__(self, model, tokenizer, device="auto"):
        self.model = model
        self.tokenizer = tokenizer
        self.device = device if device != "auto" else ("cuda" if torch.cuda.is_available() else "cpu")
        
        # Move model to device
        if hasattr(self.model, 'to'):
            self.model = self.model.to(self.device)
        
        self.model.eval()
        
    def evaluate_on_dataset(self, dataset, batch_size: int = 8) -> Dict[str, Any]:
        """Evaluate model on a dataset."""
        logger.info(f"Evaluating model on {len(dataset)} examples")
        
        total_loss = 0
        total_tokens = 0
        predictions = []
        targets = []
        
        # Process in batches
        for i in range(0, len(dataset), batch_size):
            batch = dataset[i:i + batch_size]
            
            batch_inputs = []
            batch_targets = []
            
            for item in batch:
                input_text = item.get("input", "")
                target_text = item.get("target", "")
                
                batch_inputs.append(input_text)
                batch_targets.append(target_text)
            
            # Tokenize batch
            inputs = self.tokenizer(
                batch_inputs,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt"
            ).to(self.device)
            
            targets_tokenized = self.tokenizer(
                batch_targets,
                padding=True,
                truncation=True,
                max_length=512,
                return_tensors="pt"
            ).to(self.device)
            
            with torch.no_grad():
                # Calculate loss
                outputs = self.model(
                    input_ids=inputs["input_ids"],
                    attention_mask=inputs["attention_mask"],
                    labels=targets_tokenized["input_ids"]
                )
                
                if hasattr(outputs, 'loss'):
                    total_loss += outputs.loss.item() * len(batch)
                
                total_tokens += inputs["input_ids"].numel()
                
                # Generate predictions
                generated = self.model.generate(
                    input_ids=inputs["input_ids"],
                    attention_mask=inputs["attention_mask"],
                    max_length=inputs["input_ids"].shape[1] + 100,
                    num_return_sequences=1,
                    temperature=0.7,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id
                )
                
                # Decode predictions
                for j, gen_ids in enumerate(generated):
                    # Remove input tokens from generation
                    input_length = inputs["input_ids"][j].shape[0]
                    gen_ids = gen_ids[input_length:]
                    
                    pred_text = self.tokenizer.decode(gen_ids, skip_special_tokens=True)
                    predictions.append(pred_text.strip())
                    targets.append(batch_targets[j])
        
        # Calculate metrics
        avg_loss = total_loss / len(dataset)
        perplexity = np.exp(avg_loss) if avg_loss < 100 else float('inf')
        
        # Calculate text-based metrics
        text_metrics = self._calculate_text_metrics(predictions, targets)
        
        results = {
            "loss": avg_loss,
            "perplexity": perplexity,
            "num_examples": len(dataset),
            "predictions": predictions[:10],  # Sample predictions
            "targets": targets[:10],  # Sample targets
            **text_metrics
        }
        
        return results
    
    def _calculate_text_metrics(self, predictions: List[str], targets: List[str]) -> Dict[str, float]:
        """Calculate text-based evaluation metrics."""
        metrics = {}
        
        # BLEU score (simplified)
        bleu_scores = []
        for pred, target in zip(predictions, targets):
            bleu = self._simple_bleu(pred, target)
            bleu_scores.append(bleu)
        
        metrics["bleu"] = np.mean(bleu_scores)
        
        # Exact match
        exact_matches = sum(1 for p, t in zip(predictions, targets) if p.strip().lower() == t.strip().lower())
        metrics["exact_match"] = exact_matches / len(predictions)
        
        # Average length
        pred_lengths = [len(p.split()) for p in predictions]
        target_lengths = [len(t.split()) for t in targets]
        
        metrics["avg_pred_length"] = np.mean(pred_lengths)
        metrics["avg_target_length"] = np.mean(target_lengths)
        metrics["length_ratio"] = np.mean(pred_lengths) / np.mean(target_lengths) if np.mean(target_lengths) > 0 else 0
        
        return metrics
    
    def _simple_bleu(self, prediction: str, target: str) -> float:
        """Calculate a simplified BLEU score."""
        pred_words = prediction.lower().split()
        target_words = target.lower().split()
        
        if not pred_words or not target_words:
            return 0.0
        
        # Calculate precision for 1-grams
        pred_counts = defaultdict(int)
        target_counts = defaultdict(int)
        
        for word in pred_words:
            pred_counts[word] += 1
        
        for word in target_words:
            target_counts[word] += 1
        
        matches = 0
        for word, count in pred_counts.items():
            matches += min(count, target_counts[word])
        
        precision = matches / len(pred_words) if pred_words else 0
        
        # Brevity penalty
        bp = 1.0 if len(pred_words) >= len(target_words) else np.exp(1 - len(target_words) / len(pred_words))
        
        return bp * precision
    
    def benchmark_inference_speed(self, test_inputs: List[str], num_runs: int = 10) -> Dict[str, float]:
        """Benchmark model inference speed."""
        logger.info(f"Benchmarking inference speed with {len(test_inputs)} inputs, {num_runs} runs")
        
        # Warm up
        for _ in range(3):
            for input_text in test_inputs[:2]:
                self._single_inference(input_text)
        
        # Benchmark
        times = []
        
        for run in range(num_runs):
            start_time = time.time()
            
            for input_text in test_inputs:
                self._single_inference(input_text)
            
            end_time = time.time()
            times.append(end_time - start_time)
        
        avg_time = np.mean(times)
        std_time = np.std(times)
        throughput = len(test_inputs) / avg_time  # examples per second
        
        return {
            "avg_time_per_batch": avg_time,
            "std_time": std_time,
            "throughput_examples_per_sec": throughput,
            "avg_time_per_example": avg_time / len(test_inputs)
        }
    
    def _single_inference(self, input_text: str) -> str:
        """Perform single inference."""
        inputs = self.tokenizer(
            input_text,
            return_tensors="pt",
            truncation=True,
            max_length=512
        ).to(self.device)
        
        with torch.no_grad():
            generated = self.model.generate(
                input_ids=inputs["input_ids"],
                attention_mask=inputs["attention_mask"],
                max_length=inputs["input_ids"].shape[1] + 50,
                num_return_sequences=1,
                temperature=0.7,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
        
        # Decode
        input_length = inputs["input_ids"].shape[1]
        generated_ids = generated[0][input_length:]
        
        return self.tokenizer.decode(generated_ids, skip_special_tokens=True)
    
    def evaluate_subject_specific_tasks(self, subject: str, test_cases: List[Dict[str, str]]) -> Dict[str, Any]:
        """Evaluate model on subject-specific tasks."""
        logger.info(f"Evaluating {subject}-specific tasks with {len(test_cases)} test cases")
        
        results = {
            "subject": subject,
            "total_cases": len(test_cases),
            "correct": 0,
            "partially_correct": 0,
            "incorrect": 0,
            "detailed_results": []
        }
        
        for i, test_case in enumerate(test_cases):
            input_text = test_case.get("input", "")
            expected_output = test_case.get("expected", "")
            category = test_case.get("category", "general")
            
            # Generate prediction
            prediction = self._single_inference(input_text)
            
            # Evaluate correctness
            correctness = self._evaluate_correctness(prediction, expected_output, subject)
            
            if correctness == "correct":
                results["correct"] += 1
            elif correctness == "partial":
                results["partially_correct"] += 1
            else:
                results["incorrect"] += 1
            
            results["detailed_results"].append({
                "case_id": i,
                "input": input_text,
                "expected": expected_output,
                "prediction": prediction,
                "correctness": correctness,
                "category": category
            })
        
        # Calculate percentages
        total = results["total_cases"]
        results["accuracy"] = results["correct"] / total if total > 0 else 0
        results["partial_accuracy"] = (results["correct"] + results["partially_correct"]) / total if total > 0 else 0
        
        return results
    
    def _evaluate_correctness(self, prediction: str, expected: str, subject: str) -> str:
        """Evaluate correctness of prediction based on subject."""
        pred_clean = prediction.strip().lower()
        expected_clean = expected.strip().lower()
        
        # Exact match
        if pred_clean == expected_clean:
            return "correct"
        
        # Subject-specific evaluation
        if subject == "mathematics":
            return self._evaluate_math_correctness(pred_clean, expected_clean)
        elif subject == "programming":
            return self._evaluate_code_correctness(pred_clean, expected_clean)
        else:
            # General text similarity
            if self._simple_bleu(pred_clean, expected_clean) > 0.5:
                return "partial"
            else:
                return "incorrect"
    
    def _evaluate_math_correctness(self, prediction: str, expected: str) -> str:
        """Evaluate mathematical correctness."""
        # Extract numbers from both strings
        import re
        
        pred_numbers = re.findall(r'-?\d+\.?\d*', prediction)
        expected_numbers = re.findall(r'-?\d+\.?\d*', expected)
        
        if pred_numbers and expected_numbers:
            try:
                pred_val = float(pred_numbers[-1])  # Last number in prediction
                expected_val = float(expected_numbers[-1])  # Last number in expected
                
                if abs(pred_val - expected_val) < 0.01:  # Close enough
                    return "correct"
                elif abs(pred_val - expected_val) < abs(expected_val) * 0.1:  # Within 10%
                    return "partial"
            except ValueError:
                pass
        
        return "incorrect"
    
    def _evaluate_code_correctness(self, prediction: str, expected: str) -> str:
        """Evaluate code correctness."""
        # Simple keyword matching for code evaluation
        code_keywords = ["def", "class", "import", "return", "if", "for", "while"]
        
        pred_keywords = sum(1 for kw in code_keywords if kw in prediction)
        expected_keywords = sum(1 for kw in code_keywords if kw in expected)
        
        if pred_keywords > 0 and expected_keywords > 0:
            similarity = min(pred_keywords, expected_keywords) / max(pred_keywords, expected_keywords)
            if similarity > 0.8:
                return "correct"
            elif similarity > 0.5:
                return "partial"
        
        return "incorrect"
    
    def generate_evaluation_report(self, results: Dict[str, Any], output_file: str):
        """Generate comprehensive evaluation report."""
        report = {
            "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "model_info": {
                "device": str(self.device),
                "model_type": type(self.model).__name__
            },
            "results": results
        }
        
        # Save report
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Evaluation report saved to {output_file}")
        
        # Print summary
        self._print_evaluation_summary(results)
    
    def _print_evaluation_summary(self, results: Dict[str, Any]):
        """Print evaluation summary."""
        print(f"\n{'='*50}")
        print("EVALUATION SUMMARY")
        print(f"{'='*50}")
        
        if "loss" in results:
            print(f"Loss: {results['loss']:.4f}")
            print(f"Perplexity: {results['perplexity']:.2f}")
        
        if "bleu" in results:
            print(f"BLEU Score: {results['bleu']:.4f}")
            print(f"Exact Match: {results['exact_match']:.4f}")
        
        if "accuracy" in results:
            print(f"Accuracy: {results['accuracy']:.4f}")
            print(f"Partial Accuracy: {results['partial_accuracy']:.4f}")
        
        if "throughput_examples_per_sec" in results:
            print(f"Throughput: {results['throughput_examples_per_sec']:.2f} examples/sec")

def create_test_cases_for_subject(subject: str, num_cases: int = 50) -> List[Dict[str, str]]:
    """Create test cases for a specific subject."""
    test_cases = []
    
    if subject == "mathematics":
        for i in range(num_cases):
            a, b = np.random.randint(1, 100, 2)
            test_cases.append({
                "input": f"What is {a} + {b}?",
                "expected": f"{a + b}",
                "category": "arithmetic"
            })
    
    elif subject == "programming":
        test_cases.extend([
            {
                "input": "How do you create a list in Python?",
                "expected": "You can create a list using square brackets: my_list = [1, 2, 3]",
                "category": "python_basics"
            },
            {
                "input": "What is a function in programming?",
                "expected": "A function is a reusable block of code that performs a specific task",
                "category": "concepts"
            }
        ] * (num_cases // 2))
    
    # Add more subjects as needed
    
    return test_cases[:num_cases]
