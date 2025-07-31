"""
Unsloth integration utilities for memory-efficient training.
"""

import torch
import logging
from typing import Dict, Any, Optional, Tuple
from transformers import AutoModelForCausalLM, AutoTokenizer
import warnings

logger = logging.getLogger(__name__)

class UnslothIntegration:
    """
    Integration wrapper for Unsloth optimizations.
    """
    
    def __init__(self):
        self.unsloth_available = self._check_unsloth_availability()
        self.optimizations_enabled = False
        
    def _check_unsloth_availability(self) -> bool:
        """Check if Unsloth is available."""
        try:
            import unsloth
            logger.info("Unsloth library detected")
            return True
        except ImportError:
            logger.warning("Unsloth library not available. Using standard optimizations.")
            return False
    
    def create_unsloth_model(
        self,
        model_name: str,
        max_seq_length: int = 2048,
        dtype: str = "float16",
        load_in_4bit: bool = True,
        **kwargs
    ) -> Tuple[Any, Any]:
        """
        Create a model using Unsloth optimizations.
        
        Returns:
            Tuple of (model, tokenizer)
        """
        if not self.unsloth_available:
            return self._create_fallback_model(model_name, load_in_4bit, **kwargs)
        
        try:
            from unsloth import FastLanguageModel
            
            # Create Unsloth model
            model, tokenizer = FastLanguageModel.from_pretrained(
                model_name=model_name,
                max_seq_length=max_seq_length,
                dtype=getattr(torch, dtype) if hasattr(torch, dtype) else torch.float16,
                load_in_4bit=load_in_4bit,
                **kwargs
            )
            
            logger.info(f"Created Unsloth model: {model_name}")
            self.optimizations_enabled = True
            
            return model, tokenizer
            
        except Exception as e:
            logger.error(f"Failed to create Unsloth model: {e}")
            return self._create_fallback_model(model_name, load_in_4bit, **kwargs)
    
    def _create_fallback_model(
        self,
        model_name: str,
        load_in_4bit: bool = True,
        **kwargs
    ) -> Tuple[Any, Any]:
        """Create fallback model without Unsloth."""
        from transformers import BitsAndBytesConfig
        
        # Configure quantization
        quantization_config = None
        if load_in_4bit:
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
        
        # Load model and tokenizer
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            quantization_config=quantization_config,
            device_map="auto",
            torch_dtype=torch.float16,
            trust_remote_code=True,
            **kwargs
        )
        
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        logger.info(f"Created fallback model: {model_name}")
        return model, tokenizer
    
    def setup_lora_with_unsloth(
        self,
        model: Any,
        lora_config: Dict[str, Any]
    ) -> Any:
        """Setup LoRA adapters using Unsloth."""
        if not self.unsloth_available:
            return self._setup_lora_fallback(model, lora_config)
        
        try:
            from unsloth import FastLanguageModel
            
            # Add LoRA adapters using Unsloth
            model = FastLanguageModel.get_peft_model(
                model,
                r=lora_config.get("r", 16),
                target_modules=lora_config.get("target_modules", ["q_proj", "k_proj", "v_proj", "o_proj"]),
                lora_alpha=lora_config.get("lora_alpha", 32),
                lora_dropout=lora_config.get("lora_dropout", 0.1),
                bias=lora_config.get("bias", "none"),
                use_gradient_checkpointing=True,
                random_state=3407,
                use_rslora=False,  # Rank stabilized LoRA
                loftq_config=None,  # LoftQ quantization
            )
            
            logger.info("LoRA adapters added using Unsloth")
            return model
            
        except Exception as e:
            logger.error(f"Failed to setup LoRA with Unsloth: {e}")
            return self._setup_lora_fallback(model, lora_config)
    
    def _setup_lora_fallback(self, model: Any, lora_config: Dict[str, Any]) -> Any:
        """Setup LoRA using standard PEFT."""
        try:
            from peft import LoraConfig, get_peft_model, TaskType
            
            peft_config = LoraConfig(
                task_type=TaskType.CAUSAL_LM,
                inference_mode=False,
                r=lora_config.get("r", 16),
                lora_alpha=lora_config.get("lora_alpha", 32),
                lora_dropout=lora_config.get("lora_dropout", 0.1),
                target_modules=lora_config.get("target_modules", ["q_proj", "v_proj"]),
                bias=lora_config.get("bias", "none")
            )
            
            model = get_peft_model(model, peft_config)
            logger.info("LoRA adapters added using PEFT")
            return model
            
        except Exception as e:
            logger.error(f"Failed to setup LoRA fallback: {e}")
            return model
    
    def optimize_for_training(self, model: Any) -> Any:
        """Apply training optimizations."""
        if self.unsloth_available:
            try:
                from unsloth import FastLanguageModel
                
                # Enable training mode with Unsloth optimizations
                FastLanguageModel.for_training(model)
                logger.info("Unsloth training optimizations enabled")
                
            except Exception as e:
                logger.warning(f"Failed to enable Unsloth training optimizations: {e}")
        
        # Standard optimizations
        if hasattr(model, 'gradient_checkpointing_enable'):
            model.gradient_checkpointing_enable()
        
        # Enable training mode
        model.train()
        
        return model
    
    def optimize_for_inference(self, model: Any) -> Any:
        """Apply inference optimizations."""
        if self.unsloth_available:
            try:
                from unsloth import FastLanguageModel
                
                # Enable inference mode with Unsloth optimizations
                FastLanguageModel.for_inference(model)
                logger.info("Unsloth inference optimizations enabled")
                
            except Exception as e:
                logger.warning(f"Failed to enable Unsloth inference optimizations: {e}")
        
        # Standard optimizations
        model.eval()
        
        # Disable gradient computation
        for param in model.parameters():
            param.requires_grad = False
        
        return model
    
    def get_memory_stats(self) -> Dict[str, Any]:
        """Get current memory usage statistics."""
        stats = {}
        
        if torch.cuda.is_available():
            stats["cuda_memory_allocated"] = torch.cuda.memory_allocated() / 1024**3  # GB
            stats["cuda_memory_reserved"] = torch.cuda.memory_reserved() / 1024**3  # GB
            stats["cuda_max_memory_allocated"] = torch.cuda.max_memory_allocated() / 1024**3  # GB
        
        return stats
    
    def clear_memory(self):
        """Clear GPU memory cache."""
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("GPU memory cache cleared")
    
    def save_unsloth_model(
        self,
        model: Any,
        tokenizer: Any,
        save_directory: str,
        save_method: str = "merged_16bit"
    ):
        """Save model using Unsloth optimizations."""
        if not self.unsloth_available:
            # Fallback to standard saving
            model.save_pretrained(save_directory)
            tokenizer.save_pretrained(save_directory)
            logger.info(f"Model saved using standard method to {save_directory}")
            return
        
        try:
            from unsloth import FastLanguageModel
            
            if save_method == "merged_16bit":
                model.save_pretrained_merged(save_directory, tokenizer, save_method="merged_16bit")
            elif save_method == "merged_4bit":
                model.save_pretrained_merged(save_directory, tokenizer, save_method="merged_4bit")
            elif save_method == "lora":
                model.save_pretrained(save_directory)
                tokenizer.save_pretrained(save_directory)
            else:
                # Default to LoRA adapters only
                model.save_pretrained(save_directory)
                tokenizer.save_pretrained(save_directory)
            
            logger.info(f"Model saved using Unsloth ({save_method}) to {save_directory}")
            
        except Exception as e:
            logger.error(f"Failed to save with Unsloth: {e}")
            # Fallback
            model.save_pretrained(save_directory)
            tokenizer.save_pretrained(save_directory)
            logger.info(f"Model saved using fallback method to {save_directory}")

# Global instance
unsloth_integration = UnslothIntegration()

def create_unsloth_model(
    model_name: str,
    max_seq_length: int = 2048,
    dtype: str = "float16",
    load_in_4bit: bool = True,
    **kwargs
) -> Tuple[Any, Any]:
    """Convenience function to create Unsloth model."""
    return unsloth_integration.create_unsloth_model(
        model_name=model_name,
        max_seq_length=max_seq_length,
        dtype=dtype,
        load_in_4bit=load_in_4bit,
        **kwargs
    )

def setup_lora_with_unsloth(model: Any, lora_config: Dict[str, Any]) -> Any:
    """Convenience function to setup LoRA with Unsloth."""
    return unsloth_integration.setup_lora_with_unsloth(model, lora_config)

def optimize_for_training(model: Any) -> Any:
    """Convenience function to optimize model for training."""
    return unsloth_integration.optimize_for_training(model)

def optimize_for_inference(model: Any) -> Any:
    """Convenience function to optimize model for inference."""
    return unsloth_integration.optimize_for_inference(model)
