"""
Lightweight LLM model definitions for subject-specific fine-tuning.
"""

import torch
import torch.nn as nn
from transformers import (
    AutoModelForCausalLM, 
    AutoTokenizer, 
    AutoConfig,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, TaskType
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

class LightweightLLM(nn.Module):
    """
    Lightweight LLM wrapper for subject-specific fine-tuning.
    Supports LoRA adapters and Unsloth optimizations.
    """
    
    def __init__(
        self,
        model_name: str = "microsoft/DialoGPT-small",
        use_lora: bool = True,
        lora_config: Optional[Dict[str, Any]] = None,
        load_in_4bit: bool = True,
        device_map: str = "auto"
    ):
        super().__init__()
        
        self.model_name = model_name
        self.use_lora = use_lora
        self.load_in_4bit = load_in_4bit
        
        # Initialize tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Configure quantization for memory efficiency
        quantization_config = None
        if load_in_4bit:
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
        
        # Load base model
        self.base_model = AutoModelForCausalLM.from_pretrained(
            model_name,
            quantization_config=quantization_config,
            device_map=device_map,
            torch_dtype=torch.float16,
            trust_remote_code=True
        )
        
        # Apply LoRA if specified
        if use_lora:
            self._setup_lora(lora_config or self._get_default_lora_config())
        
        self.model = self.base_model
        
    def _get_default_lora_config(self) -> Dict[str, Any]:
        """Get default LoRA configuration."""
        return {
            "r": 16,
            "lora_alpha": 32,
            "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"],
            "lora_dropout": 0.1,
            "bias": "none",
            "task_type": TaskType.CAUSAL_LM
        }
    
    def _setup_lora(self, lora_config: Dict[str, Any]):
        """Setup LoRA adapters for efficient fine-tuning."""
        try:
            peft_config = LoraConfig(**lora_config)
            self.base_model = get_peft_model(self.base_model, peft_config)
            logger.info(f"LoRA adapters applied with config: {lora_config}")
        except Exception as e:
            logger.error(f"Failed to setup LoRA: {e}")
            raise
    
    def forward(self, input_ids, attention_mask=None, labels=None, **kwargs):
        """Forward pass through the model."""
        return self.model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=labels,
            **kwargs
        )
    
    def generate(self, input_ids, attention_mask=None, **generation_kwargs):
        """Generate text using the model."""
        return self.model.generate(
            input_ids=input_ids,
            attention_mask=attention_mask,
            **generation_kwargs
        )
    
    def save_pretrained(self, save_directory: str):
        """Save the model and tokenizer."""
        if self.use_lora:
            self.base_model.save_pretrained(save_directory)
        else:
            self.model.save_pretrained(save_directory)
        self.tokenizer.save_pretrained(save_directory)
        logger.info(f"Model saved to {save_directory}")
    
    def load_pretrained(self, load_directory: str):
        """Load a pre-trained model."""
        try:
            if self.use_lora:
                # Load LoRA adapters
                from peft import PeftModel
                self.model = PeftModel.from_pretrained(self.base_model, load_directory)
            else:
                self.model = AutoModelForCausalLM.from_pretrained(load_directory)
            logger.info(f"Model loaded from {load_directory}")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def get_trainable_parameters(self):
        """Get count of trainable parameters."""
        if hasattr(self.model, 'print_trainable_parameters'):
            return self.model.print_trainable_parameters()
        else:
            trainable = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
            total = sum(p.numel() for p in self.model.parameters())
            return f"Trainable params: {trainable:,} || Total params: {total:,} || Trainable%: {100 * trainable / total:.2f}"

class SubjectSpecificModel(LightweightLLM):
    """
    Subject-specific model with domain adaptation layers.
    """
    
    def __init__(
        self,
        subject_domain: str,
        model_name: str = "microsoft/DialoGPT-small",
        **kwargs
    ):
        super().__init__(model_name=model_name, **kwargs)
        
        self.subject_domain = subject_domain
        self.domain_embeddings = None
        
        # Add domain-specific components if needed
        self._setup_domain_adaptation()
    
    def _setup_domain_adaptation(self):
        """Setup domain-specific adaptation layers."""
        # This can be extended with domain-specific embeddings,
        # attention mechanisms, or other architectural modifications
        pass
    
    def set_domain_context(self, domain_keywords: list):
        """Set domain-specific context for the model."""
        # This can be used to inject domain-specific knowledge
        # during inference
        pass

class UnslothOptimizedModel(LightweightLLM):
    """
    Model optimized with Unsloth for faster training and inference.
    """
    
    def __init__(self, model_name: str, max_seq_length: int = 2048, **kwargs):
        # Note: Unsloth integration would require the actual unsloth library
        # This is a placeholder for the integration
        super().__init__(model_name=model_name, **kwargs)
        self.max_seq_length = max_seq_length
        
        # Unsloth optimizations would be applied here
        self._apply_unsloth_optimizations()
    
    def _apply_unsloth_optimizations(self):
        """Apply Unsloth optimizations to the model."""
        # Placeholder for Unsloth integration
        # In practice, this would use the unsloth library to optimize
        # the model for faster training and reduced memory usage
        logger.info("Unsloth optimizations applied (placeholder)")

def create_model_for_subject(
    subject: str,
    model_name: str = "microsoft/DialoGPT-small",
    use_unsloth: bool = True,
    **kwargs
) -> LightweightLLM:
    """
    Factory function to create a model for a specific subject.
    """
    if use_unsloth:
        return UnslothOptimizedModel(
            model_name=model_name,
            **kwargs
        )
    else:
        return SubjectSpecificModel(
            subject_domain=subject,
            model_name=model_name,
            **kwargs
        )

def get_model_size_config(size: str) -> Dict[str, Any]:
    """Get model configuration based on size."""
    configs = {
        "1B": {
            "model_name": "microsoft/DialoGPT-small",
            "hidden_size": 768,
            "num_attention_heads": 12,
            "num_hidden_layers": 12
        },
        "3B": {
            "model_name": "microsoft/DialoGPT-medium", 
            "hidden_size": 1024,
            "num_attention_heads": 16,
            "num_hidden_layers": 24
        },
        "7B": {
            "model_name": "microsoft/DialoGPT-large",
            "hidden_size": 1280,
            "num_attention_heads": 20,
            "num_hidden_layers": 36
        }
    }
    
    if size not in configs:
        raise ValueError(f"Unsupported model size: {size}. Available: {list(configs.keys())}")
    
    return configs[size]
