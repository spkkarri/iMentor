"""
Dataset collection utilities for gathering subject-specific training data.
"""

import os
import json
import requests
import pandas as pd
from typing import List, Dict, Any, Optional
import logging
from pathlib import Path
import time
import random

logger = logging.getLogger(__name__)

class DatasetCollector:
    """
    Base class for collecting subject-specific datasets.
    """
    
    def __init__(self, subject: str, output_dir: str):
        self.subject = subject
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def collect_data(self) -> List[Dict[str, Any]]:
        """Collect data for the subject. To be implemented by subclasses."""
        raise NotImplementedError
    
    def save_data(self, data: List[Dict[str, Any]], split_ratios: Dict[str, float] = None):
        """Save collected data to train/val/test splits."""
        if split_ratios is None:
            split_ratios = {"train": 0.8, "val": 0.1, "test": 0.1}
        
        # Shuffle data
        random.shuffle(data)
        
        # Calculate split sizes
        total_size = len(data)
        train_size = int(total_size * split_ratios["train"])
        val_size = int(total_size * split_ratios["val"])
        
        # Split data
        train_data = data[:train_size]
        val_data = data[train_size:train_size + val_size]
        test_data = data[train_size + val_size:]
        
        # Save splits
        splits = {"train": train_data, "val": val_data, "test": test_data}
        
        for split_name, split_data in splits.items():
            file_path = self.output_dir / f"{split_name}.jsonl"
            with open(file_path, 'w', encoding='utf-8') as f:
                for item in split_data:
                    f.write(json.dumps(item, ensure_ascii=False) + '\n')
            
            logger.info(f"Saved {len(split_data)} examples to {file_path}")

class MathematicsDatasetCollector(DatasetCollector):
    """Collector for mathematics datasets."""
    
    def collect_data(self) -> List[Dict[str, Any]]:
        """Collect mathematics training data."""
        data = []
        
        # Add basic arithmetic problems
        data.extend(self._generate_arithmetic_problems(1000))
        
        # Add algebra problems
        data.extend(self._generate_algebra_problems(500))
        
        # Add geometry problems
        data.extend(self._generate_geometry_problems(300))
        
        # Add word problems
        data.extend(self._generate_word_problems(200))
        
        return data
    
    def _generate_arithmetic_problems(self, count: int) -> List[Dict[str, Any]]:
        """Generate basic arithmetic problems."""
        problems = []
        operations = ['+', '-', '*', '/']
        
        for _ in range(count):
            a = random.randint(1, 100)
            b = random.randint(1, 100)
            op = random.choice(operations)
            
            if op == '+':
                result = a + b
                question = f"What is {a} + {b}?"
                answer = f"The sum of {a} and {b} is {result}."
            elif op == '-':
                result = a - b
                question = f"What is {a} - {b}?"
                answer = f"The difference between {a} and {b} is {result}."
            elif op == '*':
                result = a * b
                question = f"What is {a} × {b}?"
                answer = f"The product of {a} and {b} is {result}."
            else:  # division
                if b != 0:
                    result = round(a / b, 2)
                    question = f"What is {a} ÷ {b}?"
                    answer = f"The quotient of {a} divided by {b} is {result}."
                else:
                    continue
            
            problems.append({
                "input": question,
                "target": answer,
                "category": "arithmetic",
                "difficulty": "basic"
            })
        
        return problems
    
    def _generate_algebra_problems(self, count: int) -> List[Dict[str, Any]]:
        """Generate algebra problems."""
        problems = []
        
        for _ in range(count):
            x = random.randint(1, 20)
            a = random.randint(1, 10)
            b = random.randint(1, 50)
            
            # Linear equation: ax + b = result
            result = a * x + b
            question = f"Solve for x: {a}x + {b} = {result}"
            answer = f"To solve {a}x + {b} = {result}, subtract {b} from both sides: {a}x = {result - b}. Then divide by {a}: x = {x}."
            
            problems.append({
                "input": question,
                "target": answer,
                "category": "algebra",
                "difficulty": "intermediate"
            })
        
        return problems
    
    def _generate_geometry_problems(self, count: int) -> List[Dict[str, Any]]:
        """Generate geometry problems."""
        problems = []
        
        for _ in range(count):
            if random.choice([True, False]):
                # Rectangle area
                length = random.randint(5, 20)
                width = random.randint(3, 15)
                area = length * width
                question = f"What is the area of a rectangle with length {length} and width {width}?"
                answer = f"The area of a rectangle is length × width = {length} × {width} = {area} square units."
            else:
                # Circle area
                radius = random.randint(3, 10)
                area = round(3.14159 * radius * radius, 2)
                question = f"What is the area of a circle with radius {radius}?"
                answer = f"The area of a circle is π × r² = π × {radius}² = {area} square units (using π ≈ 3.14159)."
            
            problems.append({
                "input": question,
                "target": answer,
                "category": "geometry",
                "difficulty": "intermediate"
            })
        
        return problems
    
    def _generate_word_problems(self, count: int) -> List[Dict[str, Any]]:
        """Generate word problems."""
        problems = []
        
        templates = [
            {
                "template": "Sarah has {a} apples. She gives {b} apples to her friend. How many apples does she have left?",
                "solution": "Sarah starts with {a} apples and gives away {b} apples. So she has {a} - {b} = {result} apples left."
            },
            {
                "template": "A store sells {a} items per day. How many items will they sell in {b} days?",
                "solution": "If they sell {a} items per day for {b} days, the total is {a} × {b} = {result} items."
            }
        ]
        
        for _ in range(count):
            template = random.choice(templates)
            a = random.randint(10, 100)
            b = random.randint(2, 20)
            
            if "gives" in template["template"]:
                result = a - b
            else:
                result = a * b
            
            question = template["template"].format(a=a, b=b)
            answer = template["solution"].format(a=a, b=b, result=result)
            
            problems.append({
                "input": question,
                "target": answer,
                "category": "word_problems",
                "difficulty": "intermediate"
            })
        
        return problems

class ProgrammingDatasetCollector(DatasetCollector):
    """Collector for programming datasets."""
    
    def collect_data(self) -> List[Dict[str, Any]]:
        """Collect programming training data."""
        data = []
        
        # Add Python basics
        data.extend(self._generate_python_basics(800))
        
        # Add algorithm questions
        data.extend(self._generate_algorithm_questions(400))
        
        # Add debugging questions
        data.extend(self._generate_debugging_questions(300))
        
        # Add best practices
        data.extend(self._generate_best_practices(500))
        
        return data
    
    def _generate_python_basics(self, count: int) -> List[Dict[str, Any]]:
        """Generate Python basics questions."""
        problems = []
        
        basic_questions = [
            {
                "input": "How do you create a list in Python?",
                "target": "You can create a list in Python using square brackets: my_list = [1, 2, 3] or using the list() constructor: my_list = list()."
            },
            {
                "input": "What is the difference between a list and a tuple in Python?",
                "target": "Lists are mutable (can be changed) and use square brackets []. Tuples are immutable (cannot be changed) and use parentheses (). Example: list = [1, 2, 3], tuple = (1, 2, 3)."
            },
            {
                "input": "How do you iterate over a list in Python?",
                "target": "You can iterate over a list using a for loop: for item in my_list: print(item). You can also use enumerate() to get both index and value: for i, item in enumerate(my_list): print(i, item)."
            },
            {
                "input": "What is a dictionary in Python?",
                "target": "A dictionary is a collection of key-value pairs. It's created using curly braces: my_dict = {'key1': 'value1', 'key2': 'value2'}. You access values using keys: my_dict['key1']."
            },
            {
                "input": "How do you define a function in Python?",
                "target": "You define a function using the 'def' keyword: def function_name(parameters): return value. Example: def add(a, b): return a + b."
            }
        ]
        
        # Repeat and vary the basic questions
        for _ in range(count):
            question = random.choice(basic_questions)
            problems.append({
                "input": question["input"],
                "target": question["target"],
                "category": "python_basics",
                "difficulty": "beginner"
            })
        
        return problems
    
    def _generate_algorithm_questions(self, count: int) -> List[Dict[str, Any]]:
        """Generate algorithm questions."""
        problems = []
        
        algorithm_questions = [
            {
                "input": "How do you implement binary search?",
                "target": "Binary search works on sorted arrays. Compare the target with the middle element. If equal, return the index. If target is smaller, search the left half. If larger, search the right half. Repeat until found or array is empty."
            },
            {
                "input": "What is the time complexity of bubble sort?",
                "target": "Bubble sort has a time complexity of O(n²) in the worst and average cases, and O(n) in the best case when the array is already sorted."
            },
            {
                "input": "How do you reverse a linked list?",
                "target": "To reverse a linked list, iterate through the list and reverse the links. Keep track of previous, current, and next nodes. Set current.next = previous, then move all pointers forward."
            }
        ]
        
        for _ in range(count):
            question = random.choice(algorithm_questions)
            problems.append({
                "input": question["input"],
                "target": question["target"],
                "category": "algorithms",
                "difficulty": "intermediate"
            })
        
        return problems
    
    def _generate_debugging_questions(self, count: int) -> List[Dict[str, Any]]:
        """Generate debugging questions."""
        problems = []
        
        debug_questions = [
            {
                "input": "What does 'IndexError: list index out of range' mean?",
                "target": "This error occurs when you try to access a list element using an index that doesn't exist. For example, accessing index 5 in a list with only 3 elements. Check your loop bounds and list lengths."
            },
            {
                "input": "How do you fix a 'NameError: name 'x' is not defined'?",
                "target": "This error means you're using a variable that hasn't been defined. Make sure to: 1) Define the variable before using it, 2) Check for typos in variable names, 3) Ensure the variable is in the correct scope."
            }
        ]
        
        for _ in range(count):
            question = random.choice(debug_questions)
            problems.append({
                "input": question["input"],
                "target": question["target"],
                "category": "debugging",
                "difficulty": "intermediate"
            })
        
        return problems
    
    def _generate_best_practices(self, count: int) -> List[Dict[str, Any]]:
        """Generate best practices questions."""
        problems = []
        
        practice_questions = [
            {
                "input": "What are Python naming conventions?",
                "target": "Python naming conventions: use snake_case for variables and functions, PascalCase for classes, UPPER_CASE for constants. Avoid single letters except for loop counters. Use descriptive names."
            },
            {
                "input": "Why should you use virtual environments?",
                "target": "Virtual environments isolate project dependencies, preventing conflicts between different projects. They allow you to use different package versions for different projects and make deployment more reliable."
            }
        ]
        
        for _ in range(count):
            question = random.choice(practice_questions)
            problems.append({
                "input": question["input"],
                "target": question["target"],
                "category": "best_practices",
                "difficulty": "intermediate"
            })
        
        return problems

class ScienceDatasetCollector(DatasetCollector):
    """Collector for science datasets."""
    
    def collect_data(self) -> List[Dict[str, Any]]:
        """Collect science training data."""
        data = []
        
        # Add physics questions
        data.extend(self._generate_physics_questions(600))
        
        # Add chemistry questions
        data.extend(self._generate_chemistry_questions(600))
        
        # Add biology questions
        data.extend(self._generate_biology_questions(600))
        
        # Add general science concepts
        data.extend(self._generate_general_science(200))
        
        return data
    
    def _generate_physics_questions(self, count: int) -> List[Dict[str, Any]]:
        """Generate physics questions."""
        problems = []
        
        physics_questions = [
            {
                "input": "What is Newton's first law of motion?",
                "target": "Newton's first law states that an object at rest stays at rest, and an object in motion stays in motion at constant velocity, unless acted upon by an external force. This is also known as the law of inertia."
            },
            {
                "input": "What is the formula for kinetic energy?",
                "target": "The formula for kinetic energy is KE = ½mv², where m is mass and v is velocity. Kinetic energy is the energy an object possesses due to its motion."
            },
            {
                "input": "What is the speed of light?",
                "target": "The speed of light in a vacuum is approximately 299,792,458 meters per second (or about 3.00 × 10⁸ m/s). This is a fundamental constant in physics."
            }
        ]
        
        for _ in range(count):
            question = random.choice(physics_questions)
            problems.append({
                "input": question["input"],
                "target": question["target"],
                "category": "physics",
                "difficulty": "intermediate"
            })
        
        return problems
    
    def _generate_chemistry_questions(self, count: int) -> List[Dict[str, Any]]:
        """Generate chemistry questions."""
        problems = []
        
        chemistry_questions = [
            {
                "input": "What is the periodic table?",
                "target": "The periodic table is a systematic arrangement of chemical elements ordered by their atomic number. Elements with similar properties are grouped in columns called groups or families."
            },
            {
                "input": "What is a covalent bond?",
                "target": "A covalent bond is a chemical bond formed when two atoms share one or more pairs of electrons. This typically occurs between non-metal atoms."
            },
            {
                "input": "What is pH?",
                "target": "pH is a scale that measures how acidic or basic a solution is. It ranges from 0 to 14, where 7 is neutral, below 7 is acidic, and above 7 is basic (alkaline)."
            }
        ]
        
        for _ in range(count):
            question = random.choice(chemistry_questions)
            problems.append({
                "input": question["input"],
                "target": question["target"],
                "category": "chemistry",
                "difficulty": "intermediate"
            })
        
        return problems
    
    def _generate_biology_questions(self, count: int) -> List[Dict[str, Any]]:
        """Generate biology questions."""
        problems = []
        
        biology_questions = [
            {
                "input": "What is photosynthesis?",
                "target": "Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to produce glucose and oxygen. The equation is: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂."
            },
            {
                "input": "What is DNA?",
                "target": "DNA (Deoxyribonucleic acid) is the hereditary material that contains genetic instructions for the development and function of living organisms. It has a double helix structure made of nucleotides."
            },
            {
                "input": "What is mitosis?",
                "target": "Mitosis is the process of cell division that produces two identical diploid cells from one parent cell. It consists of prophase, metaphase, anaphase, and telophase."
            }
        ]
        
        for _ in range(count):
            question = random.choice(biology_questions)
            problems.append({
                "input": question["input"],
                "target": question["target"],
                "category": "biology",
                "difficulty": "intermediate"
            })
        
        return problems
    
    def _generate_general_science(self, count: int) -> List[Dict[str, Any]]:
        """Generate general science questions."""
        problems = []
        
        general_questions = [
            {
                "input": "What is the scientific method?",
                "target": "The scientific method is a systematic approach to understanding the natural world. It involves: 1) Observation, 2) Hypothesis formation, 3) Experimentation, 4) Data analysis, 5) Conclusion, and 6) Peer review."
            },
            {
                "input": "What is a hypothesis?",
                "target": "A hypothesis is a testable prediction or explanation for an observed phenomenon. It should be specific, measurable, and falsifiable through experimentation."
            }
        ]
        
        for _ in range(count):
            question = random.choice(general_questions)
            problems.append({
                "input": question["input"],
                "target": question["target"],
                "category": "general_science",
                "difficulty": "beginner"
            })
        
        return problems

def collect_all_datasets(base_output_dir: str = "datasets"):
    """Collect datasets for all subjects."""
    collectors = {
        "mathematics": MathematicsDatasetCollector,
        "programming": ProgrammingDatasetCollector,
        "science": ScienceDatasetCollector,
        # Add more collectors as needed
    }
    
    for subject, collector_class in collectors.items():
        logger.info(f"Collecting data for {subject}...")
        
        output_dir = os.path.join(base_output_dir, subject)
        collector = collector_class(subject, output_dir)
        
        try:
            data = collector.collect_data()
            collector.save_data(data)
            logger.info(f"Successfully collected {len(data)} examples for {subject}")
        except Exception as e:
            logger.error(f"Failed to collect data for {subject}: {e}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    collect_all_datasets()
